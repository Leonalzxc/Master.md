import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(source.includes(expected), `${label}: expected to find "${expected}"`);
}

function assertNotIncludes(source: string, unexpected: string, label: string) {
  assert.ok(!source.includes(unexpected), `${label}: did not expect to find "${unexpected}"`);
}

const migration = read('supabase/migrations/012_critical_workflow_guards.sql');

assertIncludes(
  migration,
  'ADD COLUMN IF NOT EXISTS title text',
  'jobs schema must include title used by createJob',
);
assertIncludes(
  migration,
  'p_worker_id IS DISTINCT FROM auth.uid()',
  'spend_bid_credit must only debit the authenticated worker',
);
assertIncludes(
  migration,
  'CREATE OR REPLACE FUNCTION public.create_bid_with_credit',
  'bid creation must use an atomic RPC',
);
assertIncludes(
  migration,
  'AND j.expires_at > now()',
  'bid creation must reject expired jobs',
);
assertIncludes(
  migration,
  'REVOKE INSERT, UPDATE ON TABLE public.bids FROM anon, authenticated;',
  'browser clients must not bypass bid-credit spending',
);
const createBidFunction = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.create_bid_with_credit'),
  migration.indexOf('REVOKE INSERT, UPDATE ON TABLE public.bids FROM anon, authenticated;'),
);
assert.ok(
  createBidFunction.indexOf('INSERT INTO public.bids') <
    createBidFunction.indexOf('SET bid_credits = bid_credits - 1'),
  'bid credit decrement must happen after the bid insert inside the same transaction',
);

assertIncludes(
  migration,
  'CREATE OR REPLACE FUNCTION public.select_worker_for_job',
  'worker selection must use an integrity-checking RPC',
);
assertIncludes(migration, 'AND b.job_id = p_job_id', 'selected bid must belong to selected job');
assertIncludes(migration, 'AND b.worker_id = p_worker_id', 'selected bid must belong to selected worker');

assertIncludes(
  migration,
  'DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;',
  'authenticated clients must not be able to spoof notifications',
);
assertIncludes(
  migration,
  'REVOKE INSERT ON TABLE public.notifications FROM anon, authenticated;',
  'browser clients must not insert notifications directly',
);
assertIncludes(
  migration,
  'REVOKE INSERT ON TABLE public.reviews FROM anon, authenticated;',
  'browser clients must not bypass transactional review submission',
);
assertIncludes(
  migration,
  'CREATE TRIGGER trg_refresh_worker_rating',
  'worker ratings must be maintained by the database',
);
assertIncludes(
  migration,
  "role IN ('client', 'worker')",
  'self profile writes must not allow admin role assignment',
);
assertIncludes(
  migration,
  'REVOKE INSERT, UPDATE ON TABLE public.profiles_worker FROM anon, authenticated;',
  'worker profile system fields need column grants',
);

const workerUpdateGrant = migration.match(/GRANT UPDATE\s+\(([^)]*)\)\s+ON TABLE public\.profiles_worker/)?.[1] ?? '';
for (const protectedColumn of ['bid_credits', 'rating_avg', 'rating_count', 'is_pro', 'verified', 'completed_at']) {
  assertNotIncludes(workerUpdateGrant, protectedColumn, `worker profile grant must not expose ${protectedColumn}`);
}

const createBid = read('src/app/actions/createBid.ts');
assertIncludes(createBid, ".rpc('create_bid_with_credit'", 'createBid action must call atomic RPC');
assertNotIncludes(createBid, ".from('bids')", 'createBid action must not insert bids directly');

const selectWorker = read('src/app/actions/selectWorker.ts');
assertIncludes(selectWorker, ".rpc('select_worker_for_job'", 'selectWorker action must call validated RPC');
assertNotIncludes(selectWorker, ".from('bids')", 'selectWorker action must not update bids directly');

const submitReview = read('src/app/actions/submitReview.ts');
assertIncludes(submitReview, ".rpc('submit_review_for_job'", 'submitReview action must call transactional RPC');
assertNotIncludes(submitReview, ".from('reviews')", 'submitReview action must not insert reviews directly');

const adminActions = read('src/app/actions/adminActions.ts');
assertIncludes(adminActions, ".rpc('set_user_blocked'", 'admin block/unblock must use privileged RPC');
assertIncludes(adminActions, ".rpc('admin_add_bid_credits'", 'admin credit grants must use privileged RPC');

const authPage = read('src/app/[locale]/auth/page.tsx');
assertIncludes(authPage, "!next.startsWith('//')", 'server auth redirect must reject protocol-relative URLs');

const authForm = read('src/components/features/AuthForm.tsx');
assertIncludes(authForm, "!next.startsWith('//')", 'client auth redirect must reject protocol-relative URLs');

for (const guardedAction of [
  'src/app/actions/createJob.ts',
  'src/app/actions/cancelJob.ts',
  'src/app/actions/updateProfile.ts',
]) {
  assertIncludes(read(guardedAction), 'requireActiveUser', `${guardedAction} must reject blocked users`);
}

console.log('Critical security workflow checks passed.');
