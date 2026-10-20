import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { setupBidDatabase, resetBidData, actor, args, submitSql, workerId,clientId,otherId,jobId } from './fixtures/bid-database.mjs';
const db = new PGlite();
const sql = file => readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
before(async () => { await setupBidDatabase(db); for (const f of ['202610040001_job_workflow.sql','202610040002_free_balti_pilot.sql','202610040003_worker_location_privacy.sql']) await db.exec(sql(f)); });
beforeEach(async () => { await resetBidData(db); await db.exec(`update jobs set lat=47.76,lng=27.93; update profiles_worker set viber='private-viber',telegram='private-user',whatsapp='private-phone' where id='${workerId}'`); });
after(()=>db.close());
async function selected() {
  await actor(db); const bid=(await db.query(submitSql,args())).rows[0].bid_id;
  await actor(db,clientId); await db.query('select * from select_job_worker($1,$2)',[jobId,bid]);
}
test('guest and authenticated wildcard, filter and direct private reads are denied', async () => {
  for (const [id,role] of [[null,'anon'],[otherId,'authenticated']]) {
    await actor(db,id,role);
    for (const query of ['select * from jobs','select lat,lng from jobs',"select id from jobs where lat=47.76",
      'select * from profiles_worker','select viber,telegram,whatsapp from profiles_worker',
      "select id from profiles_worker where telegram='private-user'",'select bid_credits from profiles_worker']) {
      await assert.rejects(db.query(query),{code:'42501'});
    }
    assert.ok((await db.query('select id,description,city from jobs')).rows.length>0);
    assert.ok((await db.query('select id,categories,rating_avg from profiles_worker')).rows.length>0);
  }
});
test('own profile RPC returns private fields only for authenticated owner', async () => {
  await actor(db); const row=(await db.query('select * from get_my_worker_profile()')).rows[0];
  assert.equal(row.id,workerId); assert.equal(row.telegram,'private-user');
  await actor(db,otherId); assert.equal((await db.query('select * from get_my_worker_profile()')).rows[0].telegram,null);
  await actor(db,null,'anon'); await assert.rejects(db.query('select * from get_my_worker_profile()'),{code:'42501'});
});
test('exact location is restricted to owner and real selected bidder while in progress', async () => {
  await actor(db); assert.equal((await db.query('select * from get_job_location($1)',[jobId])).rows.length,0);
  await actor(db,clientId); assert.equal((await db.query('select * from get_job_location($1)',[jobId])).rows[0].lat,47.76);
  await selected(); await actor(db); assert.equal((await db.query('select * from get_job_location($1)',[jobId])).rows[0].lng,27.93);
  await actor(db,otherId); assert.equal((await db.query('select * from get_job_location($1)',[jobId])).rows.length,0);
  await actor(db,clientId); await db.query('select * from complete_job($1,5,$2)',[jobId,'Completed']);
  await actor(db); assert.equal((await db.query('select * from get_job_location($1)',[jobId])).rows.length,0);
});
test('worker contacts require selected bid, owner, unblocked participants and in-progress status', async () => {
  await actor(db,clientId); assert.equal((await db.query('select * from get_job_worker_contact($1)',[jobId])).rows.length,0);
  await selected(); const row=(await db.query('select * from get_job_worker_contact($1)',[jobId])).rows[0];
  assert.equal(row.telegram,'private-user'); assert.equal(row.phone,'+37360000002');
  await actor(db,otherId); assert.equal((await db.query('select * from get_job_worker_contact($1)',[jobId])).rows.length,0);
  await db.exec("reset role; select set_config('request.jwt.claim.role','',false)");
  await db.query('update profiles set blocked_at=now() where id=$1',[workerId]);
  await actor(db,clientId); assert.equal((await db.query('select * from get_job_worker_contact($1)',[jobId])).rows.length,0);
});
test('profile edits are atomic, preserve credits and cannot edit another actor or become admin', async () => {
  const data={name:'Updated worker',role:'worker',city:'Бельцы',categories:['electric'],areas:[],bio:'Worker bio',experience_yrs:'3',viber:'own',telegram:'own-user',whatsapp:'own-phone',photos:[],id:otherId,bid_credits:1000,verified:true};
  await actor(db); await db.query('select save_my_profile($1)',[JSON.stringify(data)]);
  const own=(await db.query('select * from get_my_worker_profile()')).rows[0];
  assert.equal(own.telegram,'own-user'); assert.equal(own.bid_credits,5); assert.equal(own.verified,false);
  await assert.rejects(db.query('select save_my_profile($1)',[JSON.stringify({...data,role:'admin'})]),{message:'invalid_input'});
  await db.exec('reset role'); assert.equal((await db.query('select name from profiles where id=$1',[otherId])).rows[0].name,'Other worker');
});
test('privacy migration removes legacy per-column grants when applied again', async () => {
  await db.exec('grant select(lat,lng) on jobs to anon; grant select(telegram) on profiles_worker to authenticated');
  await db.exec(sql('202610040003_worker_location_privacy.sql'));
  await actor(db); await assert.rejects(db.query('select telegram from profiles_worker'),{code:'42501'});
  await actor(db,null,'anon'); await assert.rejects(db.query('select lat from jobs'),{code:'42501'});
});
