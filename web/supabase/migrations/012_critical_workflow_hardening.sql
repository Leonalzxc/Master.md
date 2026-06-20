-- Critical workflow/RLS hardening for profiles, bids, jobs, reviews, and notifications.

-- The app writes `title` when publishing jobs; keep existing databases compatible.
alter table public.jobs
  add column if not exists title text;

-- ---------------------------------------------------------------------------
-- Shared auth helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.blocked_at is null
  );
$$;

create or replace function public.is_active_user(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.blocked_at is null
  );
$$;

create or replace function public.is_trusted_db_context()
returns boolean
language sql
stable
as $$
  select current_user not in ('anon', 'authenticated')
    or auth.role() = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- Profiles: users may manage normal profile fields and switch client/worker,
-- but cannot create/admin-promote or unblock themselves.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_own_insert" on public.profiles;
create policy "profiles_own_insert" on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role in ('client', 'worker')
    and blocked_at is null
    and block_reason is null
  );

drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid() and public.is_active_user(auth.uid()))
  with check (id = auth.uid() and role in ('client', 'worker'));

drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read" on public.profiles
  for select
  using (public.current_user_is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_profile_protected_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_trusted_db_context() or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid()
      or new.role = 'admin'
      or new.blocked_at is not null
      or new.block_reason is not null then
      raise exception 'profile_protected_fields';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile_id_immutable';
  end if;

  if old.role = 'admin' or new.role = 'admin'
    or new.blocked_at is distinct from old.blocked_at
    or new.block_reason is distinct from old.block_reason then
    raise exception 'profile_protected_fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_protected_fields on public.profiles;
create trigger trg_guard_profile_protected_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_protected_fields();

-- ---------------------------------------------------------------------------
-- Worker profiles: public fields are self-managed; credits/trust/rating fields
-- are changed only by admins or trusted database functions.
-- ---------------------------------------------------------------------------
drop policy if exists "worker_own_write" on public.profiles_worker;
drop policy if exists "worker_own_insert" on public.profiles_worker;
drop policy if exists "worker_own_update" on public.profiles_worker;
drop policy if exists "worker_admin_read" on public.profiles_worker;
drop policy if exists "worker_admin_update" on public.profiles_worker;

create policy "worker_own_insert" on public.profiles_worker
  for insert
  with check (id = auth.uid() and public.is_active_user(auth.uid()));

create policy "worker_own_update" on public.profiles_worker
  for update
  using (id = auth.uid() and public.is_active_user(auth.uid()))
  with check (id = auth.uid());

create policy "worker_admin_read" on public.profiles_worker
  for select
  using (public.current_user_is_admin());

create policy "worker_admin_update" on public.profiles_worker
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_worker_protected_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_trusted_db_context() or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid()
      or coalesce(new.is_pro, false) is distinct from false
      or new.pro_until is not null
      or coalesce(new.bid_credits, 5) is distinct from 5
      or coalesce(new.rating_avg, 0) is distinct from 0
      or coalesce(new.rating_count, 0) is distinct from 0
      or coalesce(new.verified, false) is distinct from false then
      raise exception 'worker_protected_fields';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'worker_id_immutable';
  end if;

  if new.is_pro is distinct from old.is_pro
    or new.pro_until is distinct from old.pro_until
    or new.bid_credits is distinct from old.bid_credits
    or new.rating_avg is distinct from old.rating_avg
    or new.rating_count is distinct from old.rating_count
    or new.verified is distinct from old.verified then
    raise exception 'worker_protected_fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_worker_protected_fields on public.profiles_worker;
create trigger trg_guard_worker_protected_fields
  before insert or update on public.profiles_worker
  for each row execute function public.guard_worker_protected_fields();

-- ---------------------------------------------------------------------------
-- Jobs: direct client updates may cancel active jobs, but worker selection and
-- completion must go through validated RPCs below.
-- ---------------------------------------------------------------------------
drop policy if exists "jobs_own_insert" on public.jobs;
create policy "jobs_own_insert" on public.jobs
  for insert
  with check (client_id = auth.uid() and public.is_active_user(auth.uid()));

drop policy if exists "jobs_own_update" on public.jobs;
create policy "jobs_own_update" on public.jobs
  for update
  using (client_id = auth.uid() and public.is_active_user(auth.uid()))
  with check (client_id = auth.uid());

drop policy if exists "jobs_admin_read" on public.jobs;
create policy "jobs_admin_read" on public.jobs
  for select
  using (public.current_user_is_admin());

drop policy if exists "jobs_admin_update" on public.jobs;
create policy "jobs_admin_update" on public.jobs
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_job_workflow_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_trusted_db_context() or public.current_user_is_admin() then
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'job_client_immutable';
  end if;

  if new.selected_worker_id is distinct from old.selected_worker_id then
    raise exception 'job_workflow_requires_rpc';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'active' and new.status = 'cancelled' then
      return new;
    end if;

    raise exception 'job_workflow_requires_rpc';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_job_workflow_fields on public.jobs;
create trigger trg_guard_job_workflow_fields
  before update on public.jobs
  for each row execute function public.guard_job_workflow_fields();

-- ---------------------------------------------------------------------------
-- Bids: direct inserts bypass credits, so bid creation is RPC-only.
-- ---------------------------------------------------------------------------
drop policy if exists "bids_worker_insert" on public.bids;
drop policy if exists "client_update_bids_on_own_jobs" on public.bids;

create or replace function public.spend_bid_credit(p_worker_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if p_worker_id is distinct from auth.uid() then
    return false;
  end if;

  select bid_credits into v_credits
  from public.profiles_worker
  where id = p_worker_id
  for update;

  if v_credits is null or v_credits < 1 then
    return false;
  end if;

  update public.profiles_worker
  set bid_credits = bid_credits - 1
  where id = p_worker_id;

  return true;
end;
$$;

revoke execute on function public.spend_bid_credit(uuid) from public, anon, authenticated;

create or replace function public.create_bid(
  p_job_id uuid,
  p_price numeric,
  p_comment text,
  p_start_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid := auth.uid();
  v_bid_id uuid;
  v_credits integer;
  v_job record;
begin
  if v_worker_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_worker_id
      and p.role = 'worker'
      and p.blocked_at is null
  ) then
    raise exception 'not_worker';
  end if;

  select j.id, j.status, j.expires_at
    into v_job
    from public.jobs j
   where j.id = p_job_id
   for share;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.status <> 'active' or v_job.expires_at <= now() then
    raise exception 'job_not_active';
  end if;

  select pw.bid_credits
    into v_credits
    from public.profiles_worker pw
   where pw.id = v_worker_id
   for update;

  if v_credits is null or v_credits < 1 then
    raise exception 'no_credits';
  end if;

  if exists (
    select 1
    from public.bids b
    where b.job_id = p_job_id and b.worker_id = v_worker_id
  ) then
    raise exception 'already_bid';
  end if;

  update public.profiles_worker
     set bid_credits = bid_credits - 1
   where id = v_worker_id;

  insert into public.bids (job_id, worker_id, price, comment, start_date, status)
  values (p_job_id, v_worker_id, p_price, trim(p_comment), p_start_date, 'sent')
  returning id into v_bid_id;

  return v_bid_id;
end;
$$;

revoke execute on function public.create_bid(uuid, numeric, text, date) from public, anon;
grant execute on function public.create_bid(uuid, numeric, text, date) to authenticated;

create or replace function public.select_worker_for_job(
  p_job_id uuid,
  p_bid_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_job record;
  v_bid record;
begin
  if v_client_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_active_user(v_client_id) then
    raise exception 'not_authorized';
  end if;

  select *
    into v_job
    from public.jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'not_authorized';
  end if;

  if v_job.client_id is distinct from v_client_id then
    raise exception 'not_authorized';
  end if;

  if v_job.status <> 'active' then
    raise exception 'invalid_status';
  end if;

  select *
    into v_bid
    from public.bids
   where id = p_bid_id and job_id = p_job_id
   for update;

  if not found then
    raise exception 'bid_not_found';
  end if;

  if v_bid.status <> 'sent' then
    raise exception 'invalid_bid_status';
  end if;

  update public.bids
     set status = case when id = p_bid_id then 'selected' else 'rejected' end
   where job_id = p_job_id;

  update public.jobs
     set status = 'in_progress',
         selected_worker_id = v_bid.worker_id
   where id = p_job_id;

  return v_bid.worker_id;
end;
$$;

revoke execute on function public.select_worker_for_job(uuid, uuid) from public, anon;
grant execute on function public.select_worker_for_job(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reviews: fake direct reviews are disabled; completion and rating updates are
-- performed atomically.
-- ---------------------------------------------------------------------------
drop policy if exists "reviews_auth_insert" on public.reviews;

create or replace function public.complete_job_with_review(
  p_job_id uuid,
  p_rating integer,
  p_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_job record;
  v_worker_id uuid;
  v_avg numeric;
  v_count integer;
begin
  if v_client_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  if not public.is_active_user(v_client_id) then
    raise exception 'not_authorized';
  end if;

  select *
    into v_job
    from public.jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.client_id is distinct from v_client_id then
    raise exception 'not_authorized';
  end if;

  if v_job.status <> 'in_progress' then
    raise exception 'invalid_status';
  end if;

  if v_job.selected_worker_id is null then
    raise exception 'no_worker_selected';
  end if;

  v_worker_id := v_job.selected_worker_id;

  if exists (
    select 1
    from public.reviews r
    where r.job_id = p_job_id and r.author_id = v_client_id
  ) then
    raise exception 'already_reviewed';
  end if;

  insert into public.reviews (job_id, author_id, worker_id, rating, text)
  values (p_job_id, v_client_id, v_worker_id, p_rating, nullif(trim(p_text), ''));

  update public.jobs
     set status = 'done'
   where id = p_job_id;

  select avg(rating)::numeric, count(*)::integer
    into v_avg, v_count
    from public.reviews
   where worker_id = v_worker_id;

  update public.profiles_worker
     set rating_avg = round(v_avg, 1),
         rating_count = v_count
   where id = v_worker_id;

  return v_worker_id;
end;
$$;

revoke execute on function public.complete_job_with_review(uuid, integer, text) from public, anon;
grant execute on function public.complete_job_with_review(uuid, integer, text) to authenticated;

-- Trigger-owned notification writes bypass RLS; clients should not insert them.
drop policy if exists "notif_insert_any" on public.notifications;
