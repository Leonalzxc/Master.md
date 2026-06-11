import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { safeRelativeRedirect } from '../src/lib/utils/redirect';

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  join(here, '../supabase/migrations/012_critical_security_fixes.sql'),
  'utf8',
);

assert.equal(safeRelativeRedirect('/ru/account', '/fallback'), '/ru/account');
assert.equal(safeRelativeRedirect('//evil.example', '/fallback'), '/fallback');
assert.equal(safeRelativeRedirect('/%2F%2Fevil.example', '/fallback'), '/fallback');
assert.equal(safeRelativeRedirect('https://evil.example', '/fallback'), '/fallback');

for (const fragment of [
  'admin_role_not_allowed',
  'protect_worker_system_fields',
  'p_worker_id IS DISTINCT FROM auth.uid()',
  'CREATE POLICY "bids_worker_insert_disabled"',
  'CREATE OR REPLACE FUNCTION public.create_bid_with_credit',
  'CREATE OR REPLACE FUNCTION public.select_worker_for_job',
  'CREATE POLICY "client_update_bids_on_own_jobs_disabled"',
  'CREATE POLICY "reviews_auth_insert"',
  'DROP POLICY IF EXISTS "notif_insert_any"',
]) {
  assert.ok(migration.includes(fragment), `missing migration guardrail: ${fragment}`);
}

console.log('critical security checks passed');
