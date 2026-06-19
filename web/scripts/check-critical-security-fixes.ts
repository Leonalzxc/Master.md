import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function assertIncludes(file: string, needle: string, description: string) {
  const content = read(file);
  if (!content.includes(needle)) {
    throw new Error(`${description} missing in ${file}`);
  }
}

const migration = 'supabase/migrations/012_harden_critical_workflows.sql';

assertIncludes(migration, 'add column if not exists title text', 'jobs.title schema alignment');
assertIncludes(migration, 'guard_profile_protected_fields', 'profile protected-field trigger');
assertIncludes(migration, "new.role = 'admin'", 'self-admin prevention');
assertIncludes(migration, 'guard_worker_protected_fields', 'worker protected-field trigger');
assertIncludes(migration, 'master.bypass_worker_guard', 'trusted worker-field update bypass');
assertIncludes(migration, 'new.bid_credits is distinct from old.bid_credits', 'bid-credit self-mint prevention');
assertIncludes(migration, 'revoke all on function public.spend_bid_credit(uuid) from authenticated', 'direct credit-spend RPC revoke');
assertIncludes(migration, 'create or replace function public.create_bid', 'atomic bid creation RPC');
assertIncludes(migration, "and status = 'active'", 'active-job validation');
assertIncludes(migration, 'and expires_at > now()', 'expired-job bid prevention');
assertIncludes(migration, 'drop policy if exists "bids_worker_insert"', 'direct bid insert removal');
assertIncludes(migration, 'create or replace function public.select_worker_for_job', 'atomic worker selection RPC');
assertIncludes(migration, 'and job_id = p_job_id', 'bid/job binding for selection');
assertIncludes(migration, 'drop policy if exists "reviews_auth_insert"', 'direct review insert removal');
assertIncludes(migration, 'create or replace function public.complete_job_with_review', 'atomic review completion RPC');
assertIncludes(migration, 'drop policy if exists "notif_insert_any"', 'notification spoofing prevention');

assertIncludes('src/app/actions/createBid.ts', ".rpc('create_bid'", 'createBid RPC use');
assertIncludes('src/app/actions/selectWorker.ts', ".rpc('select_worker_for_job'", 'selectWorker RPC use');
assertIncludes('src/app/actions/submitReview.ts', ".rpc('complete_job_with_review'", 'submitReview RPC use');
assertIncludes('src/app/[locale]/auth/page.tsx', "!next.startsWith('//')", 'server auth redirect sanitizer');
assertIncludes('src/components/features/AuthForm.tsx', "!next.startsWith('//')", 'client auth redirect sanitizer');

console.log('Critical security hardening checks passed.');
