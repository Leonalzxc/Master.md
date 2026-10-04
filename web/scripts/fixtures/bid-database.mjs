import { readFileSync } from 'node:fs';

export const clientId = '10000000-0000-4000-8000-000000000001';
export const workerId = '10000000-0000-4000-8000-000000000002';
export const otherId = '10000000-0000-4000-8000-000000000003';
export const jobId = '20000000-0000-4000-8000-000000000001';
export const secondJobId = '20000000-0000-4000-8000-000000000002';
export const atomicSql = readFileSync(new URL('../../supabase/migrations/202609240001_atomic_bid_submission.sql', import.meta.url), 'utf8');
const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

// Only synthetic data. Caller supplies an isolated PGlite or dedicated test DB.
export async function setupBidDatabase(db) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, phone text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create function auth.role() returns text language sql stable as
      $$select nullif(current_setting('request.jwt.claim.role', true), '')$$;
    grant usage on schema auth, public to anon, authenticated, service_role;
  `);
  await db.exec(migration('001_init_schema.sql').split('-- ── Seed data')[0]
    .replace('create extension if not exists "pgcrypto";', ''));
  await db.exec(`alter table profiles add column telegram_chat_id bigint;
    alter table profiles_worker add column verification_submitted_at timestamptz;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant insert (job_id,worker_id,comment) on bids to authenticated;
    grant update(bid_credits), insert(bid_credits) on profiles_worker to authenticated;`);
  for (const name of ['006_notifications.sql', '008_fix_bids_rls.sql', '010_fix_jobs_rls.sql',
    '011_bid_credits_and_admin.sql', '013_fix_profiles_rls.sql', '202609230001_profile_contact_privacy.sql']) {
    await db.exec(migration(name));
  }
  await db.exec(atomicSql);
}

export async function resetBidData(db) {
  await db.exec(`reset role;
    select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);
    truncate profiles, auth.users cascade;
    insert into auth.users values
      ('${clientId}', '37360000001'), ('${workerId}', '37360000002'), ('${otherId}', '37360000003');
    insert into profiles(id,phone,name,role) values
      ('${clientId}','+37360000001','Test client','client'),
      ('${workerId}','+37360000002','Test worker','worker'),
      ('${otherId}','+37360000003','Other worker','worker');
    insert into profiles_worker(id) values ('${workerId}'),('${otherId}');
    insert into jobs(id,client_id,description,category,city,area) values
      ('${jobId}','${clientId}','Test electrical work','electric','Бельцы','Центр'),
      ('${secondJobId}','${clientId}','Second test job','electric','Бельцы','Центр');`);
}

export async function actor(db, id = workerId, role = 'authenticated') {
  if (!['authenticated','anon','service_role'].includes(role)) throw new Error('Invalid fixture role');
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [id ?? '', role]);
  await db.exec(`set role ${role}`);
}
export const submitSql = 'select * from public.submit_bid($1,$2,$3,$4)';
export const args = (job = jobId) => [job, 500, 'I can do this repair', null];
export async function state(db) {
  await db.exec('reset role');
  const { rows: [row] } = await db.query(`select
    (select bid_credits from profiles_worker where id='${workerId}') as credits,
    (select count(*)::int from bids where worker_id='${workerId}') as bids,
    (select count(*)::int from notifications where user_id='${clientId}' and type='new_bid') as notifications`);
  return row;
}
