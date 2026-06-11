-- ============================================================
-- Critical security and data-integrity hardening
-- ============================================================

-- Shared helpers for RLS policies and triggers.
CREATE OR REPLACE FUNCTION public.is_admin()
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
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_not_blocked()
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
      AND blocked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_not_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_not_blocked() TO anon, authenticated;

-- Prevent self-service admin grants and tampering with block fields.
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
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
  );

CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      IF NEW.role = 'admin' THEN
        RAISE EXCEPTION 'admin_role_not_allowed';
      END IF;
      NEW.blocked_at := NULL;
      NEW.block_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_is_admin THEN
    IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'admin_role_not_allowed';
    END IF;

    NEW.blocked_at := OLD.blocked_at;
    NEW.block_reason := OLD.block_reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_system_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_fields();

-- Keep worker economy/trust fields out of the browser-writable profile surface.
DROP POLICY IF EXISTS "worker_own_write" ON public.profiles_worker;

CREATE POLICY "worker_own_insert" ON public.profiles_worker
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND public.current_user_not_blocked()
  );

CREATE POLICY "worker_own_update" ON public.profiles_worker
  FOR UPDATE
  USING (
    id = auth.uid()
    AND public.current_user_not_blocked()
  )
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "worker_admin_update" ON public.profiles_worker;
CREATE POLICY "worker_admin_update" ON public.profiles_worker
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_worker_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_system_write boolean :=
    public.is_admin()
    OR COALESCE(current_setting('master.allow_worker_system_write', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_allow_system_write THEN
      NEW.is_pro := false;
      NEW.pro_until := NULL;
      NEW.bid_credits := 5;
      NEW.rating_avg := 0;
      NEW.rating_count := 0;
      NEW.verified := false;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_allow_system_write THEN
    NEW.is_pro := OLD.is_pro;
    NEW.pro_until := OLD.pro_until;
    NEW.bid_credits := OLD.bid_credits;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
    NEW.verified := OLD.verified;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_worker_system_fields ON public.profiles_worker;
CREATE TRIGGER trg_protect_worker_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW EXECUTE FUNCTION public.protect_worker_system_fields();

-- Spend credits only for the authenticated worker. Kept for compatibility;
-- bid creation below uses create_bid_with_credit instead.
CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF p_worker_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_worker_id
      AND role = 'worker'
      AND blocked_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = p_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN false;
  END IF;

  PERFORM set_config('master.allow_worker_system_write', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_bid_credit(uuid) TO authenticated;

-- Browser clients must not insert bids without spending a credit.
DROP POLICY IF EXISTS "bids_worker_insert" ON public.bids;
CREATE POLICY "bids_worker_insert_disabled" ON public.bids
  FOR INSERT
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.create_bid_with_credit(
  p_job_id uuid,
  p_price numeric,
  p_comment text,
  p_start_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid := auth.uid();
  v_credits integer;
  v_bid_id uuid;
BEGIN
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF length(btrim(coalesce(p_comment, ''))) = 0 THEN
    RAISE EXCEPTION 'empty_comment';
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

  PERFORM 1
  FROM public.jobs
  WHERE id = p_job_id
    AND status = 'active'
    AND expires_at > now()
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_available';
  END IF;

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = v_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, btrim(p_comment), p_start_date, 'sent')
  RETURNING id INTO v_bid_id;

  PERFORM set_config('master.allow_worker_system_write', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = v_worker_id;

  RETURN v_bid_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) TO authenticated;

DROP POLICY IF EXISTS "jobs_own_insert" ON public.jobs;
CREATE POLICY "jobs_own_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND public.current_user_not_blocked()
  );

DROP POLICY IF EXISTS "jobs_own_update" ON public.jobs;
CREATE POLICY "jobs_own_update" ON public.jobs
  FOR UPDATE
  USING (
    client_id = auth.uid()
    AND public.current_user_not_blocked()
  )
  WITH CHECK (client_id = auth.uid());

-- Worker selection must update bid/job state atomically and consistently.
DROP POLICY IF EXISTS "client_update_bids_on_own_jobs" ON public.bids;
CREATE POLICY "client_update_bids_on_own_jobs_disabled" ON public.bids
  FOR UPDATE
  USING (false);

CREATE OR REPLACE FUNCTION public.protect_bid_selection_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NOT public.is_admin()
     AND COALESCE(current_setting('master.select_worker_for_job', true), '') <> 'on' THEN
    RAISE EXCEPTION 'bid_status_managed_by_rpc';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_bid_selection_updates ON public.bids;
CREATE TRIGGER trg_protect_bid_selection_updates
  BEFORE UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.protect_bid_selection_updates();

CREATE OR REPLACE FUNCTION public.protect_job_selection_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
       NEW.selected_worker_id IS DISTINCT FROM OLD.selected_worker_id
       OR (NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress')
     )
     AND NOT public.is_admin()
     AND COALESCE(current_setting('master.select_worker_for_job', true), '') <> 'on' THEN
    RAISE EXCEPTION 'job_selection_managed_by_rpc';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_job_selection_updates ON public.jobs;
CREATE TRIGGER trg_protect_job_selection_updates
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.protect_job_selection_updates();

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
  v_worker_id uuid;
  v_job_client_id uuid;
  v_job_status text;
BEGIN
  SELECT client_id, status
    INTO v_job_client_id, v_job_status
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF v_job_client_id IS NULL THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_job_client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_job_status <> 'active' THEN
    RAISE EXCEPTION 'invalid_status';
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

  PERFORM set_config('master.select_worker_for_job', 'on', true);

  UPDATE public.bids
     SET status = 'rejected'
   WHERE job_id = p_job_id
     AND id <> p_bid_id
     AND status = 'sent';

  UPDATE public.bids
     SET status = 'selected'
   WHERE id = p_bid_id;

  UPDATE public.jobs
     SET status = 'in_progress',
         selected_worker_id = v_worker_id
   WHERE id = p_job_id;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;

-- Reviews must be tied to the selected worker on the caller's in-progress job.
DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
CREATE POLICY "reviews_auth_insert" ON public.reviews
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs
      WHERE jobs.id = reviews.job_id
        AND jobs.client_id = auth.uid()
        AND jobs.selected_worker_id = reviews.worker_id
        AND jobs.status = 'in_progress'
    )
  );

CREATE OR REPLACE FUNCTION public.recalculate_worker_rating(p_worker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating_avg numeric(3,2);
  v_rating_count integer;
BEGIN
  SELECT COALESCE(round(avg(rating)::numeric, 1), 0), count(*)
    INTO v_rating_avg, v_rating_count
    FROM public.reviews
   WHERE worker_id = p_worker_id;

  PERFORM set_config('master.allow_worker_system_write', 'on', true);

  UPDATE public.profiles_worker
     SET rating_avg = v_rating_avg,
         rating_count = v_rating_count
   WHERE id = p_worker_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_worker_rating_from_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_worker_rating(OLD.worker_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_worker_rating(NEW.worker_id);

  IF TG_OP = 'UPDATE' AND NEW.worker_id IS DISTINCT FROM OLD.worker_id THEN
    PERFORM public.recalculate_worker_rating(OLD.worker_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_worker_rating_from_review ON public.reviews;
CREATE TRIGGER trg_refresh_worker_rating_from_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_worker_rating_from_review();

-- Notifications are written by SECURITY DEFINER triggers; clients should not
-- be able to inject arbitrary notifications.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
