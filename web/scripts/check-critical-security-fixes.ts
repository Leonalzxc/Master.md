import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function assertIncludes(content: string, needle: string, label: string) {
  if (!content.includes(needle)) {
    throw new Error(`Missing invariant: ${label}`);
  }
}

function assertNotIncludes(content: string, needle: string, label: string) {
  if (content.includes(needle)) {
    throw new Error(`Unexpected unsafe pattern: ${label}`);
  }
}

const migration = read('supabase/migrations/012_harden_critical_workflows.sql');

for (const [needle, label] of [
  ['drop policy if exists "bids_worker_insert"', 'direct bid inserts are disabled'],
  ['drop policy if exists "client_update_bids_on_own_jobs"', 'direct bid status updates are disabled'],
  ['drop policy if exists "reviews_auth_insert"', 'direct review inserts are disabled'],
  ['drop policy if exists "notif_insert_any"', 'direct notification spoofing is disabled'],
  ['role in (\'client\', \'worker\')', 'self-profile updates cannot grant admin'],
  ['create trigger trg_enforce_worker_system_fields', 'worker system fields are trigger protected'],
  ['create trigger trg_enforce_jobs_user_fields', 'job status/selection fields are trigger protected'],
  ['create or replace function public.create_bid', 'atomic bid creation RPC exists'],
  ['create or replace function public.select_worker_for_job', 'atomic worker selection RPC exists'],
  ['create or replace function public.complete_job_with_review', 'atomic review completion RPC exists'],
  ['create or replace function public.admin_add_bid_credits', 'admin credit RPC exists'],
  ['revoke all on function public.spend_bid_credit(uuid) from authenticated', 'legacy credit spend RPC is not client-callable'],
] as const) {
  assertIncludes(migration, needle, label);
}

const createBid = read('src/app/actions/createBid.ts');
assertIncludes(createBid, ".rpc('create_bid'", 'createBid action uses atomic RPC');
assertNotIncludes(createBid, ".rpc('spend_bid_credit'", 'createBid action no longer spends credits separately');
assertNotIncludes(createBid, ".from('bids') as any).insert", 'createBid action no longer directly inserts bids');

const selectWorker = read('src/app/actions/selectWorker.ts');
assertIncludes(selectWorker, ".rpc('select_worker_for_job'", 'selectWorker action uses atomic RPC');
assertNotIncludes(selectWorker, ".update({ status: 'selected' })", 'selectWorker action no longer directly updates selected bid');
assertNotIncludes(selectWorker, 'selected_worker_id: _workerId', 'selectWorker action does not trust client worker id');

const submitReview = read('src/app/actions/submitReview.ts');
assertIncludes(submitReview, ".rpc('complete_job_with_review'", 'submitReview action uses atomic RPC');
assertNotIncludes(submitReview, ".from('reviews') as any).insert", 'submitReview action no longer directly inserts reviews');
assertNotIncludes(submitReview, ".update({ status: 'done' })", 'submitReview action no longer directly marks jobs done');

const adminActions = read('src/app/actions/adminActions.ts');
assertIncludes(adminActions, ".rpc('admin_add_bid_credits'", 'admin credit action uses authorized RPC');
assertNotIncludes(adminActions, 'bid_credits: current + amount', 'admin credit action no longer read-modify-writes credits');

console.log('Critical security invariants verified.');
