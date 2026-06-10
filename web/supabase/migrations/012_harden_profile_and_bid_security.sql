-- ============================================================
-- Harden privilege-sensitive profile fields and bid credits
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
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

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin_user(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_worker_sensitive_guard', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NOT v_is_admin THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role = 'admin'
        OR NEW.blocked_at IS NOT NULL
        OR NEW.block_reason IS NOT NULL
      THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF (OLD.role IS DISTINCT FROM NEW.role AND (OLD.role = 'admin' OR NEW.role = 'admin'))
        OR OLD.blocked_at IS DISTINCT FROM NEW.blocked_at
        OR OLD.block_reason IS DISTINCT FROM NEW.block_reason
      THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER guard_profile_sensitive_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_fields();

CREATE OR REPLACE FUNCTION public.guard_worker_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin_user(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT v_is_admin THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_pro IS DISTINCT FROM false
        OR NEW.verified IS DISTINCT FROM false
        OR NEW.bid_credits IS DISTINCT FROM 5
        OR NEW.rating_avg IS DISTINCT FROM 0
        OR NEW.rating_count IS DISTINCT FROM 0
        OR NEW.pro_until IS NOT NULL
        OR NEW.completed_at IS NOT NULL
      THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF OLD.is_pro IS DISTINCT FROM NEW.is_pro
        OR OLD.verified IS DISTINCT FROM NEW.verified
        OR OLD.bid_credits IS DISTINCT FROM NEW.bid_credits
        OR OLD.rating_avg IS DISTINCT FROM NEW.rating_avg
        OR OLD.rating_count IS DISTINCT FROM NEW.rating_count
        OR OLD.pro_until IS DISTINCT FROM NEW.pro_until
        OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
      THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_worker_sensitive_fields ON public.profiles_worker;
CREATE TRIGGER guard_worker_sensitive_fields
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_worker_sensitive_fields();

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "worker_admin_update" ON public.profiles_worker;
CREATE POLICY "worker_admin_update" ON public.profiles_worker
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "jobs_admin_read" ON public.jobs;
CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;
CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

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
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = p_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.bypass_worker_sensitive_guard', 'true', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_bid_credit(uuid) TO authenticated;

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
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_worker_id
      AND role = 'worker'
      AND blocked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_worker' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE id = p_job_id
      AND status = 'active'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'job_not_available' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bids
    WHERE job_id = p_job_id
      AND worker_id = v_worker_id
  ) THEN
    RAISE EXCEPTION 'already_bid' USING ERRCODE = '23505';
  END IF;

  SELECT bid_credits INTO v_credits
  FROM public.profiles_worker
  WHERE id = v_worker_id
  FOR UPDATE;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.bypass_worker_sensitive_guard', 'true', true);

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = v_worker_id;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, trim(p_comment), p_start_date, 'sent')
  RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_bid' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) TO authenticated;
