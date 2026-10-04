-- Generated pilot release. Review schema and backup first. Deploy with matching frontend.
-- All six changes commit together; failure rolls back grants, functions and data.
-- Existing rows/balances are retained; no initial seed is included.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
DO $preflight$ BEGIN
 IF to_regprocedure('public.spend_bid_credit(uuid)') IS NULL
    OR to_regprocedure('public.is_admin(uuid)') IS NULL
    OR to_regprocedure('public.worker_has_bid_on_job(uuid,uuid)') IS NULL THEN
   RAISE EXCEPTION 'Missing legacy prerequisite functions: inspect schema; do not rerun seed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='payload')
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='telegram_chat_id')
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles_worker' AND column_name='verification_submitted_at') THEN
   RAISE EXCEPTION 'Missing prerequisite columns: inspect schema before release';
 END IF;
END $preflight$;

-- Source: 202609230001_profile_contact_privacy.sql; SHA256: c714159ac23df80cfe16eaa7bbc4f6c4e948f819ce5b09f161866b8dcdf2beb9
-- Deploy together with the profile RPC readers in the application.
-- No rows or contact values are removed. See docs/profile-privacy-rollout.md.


-- RLS restricts rows, not columns. Public table SELECT used to expose phone,
-- telegram_chat_id and any newly added private fields, including in joins.
revoke all privileges on table public.profiles from public, anon, authenticated;
do $permissions$
declare
  cols text;
begin
  select string_agg(quote_ident(attname), ', ')
    into cols from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  -- Remove any earlier column grants as well as the table grants above.
  execute format(
    'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on public.profiles from public, anon, authenticated', cols
  );
end
$permissions$;

grant select (id, name, role, city, created_at, blocked_at)
  on public.profiles to anon, authenticated;
grant insert (id, phone, name, role, city) on public.profiles to authenticated;
grant update (name, role, city) on public.profiles to authenticated;

-- Column UPDATE still permits switching client/worker. It must not permit
-- granting oneself admin and then using the service-role admin interface.
create or replace function public.guard_profile_identity()
returns trigger
language plpgsql security definer set search_path = '' as $function$
declare
  auth_phone text;
begin
  if auth.role() in ('anon', 'authenticated') then
    if auth.uid() is null or new.id is distinct from auth.uid() then
      raise exception 'Profile owner mismatch' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      if new.role not in ('client', 'worker') then
        raise exception 'Invalid registration role' using errcode = '42501';
      end if;
      select u.phone into auth_phone from auth.users u where u.id = auth.uid();
      if auth_phone is null or
         regexp_replace(new.phone, '[^0-9]', '', 'g') is distinct from
         regexp_replace(auth_phone, '[^0-9]', '', 'g') then
        raise exception 'Phone must match verified identity' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role and
          (new.role = 'admin' or old.role = 'admin') then
      raise exception 'Admin role is not user-editable' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.guard_profile_identity() from public, anon, authenticated;
drop trigger if exists profile_identity_guard on public.profiles;
create trigger profile_identity_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_identity();

-- No user-supplied UUID: callers can only read their own complete profile.
create or replace function public.get_my_profile()
returns setof public.profiles
language sql stable security definer set search_path = '' as $function$
  select p.* from public.profiles p
  where auth.uid() is not null and p.id = auth.uid();
$function$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Reveal only the customer's phone, only to the actual selected bidder.
-- Telegram IDs and unrelated profile fields never leave this function.
create or replace function public.get_job_client_contact(p_job_id uuid)
returns table (name text, phone text)
language sql stable security definer set search_path = '' as $function$
  select p.name, p.phone
  from public.jobs j
  join public.profiles p on p.id = j.client_id
  join public.profiles actor on actor.id = auth.uid()
  where j.id = p_job_id
    and auth.uid() is not null
    and j.selected_worker_id = auth.uid()
    and j.client_id <> auth.uid()
    and j.status = 'in_progress'
    and p.blocked_at is null and actor.blocked_at is null
    and exists (
      select 1 from public.bids b
      where b.job_id = j.id and b.worker_id = auth.uid() and b.status = 'selected'
    );
$function$;
revoke all on function public.get_job_client_contact(uuid) from public, anon;
grant execute on function public.get_job_client_contact(uuid) to authenticated;

notify pgrst, 'reload schema';



-- Source: 202609240001_atomic_bid_submission.sql; SHA256: 6cf4e7844329c15313da0eaf6258c59746786cb063d45a050c0a188ec8f40a3c
-- Apply after 003, 006, 008, 011, 013 and 202609230001.
-- Coordinate with the frontend release: older code cannot insert bids directly.


-- No browser may spend someone else's credit or insert an uncharged bid.
REVOKE EXECUTE ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.bids FROM PUBLIC, anon, authenticated;

-- A worker may edit their profile, but not mint credits, set verification/rating,
-- or delete/recreate the worker row to obtain another starting balance.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles_worker FROM PUBLIC, anon, authenticated;
DO $grants$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
    WHERE attrelid = 'public.bids'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s) ON public.bids FROM PUBLIC, anon, authenticated', cols);
  SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
    WHERE attrelid = 'public.profiles_worker'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.profiles_worker FROM PUBLIC, anon, authenticated', cols);
END;
$grants$;
GRANT INSERT (id, categories, areas, experience_yrs, bio, photos, viber, telegram, whatsapp, verification_submitted_at),
      UPDATE (id, categories, areas, experience_yrs, bio, photos, viber, telegram, whatsapp, verification_submitted_at)
  ON public.profiles_worker TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_bid(
  p_job_id uuid, p_price numeric, p_comment text, p_start_date date DEFAULT NULL
)
RETURNS TABLE (bid_id uuid, created boolean, credits_remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  target public.jobs%ROWTYPE;
  actor public.profiles%ROWTYPE;
  existing_id uuid;
  balance integer;
  new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_price IS NULL OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_price <= 0 OR p_price > 1000000000
     OR p_comment IS NULL OR char_length(btrim(p_comment)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Serializes retries on one job, including concurrent select/cancel/expire.
  SELECT * INTO target FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_unavailable'; END IF;
  IF target.client_id = actor_id THEN RAISE EXCEPTION 'own_job'; END IF;

  -- Prevent a concurrent block/role change from taking effect mid-operation.
  PERFORM id FROM public.profiles WHERE id IN (actor_id, target.client_id) ORDER BY id FOR SHARE;
  SELECT * INTO actor FROM public.profiles WHERE id = actor_id;
  IF NOT FOUND OR actor.role <> 'worker' THEN RAISE EXCEPTION 'not_worker'; END IF;
  IF actor.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'account_blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target.client_id AND blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  -- Serializes the last credit across different jobs for the same worker.
  SELECT bid_credits INTO balance FROM public.profiles_worker WHERE id = actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_worker'; END IF;
  SELECT id INTO existing_id FROM public.bids WHERE job_id = p_job_id AND worker_id = actor_id;
  IF FOUND THEN
    RETURN QUERY SELECT existing_id, false, balance;
    RETURN;
  END IF;

  IF target.status <> 'active' OR target.expires_at <= now() THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;
  IF p_start_date IS NOT NULL AND p_start_date < current_date THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF balance < 1 THEN RAISE EXCEPTION 'no_credits'; END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
    VALUES (p_job_id, actor_id, p_price, btrim(p_comment), p_start_date, 'sent') RETURNING id INTO new_id;
  UPDATE public.profiles_worker SET bid_credits = bid_credits - 1 WHERE id = actor_id
    RETURNING bid_credits INTO balance;
  -- A trigger/constraint failure rolls back BOTH the bid and balance change.
  RETURN QUERY SELECT new_id, true, balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_bid(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bid(uuid, numeric, text, date) TO authenticated;

-- Admin top-ups must use an increment too: read-then-write can erase a debit
-- committed between those two requests. Authentication is in the admin action.
CREATE OR REPLACE FUNCTION public.grant_bid_credits(p_worker_id uuid, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $grant$
DECLARE balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  UPDATE public.profiles_worker SET bid_credits = bid_credits + p_amount
    WHERE id = p_worker_id RETURNING bid_credits INTO balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'worker_not_found'; END IF;
  RETURN balance;
END;
$grant$;
REVOKE ALL ON FUNCTION public.grant_bid_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bid_credits(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';



-- Source: 202610040001_job_workflow.sql; SHA256: c4fda9751ebd312ffc1e0428739ed05ef5895b187e221946dab2617f6218cd2e
-- Upgrade after 202609230001 and 202609240001. No rows are deleted.


-- All state transitions go through actor-aware transactional functions.
REVOKE UPDATE, DELETE ON public.jobs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.bids FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon, authenticated;
DO $acl$
DECLARE tab text; cols text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['jobs','bids','reviews','notifications'] LOOP
    SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
      WHERE attrelid = format('public.%I', tab)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE UPDATE (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, tab);
    IF tab IN ('reviews','notifications') THEN
      EXECUTE format('REVOKE INSERT (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, tab);
    END IF;
  END LOOP;
END;
$acl$;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- This old helper can exist in deployed databases with another notification schema.
DO $old_rpc$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc
    WHERE pronamespace='public'::regnamespace AND proname='create_notification'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f); END LOOP;
END;
$old_rpc$;

CREATE OR REPLACE FUNCTION public.select_job_worker(p_job_id uuid, p_bid_id uuid)
RETURNS TABLE(worker_id uuid, changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $select$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE; b public.bids%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN
    RAISE EXCEPTION 'account_blocked';
  END IF;
  SELECT * INTO b FROM public.bids WHERE id=p_bid_id AND job_id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_bid'; END IF;
  IF j.status IN ('in_progress','done') AND j.selected_worker_id=b.worker_id AND b.status='selected' THEN
    RETURN QUERY SELECT b.worker_id,false; RETURN;
  END IF;
  IF j.status<>'active' OR j.expires_at<=now() OR b.status<>'sent' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM id FROM public.profiles WHERE id=b.worker_id FOR SHARE;
  IF b.worker_id=actor_id OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=b.worker_id AND role='worker' AND blocked_at IS NULL) THEN RAISE EXCEPTION 'invalid_bid'; END IF;
  UPDATE public.bids SET status=CASE WHEN id=p_bid_id THEN 'selected' ELSE 'rejected' END WHERE job_id=p_job_id;
  UPDATE public.jobs SET status='in_progress',selected_worker_id=b.worker_id WHERE id=p_job_id;
  RETURN QUERY SELECT b.worker_id,true;
END;
$select$;

CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $cancel$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN RAISE EXCEPTION 'account_blocked'; END IF;
  IF j.status='cancelled' THEN RETURN false; END IF;
  IF j.status<>'active' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.bids SET status='rejected' WHERE job_id=p_job_id AND status='sent';
  UPDATE public.jobs SET status='cancelled' WHERE id=p_job_id;
  RETURN true;
END;
$cancel$;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid,p_rating integer,p_text text DEFAULT '')
RETURNS TABLE(review_id uuid,changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $complete$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE; existing_id uuid; new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR char_length(coalesce(p_text,''))>1000 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN RAISE EXCEPTION 'account_blocked'; END IF;
  SELECT id INTO existing_id FROM public.reviews WHERE job_id=p_job_id AND author_id=actor_id;
  IF j.status='done' AND existing_id IS NOT NULL THEN
    RETURN QUERY SELECT existing_id,false; RETURN;
  END IF;
  IF j.status<>'in_progress' OR j.selected_worker_id IS NULL OR existing_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.bids WHERE job_id=p_job_id AND worker_id=j.selected_worker_id AND status='selected') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  -- Serialize two completed jobs for one worker before recomputing the rating.
  PERFORM id FROM public.profiles_worker WHERE id=j.selected_worker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state'; END IF;
  INSERT INTO public.reviews(job_id,author_id,worker_id,rating,text)
    VALUES(p_job_id,actor_id,j.selected_worker_id,p_rating,nullif(btrim(coalesce(p_text,'')),'')) RETURNING id INTO new_id;
  UPDATE public.jobs SET status='done' WHERE id=p_job_id;
  UPDATE public.profiles_worker w SET rating_avg=s.avg,rating_count=s.n FROM (
    SELECT coalesce(round(avg(r.rating),2),0) AS avg,count(*)::integer AS n
    FROM public.reviews r JOIN public.jobs job ON job.id=r.job_id
    WHERE r.worker_id=j.selected_worker_id AND job.status='done'
      AND job.selected_worker_id=r.worker_id AND job.client_id=r.author_id
  ) s WHERE w.id=j.selected_worker_id;
  RETURN QUERY SELECT new_id,true;
END;
$complete$;

REVOKE ALL ON FUNCTION public.select_job_worker(uuid,uuid),public.cancel_job(uuid),public.complete_job(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.select_job_worker(uuid,uuid),public.cancel_job(uuid),public.complete_job(uuid,integer,text) TO authenticated;

-- New requests must also obey identity, block and initial-state invariants,
-- including requests sent directly to PostgREST.
CREATE OR REPLACE FUNCTION public.guard_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $new_job$
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.client_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id=auth.uid() AND blocked_at IS NULL AND name IS NOT NULL AND btrim(name)<>''
    ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
    IF NEW.status<>'active' OR NEW.selected_worker_id IS NOT NULL
      OR char_length(btrim(NEW.description)) NOT BETWEEN 10 AND 5000
      OR NEW.category NOT IN ('electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting')
      OR NEW.budget_min<0 OR NEW.budget_max<0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
    NEW.expires_at:=now()+CASE WHEN NEW.urgent THEN interval '7 days' ELSE interval '30 days' END;
  END IF;
  RETURN NEW;
END;
$new_job$;
DROP TRIGGER IF EXISTS guard_new_job ON public.jobs;
CREATE TRIGGER guard_new_job BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_new_job();

NOTIFY pgrst,'reload schema';



-- Source: 202610040002_free_balti_pilot.sql; SHA256: ca34651746eedcc5c2653939535a05b4d80e7b02a7f9660934a34bd06d16e209
-- Approved free RU/RO pilot in Bălți. Apply after 202610040001.

CREATE OR REPLACE FUNCTION public.submit_bid(
  p_job_id uuid, p_price numeric, p_comment text, p_start_date date DEFAULT NULL
)
RETURNS TABLE (bid_id uuid, created boolean, credits_remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  target public.jobs%ROWTYPE;
  actor public.profiles%ROWTYPE;
  existing_id uuid;
  balance integer;
  new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_price IS NULL OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_price <= 0 OR p_price > 1000000000
     OR p_comment IS NULL OR char_length(btrim(p_comment)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Serializes retries on one job, including concurrent select/cancel/expire.
  SELECT * INTO target FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_unavailable'; END IF;
  IF target.client_id = actor_id THEN RAISE EXCEPTION 'own_job'; END IF;

  -- Prevent a concurrent block/role change from taking effect mid-operation.
  PERFORM id FROM public.profiles WHERE id IN (actor_id, target.client_id) ORDER BY id FOR SHARE;
  SELECT * INTO actor FROM public.profiles WHERE id = actor_id;
  IF NOT FOUND OR actor.role <> 'worker' THEN RAISE EXCEPTION 'not_worker'; END IF;
  IF actor.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'account_blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target.client_id AND blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  -- Serializes the rolling daily limit across jobs for the same worker.
  SELECT bid_credits INTO balance FROM public.profiles_worker WHERE id = actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_worker'; END IF;
  SELECT id INTO existing_id FROM public.bids WHERE job_id = p_job_id AND worker_id = actor_id;
  IF FOUND THEN
    RETURN QUERY SELECT existing_id, false, balance;
    RETURN;
  END IF;

  IF target.status <> 'active' OR target.expires_at <= now() THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;
  IF p_start_date IS NOT NULL AND p_start_date < current_date THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF target.city <> 'Бельцы' THEN RAISE EXCEPTION 'job_unavailable'; END IF;
  IF (SELECT count(*) FROM public.bids WHERE worker_id=actor_id
      AND created_at > now()-interval '24 hours') >= 10 THEN RAISE EXCEPTION 'daily_limit'; END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
    VALUES (p_job_id, actor_id, p_price, btrim(p_comment), p_start_date, 'sent') RETURNING id INTO new_id;
  -- Free pilot: existing balances are preserved; no credit is deducted.
  RETURN QUERY SELECT new_id, true, balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_bid(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bid(uuid, numeric, text, date) TO authenticated;


-- Existing jobs and balances are retained; only NEW pilot requests are scoped.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
CREATE OR REPLACE FUNCTION public.guard_pilot_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $pilot$
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.city <> 'Бельцы' OR NEW.lat IS NULL OR NEW.lng IS NULL
      OR NOT (NEW.lat BETWEEN 47.68 AND 47.83 AND NEW.lng BETWEEN 27.82 AND 28.02)
    THEN RAISE EXCEPTION 'pilot_location_required'; END IF;
    -- The row lock makes concurrent requests obey the same rolling limit.
    PERFORM id FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
    IF (SELECT count(*) FROM public.jobs WHERE client_id=auth.uid()
      AND created_at > now()-interval '24 hours') >= 5 THEN RAISE EXCEPTION 'job_daily_limit'; END IF;
  END IF;
  RETURN NEW;
END;
$pilot$;
DROP TRIGGER IF EXISTS guard_pilot_job ON public.jobs;
CREATE TRIGGER guard_pilot_job BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_pilot_job();
CREATE INDEX IF NOT EXISTS bids_worker_created ON public.bids(worker_id,created_at);
CREATE INDEX IF NOT EXISTS jobs_client_created ON public.jobs(client_id,created_at);

NOTIFY pgrst,'reload schema';



-- Source: 202610040003_worker_location_privacy.sql; SHA256: 2cfcf3ff8fbd6533d4116e7cded0f496bc0d1879a908c546f258d20214f1006e
-- Deploy with explicit public column readers. Retains all existing data.

REVOKE SELECT ON public.jobs,public.profiles_worker FROM PUBLIC,anon,authenticated;
DO $acl$
DECLARE tab text;cols text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['jobs','profiles_worker'] LOOP
    SELECT string_agg(quote_ident(attname),', ') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',tab)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,tab);
  END LOOP;
END;
$acl$;
GRANT SELECT (id,client_id,description,category,city,area,budget_min,budget_max,urgent,needs_quote,photos,status,selected_worker_id,created_at,expires_at)
  ON public.jobs TO anon,authenticated;
GRANT SELECT (id,categories,areas,experience_yrs,bio,photos,is_pro,rating_avg,rating_count,verified,completed_at)
  ON public.profiles_worker TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_worker_profile()
RETURNS SETOF public.profiles_worker LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $own$
  SELECT w.* FROM public.profiles_worker w WHERE w.id=auth.uid() AND auth.uid() IS NOT NULL;
$own$;
CREATE OR REPLACE FUNCTION public.get_job_location(p_job_id uuid)
RETURNS TABLE(lat double precision,lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $loc$
  SELECT j.lat,j.lng FROM public.jobs j JOIN public.profiles actor ON actor.id=auth.uid()
  JOIN public.profiles client ON client.id=j.client_id
  WHERE j.id=p_job_id AND actor.blocked_at IS NULL AND client.blocked_at IS NULL AND (
    j.client_id=auth.uid() OR (j.status='in_progress' AND j.selected_worker_id=auth.uid()
      AND EXISTS (SELECT 1 FROM public.bids b WHERE b.job_id=j.id AND b.worker_id=auth.uid() AND b.status='selected'))
  );
$loc$;
CREATE OR REPLACE FUNCTION public.get_job_worker_contact(p_job_id uuid)
RETURNS TABLE(name text,phone text,viber text,telegram text,whatsapp text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $contact$
  SELECT worker.name,worker.phone,w.viber,w.telegram,w.whatsapp FROM public.jobs j
  JOIN public.profiles worker ON worker.id=j.selected_worker_id
  JOIN public.profiles client ON client.id=j.client_id
  JOIN public.profiles_worker w ON w.id=worker.id
  WHERE j.id=p_job_id AND j.client_id=auth.uid() AND j.status='in_progress'
    AND client.blocked_at IS NULL AND worker.blocked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.job_id=j.id AND b.worker_id=worker.id AND b.status='selected');
$contact$;
REVOKE ALL ON FUNCTION public.get_my_worker_profile(),public.get_job_location(uuid),public.get_job_worker_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_worker_profile(),public.get_job_location(uuid),public.get_job_worker_contact(uuid) TO authenticated;
-- Atomic profile edits use the authenticated identity, never a supplied user id.
CREATE OR REPLACE FUNCTION public.save_my_profile(p_data jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $save$
DECLARE actor_id uuid:=auth.uid(); cats text[]; zones text[]; images text[]; exp integer;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_data IS NULL OR p_data->>'role' NOT IN ('client','worker') OR p_data->>'city' IS DISTINCT FROM 'Бельцы'
    OR coalesce(char_length(btrim(p_data->>'name')),0) NOT BETWEEN 2 AND 80
    OR char_length(coalesce(p_data->>'bio',''))>2000
    OR char_length(coalesce(p_data->>'viber',''))>100 OR char_length(coalesce(p_data->>'telegram',''))>100
    OR char_length(coalesce(p_data->>'whatsapp',''))>100 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  cats:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'categories','[]'::jsonb)));
  zones:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'areas','[]'::jsonb)));
  images:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'photos','[]'::jsonb)));
  exp:=nullif(p_data->>'experience_yrs','')::integer;
  IF cardinality(cats)>8 OR cardinality(zones)>20 OR cardinality(images)>10 OR exp NOT BETWEEN 0 AND 80
    OR NOT cats <@ ARRAY['electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting'] THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  UPDATE public.profiles SET name=btrim(p_data->>'name'),role=p_data->>'role',city='Бельцы' WHERE id=actor_id;
  INSERT INTO public.profiles_worker(id,bio,categories,areas,experience_yrs,viber,telegram,whatsapp,photos)
    VALUES(actor_id,nullif(btrim(p_data->>'bio'),''),cats,zones,exp,
      nullif(btrim(p_data->>'viber'),''),nullif(btrim(p_data->>'telegram'),''),nullif(btrim(p_data->>'whatsapp'),''),images)
  ON CONFLICT(id) DO UPDATE SET bio=excluded.bio,categories=excluded.categories,areas=excluded.areas,
    experience_yrs=excluded.experience_yrs,viber=excluded.viber,telegram=excluded.telegram,whatsapp=excluded.whatsapp,photos=excluded.photos;
  RETURN true;
END;
$save$;
REVOKE ALL ON FUNCTION public.save_my_profile(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_profile(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';



-- Source: 202610040004_secure_telegram_links.sql; SHA256: 242f461bed0b311d61caaf641025027ea37d146cbdae7ae8c930e6a1e53a9374

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS telegram_link_user_created ON public.telegram_link_tokens(user_id,created_at);
CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_link_tokens,public.telegram_processed_updates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.issue_telegram_link(p_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE actor_id uuid:=auth.uid();
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF (SELECT count(*) FROM public.telegram_link_tokens WHERE user_id=actor_id AND created_at>now()-interval '10 minutes')>=3 THEN
    RAISE EXCEPTION 'link_rate_limit';
  END IF;
  UPDATE public.telegram_link_tokens SET used_at=now() WHERE user_id=actor_id AND used_at IS NULL;
  INSERT INTO public.telegram_link_tokens(token_hash,user_id) VALUES(p_token_hash,actor_id);
  RETURN true;
END;
$issue$;

-- Only a webhook authenticated by Telegram's secret may call this service RPC.
CREATE OR REPLACE FUNCTION public.consume_telegram_update(p_token_hash text,p_chat_id bigint,p_update_id bigint,p_stop boolean DEFAULT false)
RETURNS TABLE(result text,name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $consume$
DECLARE link public.telegram_link_tokens%ROWTYPE;actor_name text;
BEGIN
  IF p_chat_id IS NULL OR p_chat_id<=0 OR p_update_id IS NULL OR p_update_id<0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  -- Deduplicate all commands, including /stop, before changing any binding.
  INSERT INTO public.telegram_processed_updates(update_id) VALUES(p_update_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(p_chat_id);
  IF p_stop THEN
    -- Delayed older /stop events must not undo a newer link event.
    IF EXISTS (SELECT 1 FROM public.telegram_chat_updates WHERE chat_id=p_chat_id AND update_id>p_update_id) THEN
      RETURN QUERY SELECT 'duplicate'::text,NULL::text; RETURN;
    END IF;
    UPDATE public.profiles SET telegram_chat_id=NULL WHERE telegram_chat_id=p_chat_id;
    INSERT INTO public.telegram_chat_updates(chat_id,update_id) VALUES(p_chat_id,p_update_id)
      ON CONFLICT(chat_id) DO UPDATE SET update_id=excluded.update_id;
    RETURN QUERY SELECT 'stopped'::text,NULL::text; RETURN;
  END IF;
  SELECT * INTO link FROM public.telegram_link_tokens WHERE token_hash=p_token_hash;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN; END IF;
  -- Same lock order as issue_telegram_link: profile, then token.
  PERFORM id FROM public.profiles WHERE id=link.user_id FOR UPDATE;
  SELECT * INTO link FROM public.telegram_link_tokens WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR link.used_at IS NOT NULL OR link.expires_at<=now() THEN RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN; END IF;
  SELECT p.name INTO actor_name FROM public.profiles p WHERE p.id=link.user_id AND p.blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.profiles WHERE telegram_chat_id=p_chat_id AND id<>link.user_id) THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.telegram_chat_updates WHERE chat_id=p_chat_id AND update_id>p_update_id) THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN;
  END IF;
  UPDATE public.profiles SET telegram_chat_id=p_chat_id WHERE id=link.user_id;
  UPDATE public.telegram_link_tokens SET used_at=now() WHERE token_hash=p_token_hash;
  INSERT INTO public.telegram_chat_updates(chat_id,update_id) VALUES(p_chat_id,p_update_id)
    ON CONFLICT(chat_id) DO UPDATE SET update_id=excluded.update_id;
  RETURN QUERY SELECT 'linked'::text,actor_name;
END;
$consume$;
CREATE TABLE IF NOT EXISTS public.telegram_chat_updates(chat_id bigint PRIMARY KEY,update_id bigint NOT NULL);
ALTER TABLE public.telegram_chat_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_chat_updates FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_telegram_link(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_telegram_link(text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_telegram_update(text,bigint,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_update(text,bigint,bigint,boolean) TO service_role;
NOTIFY pgrst,'reload schema';


NOTIFY pgrst, 'reload schema';
COMMIT;
