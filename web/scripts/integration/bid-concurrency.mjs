// Dedicated disposable PostgreSQL only. Never load project .env files.
import { Client } from 'pg';
import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { setupBidDatabase, resetBidData, actor, state, submitSql, args, workerId, clientId, jobId, secondJobId } from '../fixtures/bid-database.mjs';

const url = new URL(process.env.TEST_DATABASE_URL ?? 'http://missing');
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/master_md_test') {
  throw new Error('TEST_DATABASE_URL must point to a disposable localhost database named master_md_test');
}
const clients = [];
async function connect() {
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  client.exec = (sql) => client.query(sql);
  clients.push(client);
  return client;
}
let db;
before(async () => {
  db = await connect();
  const { rows } = await db.query("select count(*)::int as n from information_schema.tables where table_schema='public'");
  assert.equal(rows[0].n, 0, 'Refusing to initialize a database containing tables');
  await setupBidDatabase(db);
});
beforeEach(() => resetBidData(db));
afterEach(async () => {
  // Roll back the lock holder before draining the waiting connection.
  for (const client of clients.slice(1)) await client.query('rollback').catch(() => {});
  for (const client of clients.splice(1)) await client.end();
});
after(async () => { for (const client of clients) await client.end(); });

async function waitForLock(client) {
  for (let i = 0; i < 100; i++) {
    const { rows } = await db.query('select wait_event_type from pg_stat_activity where pid=$1', [client.processID]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await delay(20);
  }
  assert.fail('Second connection never waited for a PostgreSQL lock');
}
const outcome = (promise) => promise.then(value => ({ value }), error => ({ error }));

test('two independent connections retry one bid: one charge and one notification', async () => {
  const a = await connect(), b = await connect();
  await actor(a); await actor(b);
  await a.query('begin');
  const first = (await a.query(submitSql, args())).rows[0];
  const pending = outcome(b.query(submitSql, args()));
  await waitForLock(b);
  await a.query('commit');
  const { value, error } = await pending;
  assert.ifError(error);
  assert.equal(value.rows[0].created, false);
  assert.equal(value.rows[0].bid_id, first.bid_id);
  assert.deepEqual(await state(db), { credits: 4, bids: 1, notifications: 1 });
});

test('two jobs compete for the last credit: one succeeds, one fails without debit', async () => {
  await db.query('update profiles_worker set bid_credits=1 where id=$1', [workerId]);
  const a = await connect(), b = await connect();
  await actor(a); await actor(b);
  await a.query('begin');
  await a.query(submitSql, args());
  const pending = outcome(b.query(submitSql, args(secondJobId)));
  await waitForLock(b);
  await a.query('commit');
  assert.equal((await pending).error?.message, 'no_credits');
  assert.deepEqual(await state(db), { credits: 0, bids: 1, notifications: 1 });
});

test('a cancellation holding the job lock prevents a later bid from charging', async () => {
  const a = await connect(), b = await connect();
  await actor(a, clientId); await actor(b);
  await a.query('begin');
  await a.query("update jobs set status='cancelled' where id=$1", [jobId]);
  const pending = outcome(b.query(submitSql, args()));
  await waitForLock(b);
  await a.query('commit');
  assert.equal((await pending).error?.message, 'job_unavailable');
  assert.deepEqual(await state(db), { credits: 5, bids: 0, notifications: 0 });
});

test('a top-up racing a debit preserves both changes to the balance', async () => {
  const a = await connect(), b = await connect();
  await actor(a); await actor(b, null, 'service_role');
  await a.query('begin');
  await a.query(submitSql, args());
  const pending = outcome(b.query('select grant_bid_credits($1,10)', [workerId]));
  await waitForLock(b);
  await a.query('commit');
  assert.ifError((await pending).error);
  assert.deepEqual(await state(db), { credits: 14, bids: 1, notifications: 1 });
});

// Test final job workflow using the same real PostgreSQL connections.
test('concurrent selection and cancellation produce a single consistent outcome', async () => {
  const { readFileSync } = await import('node:fs');
  await db.exec(readFileSync(new URL('../../supabase/migrations/202610040001_job_workflow.sql',import.meta.url),'utf8'));
  const a=await connect(), b=await connect();
  await actor(a); const bid=(await a.query(submitSql,args())).rows[0].bid_id;
  await actor(a,clientId); await actor(b,clientId);
  await a.query('begin');
  await a.query('select * from select_job_worker($1,$2)',[jobId,bid]);
  const pending=outcome(b.query('select cancel_job($1)',[jobId]));
  await waitForLock(b); await a.query('commit');
  assert.equal((await pending).error?.message,'invalid_state');
  const j=(await db.query('select status,selected_worker_id from jobs where id=$1',[jobId])).rows[0];
  assert.deepEqual(j,{status:'in_progress',selected_worker_id:workerId});
  assert.equal((await db.query('select status from bids where id=$1',[bid])).rows[0].status,'selected');
});

test('concurrent completions for one worker preserve both reviews and aggregate rating', async () => {
  const a=await connect(), b=await connect();
  await actor(a);
  const first=(await a.query(submitSql,args())).rows[0].bid_id;
  const second=(await a.query(submitSql,args(secondJobId))).rows[0].bid_id;
  await actor(a,clientId); await actor(b,clientId);
  await a.query('select * from select_job_worker($1,$2)',[jobId,first]);
  await b.query('select * from select_job_worker($1,$2)',[secondJobId,second]);
  await a.query('begin'); await a.query('select * from complete_job($1,5,$2)',[jobId,'Great job']);
  const pending=outcome(b.query('select * from complete_job($1,3,$2)',[secondJobId,'Good job']));
  await waitForLock(b); await a.query('commit'); assert.ifError((await pending).error);
  const row=(await db.query('select rating_avg,rating_count from profiles_worker where id=$1',[workerId])).rows[0];
  assert.equal(Number(row.rating_avg),4); assert.equal(row.rating_count,2);
  assert.equal((await db.query("select count(*)::int as n from notifications where type='job_completed'")).rows[0].n,2);
});

test('free pilot: concurrent retries with zero credits create one free bid', async () => {
  const {readFileSync}=await import('node:fs');
  await db.exec(readFileSync(new URL('../../supabase/migrations/202610040002_free_balti_pilot.sql',import.meta.url),'utf8'));
  await db.query('update profiles_worker set bid_credits=0 where id=$1',[workerId]);
  const a=await connect(),b=await connect(); await actor(a); await actor(b);
  await a.query('begin'); const first=(await a.query(submitSql,args())).rows[0];
  const pending=outcome(b.query(submitSql,args())); await waitForLock(b); await a.query('commit');
  const result=await pending; assert.ifError(result.error); assert.equal(result.value.rows[0].bid_id,first.bid_id);
  assert.equal(result.value.rows[0].created,false);
  assert.deepEqual(await state(db),{credits:0,bids:1,notifications:1});
});
test('free pilot: concurrent jobs cannot exceed the daily bid limit', async () => {
  await db.query(`with added as (insert into jobs(client_id,description,category,city,area)
    select $1,'Synthetic daily limit job','electric','Бельцы','Центр' from generate_series(1,9) returning id)
    insert into bids(job_id,worker_id,price,comment) select id,$2,500,'Synthetic daily limit bid' from added`,[clientId,workerId]);
  const a=await connect(),b=await connect(); await actor(a); await actor(b);
  await a.query('begin'); await a.query(submitSql,args());
  const pending=outcome(b.query(submitSql,args(secondJobId))); await waitForLock(b); await a.query('commit');
  assert.equal((await pending).error?.message,'daily_limit');
  assert.deepEqual(await state(db),{credits:5,bids:10,notifications:10});
});
