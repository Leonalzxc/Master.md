import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertContains(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing invariant: ${label}`);
  }
}

function assertNotContains(haystack: string, needle: string, label: string) {
  if (haystack.includes(needle)) {
    throw new Error(`Forbidden pattern remains: ${label}`);
  }
}

const migration = read('supabase/migrations/012_critical_workflow_hardening.sql');
const createBid = read('src/app/actions/createBid.ts');
const selectWorker = read('src/app/actions/selectWorker.ts');
const submitReview = read('src/app/actions/submitReview.ts');
const adminActions = read('src/app/actions/adminActions.ts');
const authPage = read('src/app/[locale]/auth/page.tsx');
const authForm = read('src/components/features/AuthForm.tsx');

[
  ['CREATE POLICY "profiles_own_insert"', 'profiles own insert policy is replaced'],
  ['role IN (\'client\', \'worker\')', 'self-insert/update cannot grant admin'],
  ['prevent_worker_system_field_changes', 'worker system-field trigger exists'],
  ['prevent_unsafe_job_changes', 'job workflow trigger exists'],
  ['DROP POLICY IF EXISTS "bids_worker_insert"', 'direct bid insert policy is removed'],
  ['DROP POLICY IF EXISTS "client_update_bids_on_own_jobs"', 'direct bid status update policy is removed'],
  ['DROP POLICY IF EXISTS "reviews_auth_insert"', 'direct review insert policy is removed'],
  ['DROP POLICY IF EXISTS "notif_insert_any"', 'direct notification insert policy is removed'],
  ['CREATE OR REPLACE FUNCTION public.create_bid', 'atomic create_bid RPC exists'],
  ['CREATE OR REPLACE FUNCTION public.select_worker_for_job', 'atomic select_worker_for_job RPC exists'],
  ['CREATE OR REPLACE FUNCTION public.complete_job_with_review', 'atomic complete_job_with_review RPC exists'],
  ['CREATE OR REPLACE FUNCTION public.admin_add_bid_credits', 'trusted admin credit RPC exists'],
  ['auth.uid() <> p_worker_id', 'legacy spend_bid_credit binds caller to worker id'],
  ['j.status = \'active\'', 'bid/selection RPCs check active job status'],
  ['j.expires_at > now()', 'bid RPC blocks expired jobs'],
  ['b.job_id = p_job_id', 'selection RPC binds bid to job'],
].forEach(([needle, label]) => assertContains(migration, needle, label));

assertContains(createBid, ".rpc('create_bid'", 'createBid action calls atomic RPC');
assertNotContains(createBid, ".from('bids')", 'createBid action no longer inserts bids directly');

assertContains(selectWorker, ".rpc('select_worker_for_job'", 'selectWorker action calls atomic RPC');
assertNotContains(selectWorker, ".from('bids') as any).update", 'selectWorker action no longer updates bids directly');
assertNotContains(selectWorker, "selected_worker_id: workerId", 'selectWorker action no longer trusts client worker id');

assertContains(submitReview, ".rpc('complete_job_with_review'", 'submitReview action calls atomic RPC');
assertNotContains(submitReview, ".from('reviews') as any).insert", 'submitReview action no longer inserts reviews directly');
assertNotContains(submitReview, ".from('jobs') as any).update({ status: 'done' })", 'submitReview action no longer marks jobs done separately');

assertContains(adminActions, ".rpc('admin_add_bid_credits'", 'adminActions uses trusted credit RPC');

for (const [source, label] of [
  [authPage, 'auth page'],
  [authForm, 'auth form'],
] as const) {
  assertContains(source, "next.startsWith('//')", `${label} rejects protocol-relative redirects`);
  assertContains(source, "next.includes('\\\\')", `${label} rejects backslash redirects`);
}

console.log('Critical security invariants are present.');
