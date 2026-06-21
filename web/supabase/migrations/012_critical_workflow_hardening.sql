-- ============================================================
-- Critical workflow hardening
-- ============================================================

-- createJob writes jobs.title, but older schemas did not include it.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS title text;

UPDATE public.jobs
SET title = left(description, 80)
WHERE title IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN title SET NOT NULL;

-- RLS-safe helpers used by policies and triggers. SECURITY DEFINER avoids
-- recursive policies when checking the current user's own profile.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND blocked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_blocked()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND blocked_at IS NOT NULL
  );
$$;

-- Keep user-writable profile updates from changing moderation/admin fields.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_system_update boolean;
BEGIN
  v_is_admin := public.current_user_is_admin();
  v_is_system_update := current_setting('app.bypass_worker_system_fields', true) = 'on';

  IF v_is_system_update THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin AND NEW.role = 'admin' THEN
      NEW.role := 'client';
    END IF;
    IF NOT v_is_admin THEN
      NEW.blocked_at := NULL;
      NEW.block_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_is_admin THEN
    IF NEW.role = 'admin' THEN
      NEW.role := OLD.role;
    END IF;
    NEW.blocked_at := OLD.blocked_at;
    NEW.block_reason := OLD.block_reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Keep worker-owned profile edits from minting credits or forging trust/rating.
CREATE OR REPLACE FUNCTION public.protect_worker_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := public.current_user_is_admin();

  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.is_pro := false;
      NEW.pro_until := NULL;
      NEW.bid_credits := 5;
      NEW.rating_avg := 0;
      NEW.rating_count := 0;
      NEW.verified := false;
      NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_is_admin THEN
    NEW.is_pro := OLD.is_pro;
    NEW.pro_until := OLD.pro_until;
    NEW.bid_credits := OLD.bid_credits;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.verified := OLD.verified;
    NEW.completed_at := OLD.completed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_worker_system_fields ON public.profiles_worker;
CREATE TRIGGER trg_protect_worker_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW EXECUTE FUNCTION public.protect_worker_system_fields();

-- Replace recursive/over-broad policies with caller-bound checks.
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid() AND blocked_at IS NULL)
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "worker_own_write" ON public.profiles_worker;
DROP POLICY IF EXISTS "worker_own_insert" ON public.profiles_worker;
CREATE POLICY "worker_own_insert" ON public.profiles_worker
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'worker'
        AND profiles.blocked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "worker_own_update" ON public.profiles_worker;
CREATE POLICY "worker_own_update" ON public.profiles_worker
  FOR UPDATE
  USING (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'worker'
        AND profiles.blocked_at IS NULL
    )
  )
  WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'worker'
        AND profiles.blocked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "worker_admin_update" ON public.profiles_worker;
CREATE POLICY "worker_admin_update" ON public.profiles_worker
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "jobs_own_insert" ON public.jobs;
CREATE POLICY "jobs_own_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND NOT public.current_user_is_blocked()
  );

DROP POLICY IF EXISTS "jobs_own_update" ON public.jobs;
CREATE POLICY "jobs_own_cancel_update" ON public.jobs
  FOR UPDATE
  USING (
    client_id = auth.uid()
    AND status = 'active'
    AND NOT public.current_user_is_blocked()
  )
  WITH CHECK (
    client_id = auth.uid()
    AND status = 'cancelled'
    AND selected_worker_id IS NULL
  );

DROP POLICY IF EXISTS "jobs_admin_read" ON public.jobs;
CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- Bids and reviews must be created through atomic RPCs so credits, selection,
-- ratings, and contact access cannot be forged through the public anon client.
DROP POLICY IF EXISTS "bids_worker_insert" ON public.bids;
DROP POLICY IF EXISTS "client_update_bids_on_own_jobs" ON public.bids;
DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;

DROP FUNCTION IF EXISTS public.spend_bid_credit(uuid);

CREATE OR REPLACE FUNCTION public.create_bid(
  p_job_id uuid,
  p_price numeric,
  p_comment text,
  p_start_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_credits integer;
  v_bid_id uuid;
BEGIN
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_worker_id
      AND role = 'worker'
      AND blocked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_worker';
  END IF;

  SELECT *
    INTO v_job
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_job.status <> 'active' OR v_job.expires_at <= now() THEN
    RAISE EXCEPTION 'job_not_active';
  END IF;
  IF v_job.client_id = v_worker_id THEN
    RAISE EXCEPTION 'cannot_bid_own_job';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_job.client_id AND blocked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'job_owner_blocked';
  END IF;

  SELECT bid_credits
    INTO v_credits
    FROM public.profiles_worker
   WHERE id = v_worker_id
   FOR UPDATE;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'not_worker';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bids
    WHERE job_id = p_job_id AND worker_id = v_worker_id
  ) THEN
    RAISE EXCEPTION 'already_bid';
  END IF;
  IF v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, coalesce(btrim(p_comment), ''), p_start_date, 'sent')
  RETURNING id INTO v_bid_id;

  PERFORM set_config('app.bypass_worker_system_fields', 'on', true);

  UPDATE public.profiles_worker
     SET bid_credits = bid_credits - 1
   WHERE id = v_worker_id;

  RETURN v_bid_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.select_worker_for_job(
  p_job_id uuid,
  p_bid_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_worker_id uuid;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
    INTO v_job
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_job.client_id <> v_client_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_job.status <> 'active' OR v_job.expires_at <= now() THEN
    RAISE EXCEPTION 'job_not_active';
  END IF;
  IF public.current_user_is_blocked() THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  SELECT worker_id
    INTO v_worker_id
    FROM public.bids
   WHERE id = p_bid_id
     AND job_id = p_job_id
     AND status = 'sent'
   FOR UPDATE;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'bid_not_found';
  END IF;

  UPDATE public.bids
     SET status = 'selected'
   WHERE id = p_bid_id;

  UPDATE public.bids
     SET status = 'rejected'
   WHERE job_id = p_job_id
     AND id <> p_bid_id;

  UPDATE public.jobs
     SET status = 'in_progress',
         selected_worker_id = v_worker_id
   WHERE id = p_job_id;

  RETURN v_worker_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_job_with_review(
  p_job_id uuid,
  p_rating integer,
  p_text text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_worker_id uuid;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT *
    INTO v_job
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_job.client_id <> v_client_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_job.status <> 'in_progress' OR v_job.selected_worker_id IS NULL THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF public.current_user_is_blocked() THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  v_worker_id := v_job.selected_worker_id;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  INSERT INTO public.reviews (job_id, author_id, worker_id, rating, text)
  VALUES (p_job_id, v_client_id, v_worker_id, p_rating, nullif(btrim(p_text), ''));

  UPDATE public.jobs
     SET status = 'done'
   WHERE id = p_job_id;

  PERFORM set_config('app.bypass_worker_system_fields', 'on', true);

  UPDATE public.profiles_worker pw
     SET rating_avg = stats.avg_rating,
         rating_count = stats.rating_count
    FROM (
      SELECT round(avg(rating)::numeric, 1) AS avg_rating,
             count(*)::integer AS rating_count
      FROM public.reviews
      WHERE worker_id = v_worker_id
    ) AS stats
   WHERE pw.id = v_worker_id;

  RETURN v_worker_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_bid_credits(
  p_worker_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.profiles_worker
     SET bid_credits = bid_credits + p_amount
   WHERE id = p_worker_id
   RETURNING bid_credits INTO v_credits;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'worker_not_found';
  END IF;

  RETURN v_credits;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_blocked() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_bid(uuid, numeric, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_blocked() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_bid(uuid, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) TO authenticated;
