-- ============================================================
-- MASTER Moldova — Notifications
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Table ────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('new_bid', 'bid_accepted', 'job_completed')),
  title      text not null,
  body       text not null,
  payload    jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread
  on public.notifications(user_id, read, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.notifications enable row level security;

create policy "notif_own_read"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notif_own_update"
  on public.notifications for update
  using (user_id = auth.uid());

-- Allow triggers (running as SECURITY DEFINER) to insert
create policy "notif_insert_any"
  on public.notifications for insert
  with check (true);

-- ── Enable Realtime ──────────────────────────────────────────
-- Run this separately if not already done:
-- alter publication supabase_realtime add table public.notifications;

-- ── Trigger: new bid → notify client ─────────────────────────
create or replace function public.notify_new_bid()
returns trigger language plpgsql security definer as $$
declare
  v_client_id   uuid;
  v_worker_name text;
  v_job_category text;
begin
  -- get job owner
  select client_id, category
    into v_client_id, v_job_category
    from public.jobs
   where id = NEW.job_id;

  -- get worker name
  select coalesce(name, 'Мастер')
    into v_worker_name
    from public.profiles
   where id = NEW.worker_id;

  insert into public.notifications (user_id, type, title, body, payload)
  values (
    v_client_id,
    'new_bid',
    'Новый отклик',
    v_worker_name || ' откликнулся на вашу заявку',
    jsonb_build_object(
      'job_id',    NEW.job_id,
      'bid_id',    NEW.id,
      'worker_id', NEW.worker_id,
      'category',  v_job_category
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_new_bid_notify on public.bids;
create trigger trg_new_bid_notify
  after insert on public.bids
  for each row execute function public.notify_new_bid();

-- ── Trigger: job in_progress → notify worker ─────────────────
create or replace function public.notify_bid_accepted()
returns trigger language plpgsql security definer as $$
declare
  v_worker_id uuid;
begin
  -- only fires when status changes to in_progress
  if NEW.status <> 'in_progress' or OLD.status = 'in_progress' then
    return NEW;
  end if;

  -- find the selected worker via winning bid
  select worker_id into v_worker_id
    from public.bids
   where job_id = NEW.id and status = 'selected'
   limit 1;

  -- fallback: selected_worker_id column
  if v_worker_id is null then
    v_worker_id := NEW.selected_worker_id;
  end if;

  if v_worker_id is null then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, title, body, payload)
  values (
    v_worker_id,
    'bid_accepted',
    'Ваш отклик принят',
    'Заказчик выбрал вас. Можно приступать к работе!',
    jsonb_build_object(
      'job_id',   NEW.id,
      'category', NEW.category
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_bid_accepted_notify on public.jobs;
create trigger trg_bid_accepted_notify
  after update on public.jobs
  for each row execute function public.notify_bid_accepted();

-- ── Trigger: job done → notify worker ────────────────────────
create or replace function public.notify_job_completed()
returns trigger language plpgsql security definer as $$
declare
  v_worker_id uuid;
begin
  if NEW.status <> 'done' or OLD.status = 'done' then
    return NEW;
  end if;

  select worker_id into v_worker_id
    from public.bids
   where job_id = NEW.id and status = 'selected'
   limit 1;

  if v_worker_id is null then
    v_worker_id := NEW.selected_worker_id;
  end if;

  if v_worker_id is null then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, title, body, payload)
  values (
    v_worker_id,
    'job_completed',
    'Работа завершена',
    'Заказчик завершил заявку и оставил отзыв',
    jsonb_build_object(
      'job_id',   NEW.id,
      'category', NEW.category
    )
  );

  return NEW;
end;
$$;

drop trigger if exists trg_job_completed_notify on public.jobs;
create trigger trg_job_completed_notify
  after update on public.jobs
  for each row execute function public.notify_job_completed();
