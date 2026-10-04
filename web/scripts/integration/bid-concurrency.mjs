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
