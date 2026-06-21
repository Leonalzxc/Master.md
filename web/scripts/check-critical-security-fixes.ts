import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

function assertInvariant(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const migration = read('supabase/migrations/012_critical_workflow_hardening.sql');
const createBid = read('src/app/actions/createBid.ts');
const selectWorker = read('src/app/actions/selectWorker.ts');
const submitReview = read('src/app/actions/submitReview.ts');
const adminActions = read('src/app/actions/adminActions.ts');
const authPage = read('src/app/[locale]/auth/page.tsx');
const authForm = read('src/components/features/AuthForm.tsx');

assertInvariant(
  migration.includes('ADD COLUMN IF NOT EXISTS title text'),
  'jobs.title migration is required for createJob inserts',
);
assertInvariant(
  migration.includes('CREATE OR REPLACE FUNCTION public.current_user_is_admin()') &&
    migration.includes('SECURITY DEFINER'),
  'admin checks must use a SECURITY DEFINER helper to avoid recursive profile RLS',
);
assertInvariant(
  migration.includes('CREATE TRIGGER trg_protect_profile_fields') &&
    migration.includes("NEW.role := OLD.role") &&
    migration.includes('NEW.blocked_at := OLD.blocked_at'),
  'profile trigger must prevent self-admin and self-unblock updates',
);
assertInvariant(
  migration.includes('CREATE TRIGGER trg_protect_worker_system_fields') &&
    migration.includes("current_setting('app.bypass_worker_system_fields', true) = 'on'") &&
    migration.includes('NEW.bid_credits := OLD.bid_credits') &&
    migration.includes('NEW.verified := OLD.verified') &&
    migration.includes('NEW.rating_avg := OLD.rating_avg'),
  'worker trigger must preserve credit, verification, and rating fields',
);
assertInvariant(
  migration.includes('DROP POLICY IF EXISTS "bids_worker_insert"') &&
    migration.includes('DROP POLICY IF EXISTS "reviews_auth_insert"') &&
    migration.includes('DROP POLICY IF EXISTS "notif_insert_any"'),
  'direct bid, review, and notification writes must not remain publicly available',
);
assertInvariant(
  migration.includes('DROP FUNCTION IF EXISTS public.spend_bid_credit(uuid)'),
  'caller-supplied spend_bid_credit RPC must be removed',
);
assertInvariant(
  /CREATE OR REPLACE FUNCTION public\.create_bid\([\s\S]*v_worker_id uuid := auth\.uid\(\)[\s\S]*FOR UPDATE[\s\S]*already_bid[\s\S]*set_config\('app\.bypass_worker_system_fields'[\s\S]*bid_credits = bid_credits - 1/.test(migration),
  'create_bid must bind to auth.uid, lock rows, detect duplicates, and decrement credits atomically through the trusted bypass',
);
assertInvariant(
  /CREATE OR REPLACE FUNCTION public\.select_worker_for_job\([\s\S]*SELECT worker_id[\s\S]*job_id = p_job_id[\s\S]*selected_worker_id = v_worker_id/.test(migration),
  'select_worker_for_job must derive the worker from the selected bid',
);
assertInvariant(
  /CREATE OR REPLACE FUNCTION public\.complete_job_with_review\([\s\S]*status <> 'in_progress'[\s\S]*INSERT INTO public\.reviews[\s\S]*set_config\('app\.bypass_worker_system_fields'[\s\S]*rating_avg = stats\.avg_rating/.test(migration),
  'complete_job_with_review must atomically insert reviews, complete jobs, and update ratings through the trusted bypass',
);

assertInvariant(createBid.includes("rpc('create_bid'"), 'createBid action must use create_bid RPC');
assertInvariant(!createBid.includes('spend_bid_credit'), 'createBid action must not call spend_bid_credit');
assertInvariant(
  selectWorker.includes("rpc('select_worker_for_job'") && !selectWorker.includes('selected_worker_id: workerId'),
  'selectWorker action must not trust browser-supplied worker ids',
);
assertInvariant(
  submitReview.includes("rpc('complete_job_with_review'") && !submitReview.includes(".from('reviews')"),
  'submitReview action must use complete_job_with_review RPC',
);
assertInvariant(
  adminActions.includes("rpc('admin_add_bid_credits'"),
  'admin credit grants must use the atomic admin_add_bid_credits RPC',
);
assertInvariant(
  authPage.includes("!next.startsWith('//')") && authForm.includes("!next.startsWith('//')"),
  'auth next redirect sanitizer must reject protocol-relative URLs',
);

console.log('Critical security invariants passed');
