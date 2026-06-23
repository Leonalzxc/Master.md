-- ============================================================
-- Harden critical job, bid-credit, review, and admin workflows
-- ============================================================

-- Small SECURITY DEFINER helpers avoid recursive profile RLS checks inside
-- policies while still binding decisions to the authenticated user.
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

create or replace function public.current_user_is_unblocked()
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
      and blocked_at is null
  );
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_unblocked() from public;
grant execute on function public.current_user_is_admin() to anon;
grant execute on function public.current_user_is_unblocked() to anon;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_is_unblocked() to authenticated;

-- Profiles: users may maintain their own public profile, but may not grant
-- themselves admin privileges or clear/set block state.
drop policy if exists "profiles_own_insert" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_own_insert" on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role in ('client', 'worker')
    and blocked_at is null
    and block_reason is null
  );

create policy "profiles_own_update" on public.profiles
  for update
  using (id = auth.uid() and public.current_user_is_unblocked())
  with check (
    id = auth.uid()
    and role in ('client', 'worker')
    and blocked_at is null
    and block_reason is null
  );

create policy "profiles_admin_update" on public.profiles
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Jobs: blocked users cannot continue mutating workflows, and direct client
-- updates are limited by the trigger below to ordinary cancellation.
drop policy if exists "jobs_own_insert" on public.jobs;
drop policy if exists "jobs_own_update" on public.jobs;
drop policy if exists "jobs_admin_read" on public.jobs;
drop policy if exists "jobs_admin_update" on public.jobs;

create policy "jobs_own_insert" on public.jobs
  for insert
  with check (client_id = auth.uid() and public.current_user_is_unblocked());

create policy "jobs_own_update" on public.jobs
  for update
  using (client_id = auth.uid() and public.current_user_is_unblocked())
  with check (client_id = auth.uid() and public.current_user_is_unblocked());

create policy "jobs_admin_read" on public.jobs
  for select
  using (public.current_user_is_admin());

create policy "jobs_admin_update" on public.jobs
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.enforce_jobs_user_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_job_system_fields', true) = 'on'
     or public.current_user_is_admin() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.status <> 'active' or NEW.selected_worker_id is not null then
      raise exception 'protected_job_fields' using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.client_id is distinct from OLD.client_id
       or NEW.selected_worker_id is distinct from OLD.selected_worker_id
       or (
         NEW.status is distinct from OLD.status
         and not (OLD.status = 'active' and NEW.status = 'cancelled')
       ) then
      raise exception 'protected_job_fields' using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_jobs_user_fields on public.jobs;
create trigger trg_enforce_jobs_user_fields
  before insert or update on public.jobs
  for each row execute function public.enforce_jobs_user_fields();

-- Worker profiles: app users can edit portfolio/contact data, but system
-- fields such as credits, verification, pro status, and ratings are only
-- changed through trusted RPCs below.
drop policy if exists "worker_own_write" on public.profiles_worker;

create policy "worker_own_insert" on public.profiles_worker
  for insert
  with check (id = auth.uid() and public.current_user_is_unblocked());

create policy "worker_own_update" on public.profiles_worker
  for update
  using (id = auth.uid() and public.current_user_is_unblocked())
  with check (id = auth.uid() and public.current_user_is_unblocked());

create or replace function public.enforce_worker_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_worker_system_fields', true) = 'on'
     or public.current_user_is_admin() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.is_pro is distinct from false
       or NEW.pro_until is not null
       or NEW.bid_credits is distinct from 5
       or NEW.rating_avg is distinct from 0
       or NEW.rating_count is distinct from 0
       or NEW.verified is distinct from false
       or NEW.completed_at is not null then
      raise exception 'protected_worker_fields' using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.is_pro is distinct from OLD.is_pro
       or NEW.pro_until is distinct from OLD.pro_until
       or NEW.bid_credits is distinct from OLD.bid_credits
       or NEW.rating_avg is distinct from OLD.rating_avg
       or NEW.rating_count is distinct from OLD.rating_count
       or NEW.verified is distinct from OLD.verified
       or NEW.completed_at is distinct from OLD.completed_at then
      raise exception 'protected_worker_fields' using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_worker_system_fields on public.profiles_worker;
create trigger trg_enforce_worker_system_fields
  before insert or update on public.profiles_worker
  for each row execute function public.enforce_worker_system_fields();

-- Direct bid/review/notification writes bypass critical invariants. Trusted
-- SECURITY DEFINER functions below are the only write path for these flows.
drop policy if exists "bids_worker_insert" on public.bids;
drop policy if exists "client_update_bids_on_own_jobs" on public.bids;
drop policy if exists "reviews_auth_insert" on public.reviews;
drop policy if exists "notif_insert_any" on public.notifications;

create or replace function public.spend_bid_credit(p_worker_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer;
begin
  if p_worker_id is distinct from auth.uid()
     or not public.current_user_is_unblocked() then
    return false;
  end if;

  perform set_config('app.bypass_worker_system_fields', 'on', true);

  update public.profiles_worker
  set bid_credits = bid_credits - 1
  where id = p_worker_id
    and bid_credits > 0;

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

revoke all on function public.spend_bid_credit(uuid) from public;
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
  v_worker_id uuid := auth.uid();
  v_bid_id uuid;
begin
  if v_worker_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_worker_id
      and role = 'worker'
      and blocked_at is null
  ) then
    raise exception 'not_worker' using errcode = '42501';
  end if;

  if length(coalesce(trim(p_comment), '')) < 10 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;

  perform 1
  from public.jobs
  where id = p_job_id
    and status = 'active'
    and expires_at > now()
    and client_id <> v_worker_id
  for update;

  if not found then
    raise exception 'invalid_job' using errcode = 'P0001';
  end if;

  perform set_config('app.bypass_worker_system_fields', 'on', true);

  update public.profiles_worker
  set bid_credits = bid_credits - 1
  where id = v_worker_id
    and bid_credits > 0;

  if not found then
    raise exception 'no_credits' using errcode = 'P0001';
  end if;

  insert into public.bids (job_id, worker_id, price, comment, start_date, status)
  values (p_job_id, v_worker_id, p_price, trim(p_comment), p_start_date, 'sent')
  returning id into v_bid_id;

  return v_bid_id;
end;
$$;

revoke all on function public.create_bid(uuid, numeric, text, date) from public;
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
  v_worker_id uuid;
begin
  if v_client_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform 1
  from public.jobs
  where id = p_job_id
    and client_id = v_client_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'invalid_job' using errcode = 'P0001';
  end if;

  select worker_id
  into v_worker_id
  from public.bids
  where id = p_bid_id
    and job_id = p_job_id
    and status = 'sent'
  for update;

  if v_worker_id is null then
    raise exception 'invalid_bid' using errcode = 'P0001';
  end if;

  update public.bids
  set status = 'rejected'
  where job_id = p_job_id
    and id <> p_bid_id
    and status <> 'rejected';

  update public.bids
  set status = 'selected'
  where id = p_bid_id;

  perform set_config('app.bypass_job_system_fields', 'on', true);

  update public.jobs
  set status = 'in_progress',
      selected_worker_id = v_worker_id
  where id = p_job_id;

  return v_worker_id;
end;
$$;

revoke all on function public.select_worker_for_job(uuid, uuid) from public;
grant execute on function public.select_worker_for_job(uuid, uuid) to authenticated;

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
  v_worker_id uuid;
  v_review_id uuid;
begin
  if v_client_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  select selected_worker_id
  into v_worker_id
  from public.jobs
  where id = p_job_id
    and client_id = v_client_id
    and status = 'in_progress'
  for update;

  if v_worker_id is null then
    raise exception 'invalid_job' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reviews where job_id = p_job_id) then
    raise exception 'already_reviewed' using errcode = '23505';
  end if;

  insert into public.reviews (job_id, author_id, worker_id, rating, text)
  values (p_job_id, v_client_id, v_worker_id, p_rating, nullif(trim(p_text), ''))
  returning id into v_review_id;

  perform set_config('app.bypass_job_system_fields', 'on', true);

  update public.jobs
  set status = 'done'
  where id = p_job_id;

  perform set_config('app.bypass_worker_system_fields', 'on', true);

  update public.profiles_worker pw
  set rating_avg = stats.rating_avg,
      rating_count = stats.rating_count
  from (
    select round(avg(rating)::numeric, 2) as rating_avg,
           count(*)::int as rating_count
    from public.reviews
    where worker_id = v_worker_id
  ) stats
  where pw.id = v_worker_id;

  return v_worker_id;
end;
$$;

revoke all on function public.complete_job_with_review(uuid, integer, text) from public;
grant execute on function public.complete_job_with_review(uuid, integer, text) to authenticated;

create or replace function public.admin_add_bid_credits(
  p_worker_id uuid,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 1000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  perform set_config('app.bypass_worker_system_fields', 'on', true);

  update public.profiles_worker
  set bid_credits = bid_credits + p_amount
  where id = p_worker_id
  returning bid_credits into v_credits;

  if v_credits is null then
    raise exception 'worker_not_found' using errcode = 'P0001';
  end if;

  return v_credits;
end;
$$;

revoke all on function public.admin_add_bid_credits(uuid, integer) from public;
grant execute on function public.admin_add_bid_credits(uuid, integer) to authenticated;
