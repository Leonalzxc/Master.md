import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function assertContains(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const migration = read('supabase/migrations/012_critical_workflow_security_fixes.sql');
const createBid = read('src/app/actions/createBid.ts');
const selectWorker = read('src/app/actions/selectWorker.ts');
const submitReview = read('src/app/actions/submitReview.ts');

[
  ['CREATE OR REPLACE FUNCTION public.protect_profile_fields()', 'profile field guard'],
  ['NEW.role = \'admin\'', 'self-admin block'],
  ['CREATE OR REPLACE FUNCTION public.protect_worker_system_fields()', 'worker system field guard'],
  ['NEW.bid_credits IS DISTINCT FROM OLD.bid_credits', 'bid credit tamper block'],
  ['CREATE OR REPLACE FUNCTION public.current_user_is_blocked()', 'blocked user helper'],
  ['DROP POLICY IF EXISTS "bids_worker_insert"', 'direct bid insert removal'],
  ['DROP POLICY IF EXISTS "client_update_bids_on_own_jobs"', 'direct bid update removal'],
  ['DROP POLICY IF EXISTS "reviews_auth_insert"', 'direct review insert removal'],
  ['DROP POLICY IF EXISTS "notif_insert_any"', 'direct notification insert removal'],
  ['CREATE POLICY "worker_admin_update"', 'admin worker update policy'],
  ['CREATE POLICY "jobs_own_insert"', 'blocked user job insert guard'],
  ['CREATE POLICY "jobs_own_cancel"', 'restricted direct job update policy'],
  ['CREATE OR REPLACE FUNCTION public.create_bid(', 'atomic bid RPC'],
  ['FOR UPDATE OF pw', 'credit row lock'],
  ['EXCEPTION WHEN unique_violation', 'duplicate bid rollback path'],
  ['CREATE OR REPLACE FUNCTION public.select_worker_for_job(', 'atomic worker selection RPC'],
  ['AND job_id = p_job_id', 'selected bid belongs to job'],
  ['selected_worker_id = v_worker_id', 'worker selected from bid row'],
  ['CREATE OR REPLACE FUNCTION public.complete_job_with_review(', 'atomic review completion RPC'],
  ['IF EXISTS (SELECT 1 FROM public.reviews WHERE job_id = p_job_id)', 'duplicate review guard'],
].forEach(([needle, label]) => assertContains(migration, needle, label));

assertContains(createBid, ".rpc('create_bid'", 'createBid action RPC wiring');
assertContains(selectWorker, ".rpc('select_worker_for_job'", 'selectWorker action RPC wiring');
assertContains(selectWorker, 'selectedWorkerId as string | null', 'selectWorker returned worker id usage');
assertContains(submitReview, ".rpc('complete_job_with_review'", 'submitReview action RPC wiring');

console.log('Critical security fix checks passed');
