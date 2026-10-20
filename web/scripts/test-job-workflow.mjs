import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { setupBidDatabase, resetBidData, actor, submitSql, args, clientId, workerId, otherId, jobId, secondJobId } from './fixtures/bid-database.mjs';
const db = new PGlite();
const workflowSql = readFileSync(new URL('../supabase/migrations/202610040001_job_workflow.sql', import.meta.url), 'utf8');
before(async () => { await setupBidDatabase(db); await db.exec(workflowSql); });
beforeEach(() => resetBidData(db));
after(() => db.close());
async function bid(id=workerId, job=jobId) {
  await actor(db,id);
  return (await db.query(submitSql,args(job))).rows[0].bid_id;
}
async function select(id) { await actor(db,clientId); return (await db.query('select * from select_job_worker($1,$2)',[jobId,id])).rows[0]; }
async function snapshot() {
  await db.exec('reset role');
  return (await db.query(`select j.status,j.selected_worker_id,
    (select count(*)::int from reviews) as reviews,
    (select rating_count from profiles_worker where id='${workerId}') as rating_count,
    (select count(*)::int from notifications where type='job_completed') as done_notifications
    from jobs j where j.id='${jobId}'`)).rows[0];
}
test('select derives worker from the bid; rejects alternatives and repeats once', async () => {
  const first=await bid(), second=await bid(otherId);
  assert.deepEqual(await select(first),{worker_id:workerId,changed:true});
  assert.deepEqual(await select(first),{worker_id:workerId,changed:false});
  await assert.rejects(select(second),{message:'invalid_state'});
  await db.exec('reset role');
  assert.equal((await db.query('select status from bids where id=$1',[second])).rows[0].status,'rejected');
  assert.equal((await db.query("select count(*)::int as n from notifications where type='bid_accepted'")).rows[0].n,1);
});
test('selection rejects another job, another client and blocked worker', async () => {
  const foreign=await bid(workerId,secondJobId);
  await assert.rejects(select(foreign),{message:'invalid_bid'});
  const id=await bid();
  await actor(db,otherId);
  await assert.rejects(db.query('select * from select_job_worker($1,$2)',[jobId,id]),{message:'not_authorized'});
  await db.exec(`reset role; select set_config('request.jwt.claim.role','','false'); update profiles set blocked_at=now() where id='${workerId}'`);
  await assert.rejects(select(id),{message:'invalid_bid'});
  assert.equal((await snapshot()).status,'active');
});
test('cancel rejects pending bids, repeats safely and cannot cancel selected work', async () => {
  const id=await bid();
  await actor(db,otherId);
  await assert.rejects(db.query('select cancel_job($1)',[jobId]),{message:'not_authorized'});
  await actor(db,clientId);
  assert.equal((await db.query('select cancel_job($1) as changed',[jobId])).rows[0].changed,true);
  assert.equal((await db.query('select cancel_job($1) as changed',[jobId])).rows[0].changed,false);
  await db.exec('reset role');
  assert.equal((await db.query('select status from bids where id=$1',[id])).rows[0].status,'rejected');
  await resetBidData(db); await select(await bid());
  await assert.rejects(db.query('select cancel_job($1)',[jobId]),{message:'invalid_state'});
});
test('completion creates one review, one notification and one trusted rating on retry', async () => {
  await select(await bid());
  const first=(await db.query('select * from complete_job($1,5,$2)',[jobId,'Good work'])).rows[0];
  const retry=(await db.query('select * from complete_job($1,1,$2)',[jobId,'Different retry'])).rows[0];
  assert.equal(first.changed,true); assert.equal(retry.changed,false); assert.equal(first.review_id,retry.review_id);
  assert.deepEqual(await snapshot(),{status:'done',selected_worker_id:workerId,reviews:1,rating_count:1,done_notifications:1});
  assert.equal(Number((await db.query('select rating_avg from profiles_worker where id=$1',[workerId])).rows[0].rating_avg),5);
});
test('unfinished, foreign and malformed completion cannot create reviews', async () => {
  await actor(db,clientId);
  await assert.rejects(db.query('select * from complete_job($1,5,$2)',[jobId,'Review']),{message:'invalid_state'});
  await select(await bid());
  for (const rating of [null,0,6]) await assert.rejects(db.query('select * from complete_job($1,$2,$3)',[jobId,rating,'Review']),{message:'invalid_input'});
  await actor(db,otherId);
  await assert.rejects(db.query('select * from complete_job($1,5,$2)',[jobId,'Review']),{message:'not_authorized'});
  assert.equal((await snapshot()).reviews,0);
});
test('a rating write failure rolls back review, job and notification together', async () => {
  await select(await bid());
  await db.exec(`reset role; create function force_rating_failure() returns trigger language plpgsql as $$begin raise exception 'forced_failure'; end;$$;
    create trigger rating_failure before update on profiles_worker for each row execute function force_rating_failure();`);
  try {
    await actor(db,clientId);
    await assert.rejects(db.query('select * from complete_job($1,5,$2)',[jobId,'Review']),{message:'forced_failure'});
    assert.deepEqual(await snapshot(),{status:'in_progress',selected_worker_id:workerId,reviews:0,rating_count:0,done_notifications:0});
  } finally { await db.exec('reset role; drop trigger rating_failure on profiles_worker; drop function force_rating_failure()'); }
});
test('REST cannot forge state, reviews or notifications; read flag remains available', async () => {
  await bid(); await actor(db,clientId);
  for (const sql of ["update jobs set status='done'", "update bids set status='selected'",
    `insert into reviews(job_id,author_id,worker_id,rating) values ('${jobId}','${clientId}','${workerId}',5)`,
    `insert into notifications(user_id,type,title) values ('${clientId}','fake','fake')`,
    "update notifications set title='Forged'", 'delete from notifications']) {
    await assert.rejects(db.query(sql),{code:'42501'});
  }
  await db.query('update notifications set read=true where user_id=$1',[clientId]);
  assert.equal((await db.query('select read from notifications')).rows[0].read,true);
  await actor(db,null,'anon');
  await assert.rejects(db.query('select cancel_job($1)',[jobId]),{code:'42501'});
});
test('blocked accounts and forged initial state cannot insert new jobs', async () => {
  await actor(db,clientId);
  await assert.rejects(db.query(`insert into jobs(client_id,description,category,city,area,status) values ($1,'A valid job description','electric','Бельцы','Центр','done')`,[clientId]),{message:'invalid_input'});
  await db.exec(`reset role; select set_config('request.jwt.claim.role','','false'); update profiles set blocked_at=now() where id='${clientId}'`);
  await actor(db,clientId);
  await assert.rejects(db.query(`insert into jobs(client_id,description,category,city,area) values ($1,'A valid job description','electric','Бельцы','Центр')`,[clientId]),{message:'not_authorized'});
});
