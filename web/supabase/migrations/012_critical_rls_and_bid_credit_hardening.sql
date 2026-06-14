-- ============================================================
-- Critical RLS and bid-credit hardening
-- ============================================================

-- Admin checks are centralized in SECURITY DEFINER helpers so RLS policies do
-- not recurse through public.profiles and cannot be satisfied by a row being
-- mutated in the same statement.
CREATE OR REPLACE FUNCTION public.is_admin_user()
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

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.worker_system_update_allowed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
    OR COALESCE(current_setting('app.allow_worker_system_update', true), '') = 'on'
    OR public.is_admin_user();
$$;

REVOKE ALL ON FUNCTION public.worker_system_update_allowed() FROM PUBLIC;

-- Prevent users from creating admin profiles, unblocking themselves, or
-- changing immutable profile fields through direct Supabase client writes.
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' THEN
      NEW.role := 'client';
    END IF;
    NEW.blocked_at := NULL;
    NEW.block_reason := NULL;
    RETURN NEW;
  END IF;

  NEW.phone := OLD.phone;
  NEW.blocked_at := OLD.blocked_at;
  NEW.block_reason := OLD.block_reason;

  IF NEW.role = 'admin' THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_system_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_system_fields();

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
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Users may edit their public worker profile content, but system-managed
-- fields such as credits, verification, pro status, and ratings are protected.
CREATE OR REPLACE FUNCTION public.protect_worker_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.worker_system_update_allowed() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_pro := false;
    NEW.pro_until := NULL;
    NEW.bid_credits := 5;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    NEW.verified := false;
    RETURN NEW;
  END IF;

  NEW.is_pro := OLD.is_pro;
  NEW.pro_until := OLD.pro_until;
  NEW.bid_credits := OLD.bid_credits;
  NEW.rating_avg := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;
  NEW.verified := OLD.verified;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_worker_profile_system_fields ON public.profiles_worker;
CREATE TRIGGER trg_protect_worker_profile_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_worker_profile_system_fields();

DROP POLICY IF EXISTS "worker_own_write" ON public.profiles_worker;

DROP POLICY IF EXISTS "worker_own_insert" ON public.profiles_worker;
CREATE POLICY "worker_own_insert" ON public.profiles_worker
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('client', 'worker')
        AND profiles.blocked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "worker_own_update" ON public.profiles_worker;
CREATE POLICY "worker_own_update" ON public.profiles_worker
  FOR UPDATE
  USING (
    id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('client', 'worker')
        AND profiles.blocked_at IS NULL
    )
  )
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "worker_admin_update" ON public.profiles_worker;
CREATE POLICY "worker_admin_update" ON public.profiles_worker
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Direct bid inserts bypassed the newly introduced credit economy. All bid
-- creation now goes through create_bid_with_credit(), which validates the job
-- and deducts exactly one credit in the same transaction as the insert.
DROP POLICY IF EXISTS "bids_worker_insert" ON public.bids;

CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF auth.uid() IS NULL OR p_worker_id <> auth.uid() THEN
    RETURN false;
  END IF;

  SELECT pw.bid_credits INTO v_credits
  FROM public.profiles_worker AS pw
  JOIN public.profiles AS p ON p.id = pw.id
  WHERE pw.id = p_worker_id
    AND p.role = 'worker'
    AND p.blocked_at IS NULL
  FOR UPDATE OF pw;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.allow_worker_system_update', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_bid_with_credit(
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
  v_credits integer;
  v_bid_id uuid;
BEGIN
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'invalid_price';
  END IF;

  IF p_comment IS NULL OR char_length(btrim(p_comment)) < 10 THEN
    RAISE EXCEPTION 'invalid_comment';
  END IF;

  SELECT pw.bid_credits INTO v_credits
  FROM public.profiles_worker AS pw
  JOIN public.profiles AS p ON p.id = pw.id
  WHERE pw.id = v_worker_id
    AND p.role = 'worker'
    AND p.blocked_at IS NULL
  FOR UPDATE OF pw;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'not_worker';
  END IF;

  IF v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bids
    WHERE job_id = p_job_id
      AND worker_id = v_worker_id
  ) THEN
    RAISE EXCEPTION 'already_bid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE id = p_job_id
      AND status = 'active'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'job_not_available';
  END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, btrim(p_comment), p_start_date, 'sent')
  RETURNING id INTO v_bid_id;

  PERFORM set_config('app.allow_worker_system_update', 'on', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = v_worker_id;

  RETURN v_bid_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) TO authenticated;

-- Only the owning client can create a review, and only for the selected worker.
DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
CREATE POLICY "reviews_client_insert" ON public.reviews
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
  v_avg numeric(3,2);
  v_count integer;
BEGIN
  SELECT COALESCE(round(avg(rating)::numeric, 2), 0), count(*)::integer
  INTO v_avg, v_count
  FROM public.reviews
  WHERE worker_id = p_worker_id;

  PERFORM set_config('app.allow_worker_system_update', 'on', true);

  UPDATE public.profiles_worker
  SET rating_avg = v_avg,
      rating_count = v_count
  WHERE id = p_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_worker_rating(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_worker_rating_from_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalculate_worker_rating(OLD.worker_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.worker_id IS DISTINCT FROM OLD.worker_id) THEN
    PERFORM public.recalculate_worker_rating(NEW.worker_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_worker_rating_from_review ON public.reviews;
CREATE TRIGGER trg_refresh_worker_rating_from_review
  AFTER INSERT OR UPDATE OF rating, worker_id OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_worker_rating_from_review();

DROP POLICY IF EXISTS "jobs_admin_read" ON public.jobs;
CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
