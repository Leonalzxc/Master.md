-- ============================================================
-- MASTER Moldova — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  role          text not null default 'client' check (role in ('client','worker','admin')),
  name          text,
  city          text,
  created_at    timestamptz default now() not null,
  blocked_at    timestamptz,
  block_reason  text
);

-- ── Worker profiles ──────────────────────────────────────────
create table if not exists public.profiles_worker (
  id              uuid primary key references public.profiles(id) on delete cascade,
  categories      text[] not null default '{}',
  areas           text[] not null default '{}',
  experience_yrs  int,
  bio             text,
  photos          text[],
  viber           text,
  telegram        text,
  whatsapp        text,
  is_pro          boolean not null default false,
  pro_until       timestamptz,
  bid_credits     int not null default 5,
  rating_avg      numeric(3,2) not null default 0,
  rating_count    int not null default 0,
  verified        boolean not null default false,
  completed_at    timestamptz
);

-- ── Jobs ─────────────────────────────────────────────────────
create table if not exists public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.profiles(id) on delete cascade,
  description         text not null,
  category            text not null,
  city                text not null,
  area                text not null,
  budget_min          numeric,
  budget_max          numeric,
  urgent              boolean not null default false,
  needs_quote         boolean not null default false,
  photos              text[],
  status              text not null default 'active'
                        check (status in ('active','in_progress','done','cancelled','blocked')),
  selected_worker_id  uuid references public.profiles(id),
  created_at          timestamptz default now() not null,
  expires_at          timestamptz default now() + interval '30 days' not null
);

-- ── Bids ─────────────────────────────────────────────────────
create table if not exists public.bids (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  worker_id   uuid not null references public.profiles(id) on delete cascade,
  price       numeric,
  price_max   numeric,
  comment     text not null,
  start_date  date,
  status      text not null default 'sent'
                check (status in ('sent','selected','rejected')),
  created_at  timestamptz default now() not null,
  unique (job_id, worker_id)
);

-- ── Reviews ──────────────────────────────────────────────────
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  worker_id   uuid not null references public.profiles(id),
  rating      int not null check (rating between 1 and 5),
  text        text,
  created_at  timestamptz default now() not null,
  unique (job_id, author_id)
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists jobs_status_created on public.jobs(status, created_at desc);
create index if not exists jobs_category       on public.jobs(category);
create index if not exists jobs_city           on public.jobs(city);
create index if not exists bids_job_id         on public.bids(job_id);
create index if not exists bids_worker_id      on public.bids(worker_id);
create index if not exists reviews_worker_id   on public.reviews(worker_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.profiles_worker  enable row level security;
alter table public.jobs             enable row level security;
alter table public.bids             enable row level security;
alter table public.reviews          enable row level security;

-- Profiles: public read, own write
create policy "profiles_public_read"  on public.profiles for select using (true);
create policy "profiles_own_insert"   on public.profiles for insert with check (true);
create policy "profiles_own_update"   on public.profiles for update using (id = auth.uid());

-- Worker profiles: public read, own write
create policy "worker_public_read"    on public.profiles_worker for select using (true);
create policy "worker_own_write"      on public.profiles_worker for all using (id = auth.uid());

-- Jobs: active jobs visible to all; own jobs always visible
create policy "jobs_active_read"  on public.jobs for select
  using (status = 'active' or client_id = auth.uid());
create policy "jobs_own_insert"   on public.jobs for insert
  with check (client_id = auth.uid());
create policy "jobs_own_update"   on public.jobs for update
  using (client_id = auth.uid());

-- Bids: worker sees own bids; client sees bids on own jobs
create policy "bids_worker_read" on public.bids for select
  using (worker_id = auth.uid());
create policy "bids_client_read" on public.bids for select
  using (exists (
    select 1 from public.jobs where jobs.id = bids.job_id and jobs.client_id = auth.uid()
  ));
create policy "bids_worker_insert" on public.bids for insert
  with check (
    worker_id = auth.uid()
    and exists (
      select 1 from public.profiles_worker pw
      where pw.id = auth.uid() and pw.completed_at is not null
    )
  );

-- Reviews: public read, authenticated insert
create policy "reviews_public_read"  on public.reviews for select using (true);
create policy "reviews_auth_insert"  on public.reviews for insert with check (author_id = auth.uid());

-- ── Seed data (demo) ─────────────────────────────────────────
-- Временные тестовые данные без auth (анонимный доступ для разработки)
-- УДАЛИ после настройки реального Auth

-- Test client
insert into public.profiles (id, phone, role, name, city)
values
  ('00000000-0000-0000-0000-000000000001', '+37369000001', 'client', 'Тест Заказчик', 'Кишинёв'),
  ('00000000-0000-0000-0000-000000000002', '+37369000002', 'worker', 'Андрей Мирча', 'Кишинёв'),
  ('00000000-0000-0000-0000-000000000003', '+37369000003', 'worker', 'Ion Popescu', 'Кишинёв'),
  ('00000000-0000-0000-0000-000000000004', '+37369000004', 'worker', 'Виктор Руссу', 'Кишинёв'),
  ('00000000-0000-0000-0000-000000000005', '+37369000005', 'worker', 'Mihail Sîrbu', 'Кишинёв')
on conflict (phone) do nothing;

-- Worker profiles
insert into public.profiles_worker (id, categories, areas, bio, is_pro, verified, bid_credits, rating_avg, rating_count, completed_at)
values
  ('00000000-0000-0000-0000-000000000002', array['electric','minorRepairs'], array['Центр','Ботаника','Рышкановка'],
   'Электрик с 12 годами опыта. Квартиры, офисы. Работаю с материалом и без.', true, true, 50, 4.9, 47, now()),
  ('00000000-0000-0000-0000-000000000003', array['plumbing','finishing'], array['Ботаника','Чеканы','Буюканы'],
   'Santehnic și finisaje. Experiență 8 ani. Calitate garantată.', false, true, 5, 4.7, 31, now()),
  ('00000000-0000-0000-0000-000000000004', array['tiling','finishing'], array['Центр','Рышкановка','Телецентр'],
   'Плитка, ламинат, штукатурка. Аккуратная работа, соблюдение сроков.', true, true, 50, 4.8, 23, now()),
  ('00000000-0000-0000-0000-000000000005', array['furniture','minorRepairs'], array['Любой район'],
   'Сборка мебели любой сложности. IKEA, Jysk, корпусная мебель на заказ.', true, true, 50, 4.9, 63, now())
on conflict (id) do nothing;

-- Test jobs
insert into public.jobs (id, client_id, description, category, city, area, budget_min, budget_max, urgent, needs_quote)
values
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Нужно полностью заменить проводку в 3-комнатной квартире. Штробы сделаны. Нужен материал + работа или только работа.',
   'electric', 'Кишинёв', 'Центр', 5000, 8000, false, true),
  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Срочно! Течёт труба под ванной, нужно устранить течь. Дом кирпичный, трубы советские.',
   'plumbing', 'Кишинёв', 'Ботаника', null, null, true, false),
  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'Нужно уложить плитку на кухне (фартук). Размер 3м × 0.8м. Плитка уже куплена.',
   'tiling', 'Кишинёв', 'Рышкановка', 1500, 2500, false, false),
  ('10000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'Сборка шкафа PAX (3 секции) и кровати HEMNES. Всё привезено, нужна только сборка.',
   'furniture', 'Кишинёв', 'Чеканы', 400, 600, false, false)
on conflict (id) do nothing;

-- Test bids
insert into public.bids (job_id, worker_id, price, price_max, comment, start_date, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   5500, 7000, 'Приеду осмотреть бесплатно. Работаю с материалом, срок 2–3 дня.', '2026-05-10', 'sent'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
   4800, null, 'Опыт 8 лет. Работаю аккуратно, убираю за собой.', '2026-05-12', 'sent'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   350, null, 'Могу приехать сегодня до 18:00. Скорее всего замена участка трубы, 1–2 часа.', '2026-05-07', 'selected'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
   1800, null, 'Специализируюсь на плитке. Выполню ровно и аккуратно.', '2026-05-11', 'sent'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005',
   450, null, 'PAX + HEMNES соберу за 2.5–3 часа. Работаю с IKEA более 5 лет.', '2026-05-08', 'sent')
on conflict do nothing;

-- Test reviews
insert into public.reviews (job_id, author_id, worker_id, rating, text)
values
  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003',
   5, 'Ion a rezolvat rapid problema cu țeava. Foarte serios și curat în lucru.')
on conflict do nothing;
