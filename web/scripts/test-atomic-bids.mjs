import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { setupBidDatabase, resetBidData, actor, state, submitSql, args, atomicSql, clientId, workerId, otherId, jobId } from './fixtures/bid-database.mjs';

const db = new PGlite();
before(() => setupBidDatabase(db));
beforeEach(() => resetBidData(db));
after(() => db.close());

test('bid, charge and notification commit once; replay returns the same bid', async () => {
  await actor(db);
  const first = (await db.query(submitSql, args())).rows[0];
  const retry = (await db.query(submitSql, args())).rows[0];
  assert.equal(first.created, true);
  assert.equal(retry.created, false);
  assert.equal(first.bid_id, retry.bid_id);
  assert.equal(retry.credits_remaining, 4);
  assert.deepEqual(await state(db), { credits: 4, bids: 1, notifications: 1 });
});

test('no balance, expired/closed job, self-bid and blocked accounts do not charge', async () => {
  const cases = [
    [`update profiles_worker set bid_credits=0 where id='${workerId}'`, 'no_credits', 0],
    [`update jobs set expires_at=now()-interval '1 second'`, 'job_unavailable', 5],
    ["update jobs set status='cancelled'", 'job_unavailable', 5],
    [`update jobs set client_id='${workerId}'`, 'own_job', 5],
    [`update profiles set blocked_at=now() where id='${workerId}'`, 'account_blocked', 5],
    [`update profiles set blocked_at=now() where id='${clientId}'`, 'job_unavailable', 5],
    [`update profiles set role='client' where id='${workerId}'`, 'not_worker', 5],
  ];
  for (const [change, message, credits] of cases) {
    await resetBidData(db);
    await db.exec(change);
    await actor(db);
    await assert.rejects(db.query(submitSql, args()), { message });
    assert.deepEqual(await state(db), { credits, bids: 0, notifications: 0 });
  }
});

test('RPC rejects malformed inputs and absent jobs without changing balances', async () => {
  await actor(db);
  for (const input of [
    [jobId, 0, 'Valid comment here', null],
    [jobId, -1, 'Valid comment here', null],
    [jobId, 'NaN', 'Valid comment here', null],
    [jobId, 'Infinity', 'Valid comment here', null],
    [jobId, 1000000001, 'Valid comment here', null],
    [jobId, 500, 'short', null],
    [jobId, 500, 'x'.repeat(2001), null],
    [jobId, 500, 'Valid comment here', '2000-01-01'],
  ]) await assert.rejects(db.query(submitSql, input), { message: 'invalid_input' });
  await assert.rejects(db.query(submitSql, args('20000000-0000-4000-8000-000000000099')), { message: 'job_unavailable' });
  assert.deepEqual(await state(db), { credits: 5, bids: 0, notifications: 0 });
});

test('a committed bid can be retried after closure even with zero credits', async () => {
  await actor(db);
  const first = (await db.query(submitSql, args())).rows[0];
  await db.exec(`reset role; update profiles_worker set bid_credits=0 where id='${workerId}'; update jobs set status='cancelled'`);
  await actor(db);
  const retry = (await db.query(submitSql, args())).rows[0];
  assert.equal(retry.bid_id, first.bid_id);
  assert.equal(retry.created, false);
  assert.deepEqual(await state(db), { credits: 0, bids: 1, notifications: 1 });
});

test('failure at insert OR debit rolls back the whole operation, including notification', async () => {
  for (const table of ['bids', 'profiles_worker']) {
    await resetBidData(db);
    await db.exec(`create or replace function force_test_failure() returns trigger language plpgsql as
      $$begin raise exception 'forced_failure'; end;$$;
      create trigger force_failure before ${table === 'bids' ? 'insert' : 'update'} on ${table}
      for each row execute function force_test_failure();`);
    try {
      await actor(db);
      await assert.rejects(db.query(submitSql, args()), { message: 'forced_failure' });
      assert.deepEqual(await state(db), { credits: 5, bids: 0, notifications: 0 });
    } finally {
      await db.exec(`reset role; drop trigger force_failure on ${table}; drop function force_test_failure()`);
    }
  }
});

test('browser cannot bypass debit, spend another balance or reset system fields', async () => {
  await actor(db);
  for (const sql of [
    `insert into bids(job_id,worker_id,comment) values ('${jobId}','${workerId}','direct REST bypass')`,
    `select spend_bid_credit('${otherId}')`,
    `select grant_bid_credits('${workerId}', 10)`,
    `update profiles_worker set bid_credits=1000 where id='${workerId}'`,
    `update profiles_worker set verified=true where id='${workerId}'`,
    `delete from profiles_worker where id='${workerId}'`,
  ]) await assert.rejects(db.query(sql), { code: '42501' });
  await actor(db, null, 'anon');
  await assert.rejects(db.query(submitSql, args()), { code: '42501' });
  await actor(db, null);
  await assert.rejects(db.query(submitSql, args()), { message: 'not_authenticated' });
  assert.deepEqual(await state(db), { credits: 5, bids: 0, notifications: 0 });
});

test('ordinary profile upsert preserves balance; trusted top-up increments it', async () => {
  await actor(db);
  await db.query(submitSql, args());
  await db.query(`insert into profiles_worker(id,bio) values ($1,'Updated biography')
    on conflict(id) do update set id=excluded.id,bio=excluded.bio`, [workerId]);
  await actor(db, null, 'service_role');
  const { rows } = await db.query('select grant_bid_credits($1, $2) as balance', [workerId, 10]);
  assert.equal(rows[0].balance, 14);
  for (const amount of [0, -10, 1001]) {
    await assert.rejects(db.query('select grant_bid_credits($1,$2)', [workerId, amount]), { message: 'invalid_amount' });
  }
  assert.deepEqual(await state(db), { credits: 14, bids: 1, notifications: 1 });
});

test('atomic migration is repeatable and does not reset existing credits', async () => {
  await actor(db);
  await db.query(submitSql, args());
  await db.exec('reset role');
  await db.exec(atomicSql);
  assert.deepEqual(await state(db), { credits: 4, bids: 1, notifications: 1 });
});

async function actionHarness({ user = workerId, rpcError = null } = {}) {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const vm = await import('node:vm');
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  function compile(file, resolveImport) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: resolveImport,
      console: { error() {} }, process: { env: {} } });
    return compiledModule.exports;
  }
  const domain = compile('../src/lib/bids.ts', require);
  const calls = { rpc: 0, notifications: 0, paths: [] };
  const session = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
    rpc: async (name, params) => {
      assert.equal(name, 'submit_bid');
      assert.equal('p_worker_id' in params, false);
      calls.rpc++;
      if (rpcError) return { data: null, error: rpcError };
      try {
        const { rows } = await db.query(submitSql, [params.p_job_id, params.p_price, params.p_comment, params.p_start_date]);
        return { data: rows, error: null };
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
    },
    from: (table) => {
      assert.equal(table, 'jobs', 'Action must never directly insert bids or update credits');
      calls.notifications++;
      const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null }) };
      return chain;
    },
  };
  const imports = {
    '@/lib/bids': domain,
    '@/lib/supabase/server': { createClient: async () => session },
    '@/lib/supabase/admin': { createAdminClient: () => { throw new Error('No external services in tests'); } },
    '@/lib/telegram': { sendTelegramMessage: () => { throw new Error('No messages in tests'); } },
    'next/cache': { revalidatePath: path => calls.paths.push(path) },
  };
  return { calls, createBid: compile('../src/app/actions/createBid.ts', (name) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }).createBid };
}
const input = { jobId, price: 500, comment: 'Ready to repair this', startDate: '', locale: 'ru' };

test('actual server action uses one RPC and does not notify again on retry', async () => {
  await actor(db);
  const { createBid, calls } = await actionHarness();
  const first = await createBid(input), retry = await createBid(input);
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(retry.ok, true);
  assert.equal(retry.created, false);
  assert.equal(first.bidId, retry.bidId);
  assert.equal(calls.rpc, 2);
  assert.equal(calls.notifications, 1);
  assert.ok(calls.paths.includes('/ru/account/worker'));
  assert.deepEqual(await state(db), { credits: 4, bids: 1, notifications: 1 });
});

test('action returns expected failures without exposing production error internals', async () => {
  await actor(db);
  const { createBid, calls } = await actionHarness();
  for (const bad of [{ ...input, price: Infinity }, { ...input, jobId: 'wrong' }, { ...input, locale: 'xx' },
    { ...input, startDate: '2026-02-31' }, { ...input, comment: 'short' }]) {
    assert.equal((await createBid(bad)).error, 'invalid_input');
  }
  assert.equal(calls.rpc, 0);
  const guest = await actionHarness({ user: null });
  assert.equal((await guest.createBid(input)).error, 'not_authenticated');
  assert.equal(guest.calls.rpc, 0);
  const unavailable = await actionHarness({ rpcError: { code: 'PGRST202', message: 'Internal schema information' } });
  assert.equal((await unavailable.createBid(input)).error, 'temporarily_unavailable');
  await db.exec(`reset role; update profiles_worker set bid_credits=0 where id='${workerId}'`);
  await actor(db);
  assert.equal((await createBid(input)).error, 'no_credits');
  assert.deepEqual(await state(db), { credits: 0, bids: 0, notifications: 0 });
});
