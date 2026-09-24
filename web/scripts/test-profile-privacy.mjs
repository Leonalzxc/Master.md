// Runs PostgreSQL permissions/RLS tests in an isolated in-memory database.
// Never loads .env or connects to Supabase. See docs/profile-privacy-rollout.md.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { PGlite } = process.env.PGLITE_MODULE_PATH
  ? await import(process.env.PGLITE_MODULE_PATH)
  : await import('@electric-sql/pglite');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const db = new PGlite();
const client = '10000000-0000-4000-8000-000000000001';
const worker = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const fresh = '10000000-0000-4000-8000-000000000004';
const job = '20000000-0000-4000-8000-000000000001';
const migration = readFileSync(resolve(root, 'supabase/migrations/202609230001_profile_contact_privacy.sql'), 'utf8');

async function actor(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [id ?? '', role]);
  await db.exec(`set role ${role}`);
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, phone text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create function auth.role() returns text language sql stable as
      $$select nullif(current_setting('request.jwt.claim.role', true), '')$$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.role() to public;
  `);
  const schema = readFileSync(resolve(root, 'supabase/migrations/001_init_schema.sql'), 'utf8')
    .split('-- ── Seed data')[0].replace('create extension if not exists "pgcrypto";', '');
  await db.exec(schema);
  for (const file of ['005_jobs_location.sql', '006_notifications.sql',
    '011_bid_credits_and_admin.sql', '013_fix_profiles_rls.sql', '012_auto_expire_and_notify.sql']) {
    await db.exec(readFileSync(resolve(root, 'supabase/migrations', file), 'utf8'));
  }
  await db.exec(`
    alter table profiles add column telegram_chat_id bigint;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant select(phone) on profiles to anon;
    insert into auth.users values
      ('${client}', '37360000001'), ('${worker}', '37360000002'),
      ('${other}', '37360000003'), ('${fresh}', '37360000004');
    insert into profiles(id,phone,name,role,telegram_chat_id) values
      ('${client}', '+37360000001', 'Test customer', 'client', 111),
      ('${worker}', '+37360000002', 'Test worker', 'worker', 222),
      ('${other}', '+37360000003', 'Other worker', 'worker', 333);
    insert into profiles_worker(id) values ('${worker}'), ('${other}');
    insert into jobs(id,client_id,description,category,city,area,status,selected_worker_id)
      values ('${job}', '${client}', 'Example repair description', 'electric', 'Бельцы', 'Центр', 'in_progress', '${worker}');
    insert into bids(job_id,worker_id,comment,status) values
      ('${job}', '${worker}', 'Accepted test bid', 'selected'),
      ('${job}', '${other}', 'Another test bid', 'sent');
  `);
  await db.exec(migration);
});
after(async () => db.close());

test('anonymous catalog and joins remain readable without private fields', async () => {
  await actor(null, 'anon');
  const result = await db.query('select p.id,p.name,p.role,p.city,p.created_at,p.blocked_at,w.rating_avg from profiles p left join profiles_worker w on w.id=p.id');
  assert.equal(result.rows.length, 3);
});

test('anonymous direct, wildcard, joined and filtered contact reads are denied', async () => {
  await actor(null, 'anon');
  for (const sql of [
    'select phone from profiles', 'select telegram_chat_id from profiles',
    'select * from profiles', 'select p.phone from profiles p join profiles_worker w on w.id=p.id',
    "select id from profiles where phone='+37360000001'",
    'select * from get_my_profile()', `select * from get_job_client_contact('${job}')`,
  ]) await assert.rejects(db.query(sql), { code: '42501' });
});

test('authenticated account receives only its own private profile', async () => {
  await actor(worker);
  const { rows } = await db.query('select * from get_my_profile()');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, worker);
  assert.equal(rows[0].telegram_chat_id, 222);
  assert.equal((await db.query(`select * from get_my_profile() where id='${client}'`)).rows.length, 0);
  await assert.rejects(db.query('select phone from profiles'), { code: '42501' });
});

test('selected bidder gets only name and phone for the agreed job', async () => {
  await actor(worker);
  assert.deepEqual((await db.query(`select * from get_job_client_contact('${job}')`)).rows,
    [{ name: 'Test customer', phone: '+37360000001' }]);
  await actor(other);
  assert.equal((await db.query(`select * from get_job_client_contact('${job}')`)).rows.length, 0);
  await actor(client);
  assert.equal((await db.query(`select * from get_job_client_contact('${job}')`)).rows.length, 0);
});

test('closed job, mismatched bid and blocked actor do not reveal contacts', async () => {
  for (const [change, restore] of [
    ["update jobs set status='done'", "update jobs set status='in_progress'"],
    ["update bids set status='sent' where status='selected'", `update bids set status='selected' where worker_id='${worker}'`],
    [`update profiles set blocked_at=now() where id='${worker}'`, `update profiles set blocked_at=null where id='${worker}'`],
  ]) {
    await actor(null, 'service_role');
    await db.exec(change);
    await actor(worker);
    assert.equal((await db.query(`select * from get_job_client_contact('${job}')`)).rows.length, 0);
    await actor(null, 'service_role');
    await db.exec(restore);
  }
});

test('profile owner may switch client/worker but cannot become admin or rewrite contacts', async () => {
  await actor(worker);
  await db.exec(`update profiles set role='client',name='Updated worker' where id='${worker}'`);
  await db.exec(`update profiles set role='worker' where id='${worker}'`);
  for (const change of ["role='admin'", "phone='+37369999999'", 'telegram_chat_id=999', 'blocked_at=null']) {
    await assert.rejects(db.query(`update profiles set ${change} where id='${worker}'`), { code: '42501' });
  }
  await db.exec(`update profiles set name='Not allowed' where id='${client}'`);
  assert.equal((await db.query(`select name from profiles where id='${client}'`)).rows[0].name, 'Test customer');
});

test('registration is limited to own verified phone and ordinary role', async () => {
  await actor(fresh);
  for (const [id, phone, role] of [
    ['10000000-0000-4000-8000-000000000005', '+37360000004', 'client'],
    [fresh, '+37360000004', 'admin'], [fresh, '+37369999999', 'client'],
  ]) await assert.rejects(db.query('insert into profiles(id,phone,role) values ($1,$2,$3)', [id, phone, role]), { code: '42501' });
  await db.query('insert into profiles(id,phone,role) values ($1,$2,$3)', [fresh, '+37360000004', 'client']);
  assert.equal((await db.query('select * from get_my_profile()')).rows[0].id, fresh);
});

test('service notifications can still resolve Telegram IDs', async () => {
  await actor(null, 'service_role');
  assert.equal((await db.query(`select telegram_chat_id from profiles where id='${client}'`)).rows[0].telegram_chat_id, 111);
});

test('migration is repeatable and removes legacy per-column grants', async () => {
  await db.exec('reset role');
  await db.exec('grant select(phone) on profiles to anon');
  await db.exec(migration);
  await actor(null, 'anon');
  await assert.rejects(db.query('select phone from profiles'), { code: '42501' });
});

test('createJob action inserts against the real jobs schema without a title column', async () => {
  // Run the actual action; replace only network/framework dependencies. Execute
  // its generated INSERT in PostgreSQL so unknown columns cause a real failure.
  await actor(client);
  const ts = require('typescript');
  const source = readFileSync(resolve(root, 'src/app/actions/createJob.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  let inserted;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: client } } }) },
    from: (table) => {
      assert.equal(table, 'jobs');
      return { insert: (row) => ({ select: () => ({ single: async () => {
        const keys = Object.keys(row);
        const result = await db.query(`insert into jobs (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning id`, Object.values(row));
        inserted = result.rows[0].id;
        return { data: result.rows[0], error: null };
      } }) }) };
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: mod.exports, module: mod, process: { env: {} }, console: { error() {} },
    require: (name) => {
      if (name === 'next/navigation') return { redirect: (path) => { throw new Error('REDIRECT:' + path); } };
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name.endsWith('/supabase/server')) return { createClient: async () => supabase };
      if (name.endsWith('/supabase/admin')) return { createAdminClient: () => { throw new Error('Notifications disabled in test'); } };
      if (name.endsWith('/telegram')) return { sendTelegramMessage() { throw new Error('No external messages allowed'); } };
      if (name.endsWith('/mock/data')) return { CATEGORY_LABELS_RU: {} };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  await assert.rejects(mod.exports.createJob({
    category: 'electric', description: 'Real schema creation regression test',
    city: 'Бельцы', area: 'Центр', lat: null, lng: null, budget: '100',
    urgent: false, needsQuote: false, photos: [], locale: 'ru',
  }), /REDIRECT:\/ru\/jobs\//);
  assert.ok(inserted);
});
