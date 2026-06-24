-- ============================================================
-- Critical workflow hardening
--
-- Enforces security-sensitive invariants at the database boundary:
-- - users cannot self-grant admin or worker system fields
-- - bid credits are spent atomically with bid creation
-- - worker selection and review completion are single checked RPCs
-- - users cannot forge notifications or direct bid/review writes
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role = 'admin'
      AND blocked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_unblocked_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND blocked_at IS NULL
  );
$$;

-- Profiles: users may create/update only their own non-admin profile.
-- Admin access uses the SECURITY DEFINER helper to avoid recursive RLS.
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid() AND public.is_unblocked_user(auth.uid()))
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_profile_protected_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' OR NEW.blocked_at IS NOT NULL OR NEW.block_reason IS NOT NULL THEN
      RAISE EXCEPTION 'protected_profile_fields';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id THEN
    IF (NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'admin')
       OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at
       OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
      RAISE EXCEPTION 'protected_profile_fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_protected_field_changes ON public.profiles;
CREATE TRIGGER trg_prevent_profile_protected_field_changes
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_protected_field_changes();

-- Worker profiles: direct users can edit only user-owned profile fields.
DROP POLICY IF EXISTS "worker_own_write" ON public.profiles_worker;
DROP POLICY IF EXISTS "worker_own_insert" ON public.profiles_worker;
DROP POLICY IF EXISTS "worker_own_update" ON public.profiles_worker;

CREATE POLICY "worker_own_insert" ON public.profiles_worker
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'worker'
        AND blocked_at IS NULL
    )
  );

CREATE POLICY "worker_own_update" ON public.profiles_worker
  FOR UPDATE
  USING (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'worker'
        AND blocked_at IS NULL
    )
  )
  WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'worker'
        AND blocked_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_worker_system_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trusted boolean := public.is_service_role()
    OR COALESCE(current_setting('app.bypass_worker_system_fields', true), '') = 'on';
BEGIN
  IF v_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_pro IS DISTINCT FROM false
       OR NEW.pro_until IS NOT NULL
       OR NEW.bid_credits IS DISTINCT FROM 5
       OR NEW.rating_avg IS DISTINCT FROM 0
       OR NEW.rating_count IS DISTINCT FROM 0
       OR NEW.verified IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'protected_worker_fields';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_pro IS DISTINCT FROM OLD.is_pro
     OR NEW.pro_until IS DISTINCT FROM OLD.pro_until
     OR NEW.bid_credits IS DISTINCT FROM OLD.bid_credits
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
     OR NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'protected_worker_fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_worker_system_field_changes ON public.profiles_worker;
CREATE TRIGGER trg_prevent_worker_system_field_changes
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW EXECUTE FUNCTION public.prevent_worker_system_field_changes();

-- Jobs: direct owner updates can cancel active jobs only. Selection and
-- completion are handled by RPCs below so selected_worker_id cannot be forged.
DROP POLICY IF EXISTS "jobs_own_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_own_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_read" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;

CREATE POLICY "jobs_own_insert" ON public.jobs
  FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND public.is_unblocked_user(auth.uid())
  );

CREATE POLICY "jobs_own_update" ON public.jobs
  FOR UPDATE
  USING (client_id = auth.uid() AND public.is_unblocked_user(auth.uid()))
  WITH CHECK (client_id = auth.uid() AND public.is_unblocked_user(auth.uid()));

CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_unsafe_job_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trusted boolean := public.is_service_role()
    OR COALESCE(current_setting('app.bypass_job_workflow', true), '') = 'on';
BEGIN
  IF v_trusted THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.selected_worker_id IS DISTINCT FROM OLD.selected_worker_id THEN
    RAISE EXCEPTION 'protected_job_fields';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = OLD.client_id AND OLD.status = 'active' AND NEW.status = 'cancelled' THEN
      RETURN NEW;
    END IF;

    IF public.is_admin(auth.uid()) AND NEW.status = 'blocked' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'invalid_job_transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unsafe_job_changes ON public.jobs;
CREATE TRIGGER trg_prevent_unsafe_job_changes
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unsafe_job_changes();

-- Direct bid/review/notification writes are not trusted. RPCs and triggers
-- run as definer and bypass RLS for the checked workflows.
DROP POLICY IF EXISTS "bids_worker_insert" ON public.bids;
DROP POLICY IF EXISTS "client_update_bids_on_own_jobs" ON public.bids;
DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;

-- Keep the legacy credit-spend RPC safe if any old caller still invokes it.
CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_worker_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = p_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.bypass_worker_system_fields', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

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
  v_bid_id uuid;
  v_credits integer;
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

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = v_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.profiles client ON client.id = j.client_id
    WHERE j.id = p_job_id
      AND j.status = 'active'
      AND j.expires_at > now()
      AND j.client_id <> v_worker_id
      AND client.blocked_at IS NULL
    FOR UPDATE OF j
  ) THEN
    RAISE EXCEPTION 'job_not_available';
  END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, btrim(p_comment), p_start_date, 'sent')
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
  v_worker_id uuid;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.profiles client ON client.id = j.client_id
    WHERE j.id = p_job_id
      AND j.client_id = v_client_id
      AND j.status = 'active'
      AND client.blocked_at IS NULL
    FOR UPDATE OF j
  ) THEN
    RAISE EXCEPTION 'job_not_selectable';
  END IF;

  SELECT b.worker_id INTO v_worker_id
  FROM public.bids b
  JOIN public.profiles worker ON worker.id = b.worker_id
  WHERE b.id = p_bid_id
    AND b.job_id = p_job_id
    AND b.status = 'sent'
    AND worker.role = 'worker'
    AND worker.blocked_at IS NULL
  FOR UPDATE OF b;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'bid_not_selectable';
  END IF;

  UPDATE public.bids
  SET status = 'rejected'
  WHERE job_id = p_job_id
    AND id <> p_bid_id
    AND status = 'sent';

  UPDATE public.bids
  SET status = 'selected'
  WHERE id = p_bid_id;

  PERFORM set_config('app.bypass_job_workflow', 'on', true);

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
  v_worker_id uuid;
  v_rating_avg numeric(3,2);
  v_rating_count integer;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT selected_worker_id INTO v_worker_id
  FROM public.jobs j
  JOIN public.profiles client ON client.id = j.client_id
  WHERE j.id = p_job_id
    AND j.client_id = v_client_id
    AND j.status = 'in_progress'
    AND j.selected_worker_id IS NOT NULL
    AND client.blocked_at IS NULL
  FOR UPDATE OF j;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'job_not_reviewable';
  END IF;

  INSERT INTO public.reviews (job_id, author_id, worker_id, rating, text)
  VALUES (p_job_id, v_client_id, v_worker_id, p_rating, NULLIF(btrim(p_text), ''));

  PERFORM set_config('app.bypass_job_workflow', 'on', true);

  UPDATE public.jobs
  SET status = 'done'
  WHERE id = p_job_id;

  SELECT round(avg(rating)::numeric, 2), count(*)::integer
  INTO v_rating_avg, v_rating_count
  FROM public.reviews
  WHERE worker_id = v_worker_id;

  PERFORM set_config('app.bypass_worker_system_fields', 'on', true);

  UPDATE public.profiles_worker
  SET rating_avg = COALESCE(v_rating_avg, 0),
      rating_count = COALESCE(v_rating_count, 0)
  WHERE id = v_worker_id;

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
  v_new_credits integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM set_config('app.bypass_worker_system_fields', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits + p_amount
  WHERE id = p_worker_id
  RETURNING bid_credits INTO v_new_credits;

  IF v_new_credits IS NULL THEN
    RAISE EXCEPTION 'worker_not_found';
  END IF;

  RETURN v_new_credits;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_bid(uuid, numeric, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.spend_bid_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bid(uuid, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) TO authenticated;
