-- ============================================================
-- Critical workflow hardening
-- ============================================================
-- Keep privileged state changes inside checked database functions.
-- Direct PostgREST calls must not be able to escalate roles, mint credits,
-- forge selections/reviews, or bypass moderation.

-- Align schema with createJob.ts and generated domain types.
alter table public.jobs
  add column if not exists title text;

update public.jobs
set title = left(description, 80)
where title is null;

alter table public.jobs
  alter column title set default '',
  alter column title set not null;

-- ----------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------
create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and blocked_at is null
  );
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
revoke all on function public.current_user_is_admin() from authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.current_user_is_blocked()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and blocked_at is not null
  );
$$;

revoke all on function public.current_user_is_blocked() from public;
revoke all on function public.current_user_is_blocked() from anon;
revoke all on function public.current_user_is_blocked() from authenticated;
grant execute on function public.current_user_is_blocked() to authenticated;

-- ----------------------------------------------------------------
-- Protected profile / worker fields
-- ----------------------------------------------------------------
drop policy if exists "profiles_own_insert" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_own_insert" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid() and not public.current_user_is_blocked())
  with check (id = auth.uid() and not public.current_user_is_blocked());

create policy "profiles_admin_update" on public.profiles
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_profile_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('master.bypass_worker_guard', true) = 'on'
     or public.current_user_is_admin() then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() then
    raise exception 'not_authorized';
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' or new.blocked_at is not null or new.block_reason is not null then
      raise exception 'protected_profile_fields';
    end if;
    return new;
  end if;

  if public.current_user_is_blocked()
     or new.id is distinct from old.id
     or new.phone is distinct from old.phone
     or new.blocked_at is distinct from old.blocked_at
     or new.block_reason is distinct from old.block_reason
     or new.role = 'admin' then
    raise exception 'protected_profile_fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_protected_fields on public.profiles;
create trigger trg_guard_profile_protected_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_protected_fields();

drop policy if exists "worker_own_write" on public.profiles_worker;
drop policy if exists "worker_own_insert" on public.profiles_worker;
drop policy if exists "worker_own_update" on public.profiles_worker;
drop policy if exists "worker_admin_update" on public.profiles_worker;

create policy "worker_own_insert" on public.profiles_worker
  for insert
  with check (id = auth.uid() and not public.current_user_is_blocked());

create policy "worker_own_update" on public.profiles_worker
  for update
  using (id = auth.uid() and not public.current_user_is_blocked())
  with check (id = auth.uid() and not public.current_user_is_blocked());

create policy "worker_admin_update" on public.profiles_worker
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_worker_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_is_admin() then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() or public.current_user_is_blocked() then
    raise exception 'not_authorized';
  end if;

  if tg_op = 'INSERT' then
    if new.is_pro is distinct from false
       or new.pro_until is not null
       or new.bid_credits is distinct from 5
       or new.rating_avg is distinct from 0
       or new.rating_count is distinct from 0
       or new.verified is distinct from false
       or new.completed_at is not null then
      raise exception 'protected_worker_fields';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.is_pro is distinct from old.is_pro
     or new.pro_until is distinct from old.pro_until
     or new.bid_credits is distinct from old.bid_credits
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.verified is distinct from old.verified
     or new.completed_at is distinct from old.completed_at then
    raise exception 'protected_worker_fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_worker_protected_fields on public.profiles_worker;
create trigger trg_guard_worker_protected_fields
  before insert or update on public.profiles_worker
  for each row execute function public.guard_worker_protected_fields();

-- ----------------------------------------------------------------
-- Jobs and bids: no direct forged state transitions
-- ----------------------------------------------------------------
drop policy if exists "jobs_own_insert" on public.jobs;
drop policy if exists "jobs_own_update" on public.jobs;
drop policy if exists "jobs_admin_update" on public.jobs;

create policy "jobs_own_insert" on public.jobs
  for insert
  with check (
    client_id = auth.uid()
    and status = 'active'
    and selected_worker_id is null
    and not public.current_user_is_blocked()
  );

create policy "jobs_own_update" on public.jobs
  for update
  using (client_id = auth.uid() and not public.current_user_is_blocked())
  with check (client_id = auth.uid() and not public.current_user_is_blocked());

create policy "jobs_admin_update" on public.jobs
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.guard_job_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('master.bypass_job_guard', true) = 'on'
     or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null
       or new.client_id is distinct from auth.uid()
       or public.current_user_is_blocked()
       or new.status is distinct from 'active'
       or new.selected_worker_id is not null then
      raise exception 'invalid_job_write';
    end if;
    return new;
  end if;

  if auth.uid() is null
     or old.client_id is distinct from auth.uid()
     or new.client_id is distinct from old.client_id
     or public.current_user_is_blocked() then
    raise exception 'not_authorized';
  end if;

  if old.status = 'active'
     and new.status = 'cancelled'
     and new.selected_worker_id is not distinct from old.selected_worker_id then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.selected_worker_id is distinct from old.selected_worker_id then
    raise exception 'invalid_job_transition';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_job_state on public.jobs;
create trigger trg_guard_job_state
  before insert or update on public.jobs
  for each row execute function public.guard_job_state();

drop policy if exists "bids_worker_insert" on public.bids;
drop policy if exists "client_update_bids_on_own_jobs" on public.bids;

create or replace function public.guard_bid_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('master.bypass_bid_guard', true) = 'on'
     or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'bid_updates_must_use_rpc';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_bid_state on public.bids;
create trigger trg_guard_bid_state
  before update on public.bids
  for each row execute function public.guard_bid_state();

-- Existing direct credit RPC must not be an unauthenticated cross-user primitive.
create or replace function public.spend_bid_credit(p_worker_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or p_worker_id is distinct from auth.uid()
     or public.current_user_is_blocked() then
    raise exception 'not_authorized';
  end if;

  perform set_config('master.bypass_worker_guard', 'on', true);

  update public.profiles_worker
  set bid_credits = bid_credits - 1
  where id = p_worker_id
    and bid_credits > 0;

  return found;
end;
$$;

revoke all on function public.spend_bid_credit(uuid) from public;
revoke all on function public.spend_bid_credit(uuid) from anon;
revoke all on function public.spend_bid_credit(uuid) from authenticated;

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
  v_user_id uuid := auth.uid();
  v_bid_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'worker'
      and blocked_at is null
  ) then
    raise exception 'not_worker';
  end if;

  if not exists (
    select 1
    from public.jobs
    where id = p_job_id
      and status = 'active'
      and expires_at > now()
  ) then
    raise exception 'job_not_available';
  end if;

  perform set_config('master.bypass_bid_guard', 'on', true);

  begin
    insert into public.bids (job_id, worker_id, price, comment, start_date, status)
    values (p_job_id, v_user_id, p_price, trim(p_comment), p_start_date, 'sent')
    returning id into v_bid_id;
  exception
    when unique_violation then
      raise exception 'already_bid' using errcode = '23505';
  end;

  perform set_config('master.bypass_worker_guard', 'on', true);

  update public.profiles_worker
  set bid_credits = bid_credits - 1
  where id = v_user_id
    and bid_credits > 0;

  if not found then
    raise exception 'no_credits';
  end if;

  return v_bid_id;
end;
$$;

revoke all on function public.create_bid(uuid, numeric, text, date) from public;
revoke all on function public.create_bid(uuid, numeric, text, date) from anon;
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
  v_user_id uuid := auth.uid();
  v_worker_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if public.current_user_is_blocked() then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.jobs
    where id = p_job_id
      and client_id = v_user_id
      and status = 'active'
    for update
  ) then
    raise exception 'job_not_selectable';
  end if;

  select worker_id
  into v_worker_id
  from public.bids
  where id = p_bid_id
    and job_id = p_job_id
    and status = 'sent';

  if v_worker_id is null then
    raise exception 'invalid_bid';
  end if;

  perform set_config('master.bypass_bid_guard', 'on', true);
  perform set_config('master.bypass_job_guard', 'on', true);

  update public.bids
  set status = 'selected'
  where id = p_bid_id;

  update public.bids
  set status = 'rejected'
  where job_id = p_job_id
    and id <> p_bid_id;

  update public.jobs
  set status = 'in_progress',
      selected_worker_id = v_worker_id
  where id = p_job_id;

  return v_worker_id;
end;
$$;

revoke all on function public.select_worker_for_job(uuid, uuid) from public;
revoke all on function public.select_worker_for_job(uuid, uuid) from anon;
grant execute on function public.select_worker_for_job(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------
-- Reviews: only job owners can complete selected in-progress jobs
-- ----------------------------------------------------------------
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
  v_user_id uuid := auth.uid();
  v_worker_id uuid;
  v_review_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  if public.current_user_is_blocked() then
    raise exception 'not_authorized';
  end if;

  select selected_worker_id
  into v_worker_id
  from public.jobs
  where id = p_job_id
    and client_id = v_user_id
    and status = 'in_progress'
  for update;

  if v_worker_id is null then
    raise exception 'job_not_reviewable';
  end if;

  begin
    insert into public.reviews (job_id, author_id, worker_id, rating, text)
    values (p_job_id, v_user_id, v_worker_id, p_rating, nullif(trim(p_text), ''))
    returning id into v_review_id;
  exception
    when unique_violation then
      raise exception 'already_reviewed' using errcode = '23505';
  end;

  perform set_config('master.bypass_job_guard', 'on', true);

  update public.jobs
  set status = 'done'
  where id = p_job_id;

  perform set_config('master.bypass_worker_guard', 'on', true);

  update public.profiles_worker pw
  set rating_avg = coalesce(stats.avg_rating, 0),
      rating_count = stats.review_count
  from (
    select round(avg(rating)::numeric, 1) as avg_rating,
           count(*)::int as review_count
    from public.reviews
    where worker_id = v_worker_id
  ) stats
  where pw.id = v_worker_id;

  return v_review_id;
end;
$$;

revoke all on function public.complete_job_with_review(uuid, integer, text) from public;
revoke all on function public.complete_job_with_review(uuid, integer, text) from anon;
grant execute on function public.complete_job_with_review(uuid, integer, text) to authenticated;

-- ----------------------------------------------------------------
-- Notifications are emitted by trusted triggers only.
-- ----------------------------------------------------------------
drop policy if exists "notif_insert_any" on public.notifications;
