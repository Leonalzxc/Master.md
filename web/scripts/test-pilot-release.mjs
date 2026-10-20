import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pilotRelease} from './pilot-release.mjs';
import {setupBidDatabase,resetBidData,actor,workerId,otherId,clientId,jobId,secondJobId,submitSql,args,state} from './fixtures/bid-database.mjs';
test('combined release is transactional, repeatable, private and free without losing existing data',async()=>{
 const db=new PGlite();
 try{
  await setupBidDatabase(db);await resetBidData(db);
  const sql=pilotRelease();
  assert.equal(readFileSync(new URL('../../docs/releases/20261004-free-balti-pilot.sql',import.meta.url),'utf8'),sql);
  await assert.rejects(db.exec(sql.replace("NOTIFY pgrst, 'reload schema';\nCOMMIT;","SELECT 1/0;\nCOMMIT;")));
  await db.exec('ROLLBACK');
  assert.equal((await db.query("select to_regprocedure('public.issue_telegram_link(text)') as fn")).rows[0].fn,null);
  await db.exec(sql);await db.exec(sql);
  await actor(db,workerId);
  assert.equal((await db.query(submitSql,args())).rows[0].created,true);
  assert.deepEqual(await state(db),{credits:5,bids:1,notifications:1});
  await actor(db,null,'anon');await assert.rejects(db.query('select phone from profiles'));
  await assert.rejects(db.query('select lat,lng from jobs'));
 }finally{await db.close();}
});
test('legacy production triggers target only eligible pilot workers and expiry is service-only',async()=>{
 const db=new PGlite();
 try{
  await setupBidDatabase(db);await resetBidData(db);
  // Some old deployments exposed the SECURITY DEFINER expiry function.
  await db.exec('grant execute on function public.expire_overdue_jobs() to public');
  await db.exec(pilotRelease());
  await db.query("update profiles set city='Бельцы' where id in ($1,$2)",[workerId,otherId]);
  await db.query("update profiles set blocked_at=now() where id=$1",[otherId]);
  await db.query("update profiles_worker set categories=array['electric'] where id in ($1,$2)",[workerId,otherId]);
  const {rows:[newJob]}=await db.query("insert into jobs(client_id,description,category,city,area) values ($1,'Synthetic trigger compatibility test','electric','Бельцы','Центр') returning id",[clientId]);
  const recipients=(await db.query("select user_id from notifications where payload->>'job_id'=$1",[newJob.id])).rows;
  assert.deepEqual(recipients.map(r=>r.user_id),[workerId]);
  await db.query("update profiles set city=null where id=$1",[workerId]);
  const {rows:[noCityJob]}=await db.query("insert into jobs(client_id,description,category,city,area) values ($1,'Synthetic unspecified worker city','electric','Бельцы','Центр') returning id",[clientId]);
  assert.equal((await db.query("select count(*)::int as n from notifications where payload->>'job_id'=$1",[noCityJob.id])).rows[0].n,0);
  await actor(db,workerId);await db.query(submitSql,args());
  await db.exec("reset role; select set_config('request.jwt.claim.role','',false)");
  await db.query("update jobs set expires_at=now()-interval '1 hour' where id=$1",[jobId]);
  await db.query("update jobs set status='in_progress',selected_worker_id=$1,expires_at=now()-interval '1 hour' where id=$2",[workerId,secondJobId]);
  await actor(db,null,'anon');await assert.rejects(db.query('select public.expire_overdue_jobs()'),{code:'42501'});
  await actor(db,workerId);await assert.rejects(db.query('select public.expire_overdue_jobs()'),{code:'42501'});
  await actor(db,null,'service_role');assert.equal((await db.query('select public.expire_overdue_jobs() as n')).rows[0].n,1);
  await db.exec('reset role');
  assert.equal((await db.query('select status from bids where job_id=$1',[jobId])).rows[0].status,'rejected');
  assert.equal((await db.query('select status from jobs where id=$1',[secondJobId])).rows[0].status,'in_progress');
  await actor(db,null,'service_role');assert.equal((await db.query('select public.expire_overdue_jobs() as n')).rows[0].n,0);
 }finally{await db.close();}
});
