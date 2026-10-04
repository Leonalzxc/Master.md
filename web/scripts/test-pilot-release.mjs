import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pilotRelease} from './pilot-release.mjs';
import {setupBidDatabase,resetBidData,actor,workerId,submitSql,args,state} from './fixtures/bid-database.mjs';
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
