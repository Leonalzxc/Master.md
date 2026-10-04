import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { setupBidDatabase, resetBidData, actor, state, submitSql, args, workerId, clientId, jobId } from './fixtures/bid-database.mjs';
const db = new PGlite();
const sql = file => readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
before(async () => {
  await setupBidDatabase(db);
  await db.exec(sql('202610040001_job_workflow.sql'));
  await db.exec(sql('202610040002_free_balti_pilot.sql'));
});
beforeEach(() => resetBidData(db)); after(() => db.close());
async function trusted() { await db.exec("reset role; select set_config('request.jwt.claim.role','',false)"); }
test('free pilot accepts zero balance and does not deduct existing credits', async () => {
  await db.query('update profiles_worker set bid_credits=0 where id=$1',[workerId]);
  await actor(db);
  const first=(await db.query(submitSql,args())).rows[0];
  const retry=(await db.query(submitSql,args())).rows[0];
  assert.equal(first.created,true); assert.equal(first.credits_remaining,0);
  assert.equal(retry.created,false); assert.equal(retry.bid_id,first.bid_id);
  assert.deepEqual(await state(db),{credits:0,bids:1,notifications:1});
});
test('ten bids in rolling 24 hours are allowed; the eleventh is refused; retry consumes nothing', async () => {
  await db.exec(`insert into jobs(client_id,description,category,city,area) select '${clientId}','Synthetic test work','electric','Бельцы','Центр' from generate_series(1,9)`);
  const jobs=(await db.query('select id from jobs order by id')).rows;
  assert.equal(jobs.length,11);
  await actor(db);
  for (const job of jobs.slice(0,10)) await db.query(submitSql,args(job.id));
  await assert.rejects(db.query(submitSql,args(jobs[10].id)),{message:'daily_limit'});
  const retry=(await db.query(submitSql,args(jobs[0].id))).rows[0]; assert.equal(retry.created,false);
  assert.deepEqual(await state(db),{credits:5,bids:10,notifications:10});
  await trusted(); await db.exec(`update bids set created_at=now()-interval '25 hours' where job_id='${jobs[0].id}'`);
  await actor(db); assert.equal((await db.query(submitSql,args(jobs[10].id))).rows[0].created,true);
});
test('new bids outside Bălți are unavailable; old data is preserved', async () => {
  await db.query('update jobs set city=$1 where id=$2',['Кишинёв',jobId]);
  await actor(db); await assert.rejects(db.query(submitSql,args()),{message:'job_unavailable'});
  assert.deepEqual(await state(db),{credits:5,bids:0,notifications:0});
});
const insert = `insert into jobs(client_id,description,category,city,area,lat,lng) values ($1,'Valid pilot job description','electric',$2,'Центр',$3,$4)`;
test('REST job creation requires a finite map pin in pilot coverage and Bălți', async () => {
  await actor(db,clientId);
  for (const [city,lat,lng] of [['Бельцы',null,null],['Бельцы',0,0],['Кишинёв',47.76,27.93],['Бельцы','NaN',27.93],['Бельцы',47.76,30]]) {
    await assert.rejects(db.query(insert,[clientId,city,lat,lng]),{message:'pilot_location_required'});
  }
  await db.query(insert,[clientId,'Бельцы',47.76,27.93]);
});
test('rolling new-job cap is enforced by the database, including cancelled jobs', async () => {
  await actor(db,clientId);
  for (let i=0;i<3;i++) await db.query(insert,[clientId,'Бельцы',47.76,27.93]);
  await assert.rejects(db.query(insert,[clientId,'Бельцы',47.76,27.93]),{message:'job_daily_limit'});
  await db.query('select cancel_job($1)',[jobId]);
  await assert.rejects(db.query(insert,[clientId,'Бельцы',47.76,27.93]),{message:'job_daily_limit'});
});
test('pilot migration can run again without resetting balances or bids', async () => {
  await actor(db); await db.query(submitSql,args());
  await trusted(); await db.exec(sql('202610040002_free_balti_pilot.sql'));
  assert.deepEqual(await state(db),{credits:5,bids:1,notifications:1});
});
