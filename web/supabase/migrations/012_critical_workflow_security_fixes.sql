-- ============================================================
-- Critical workflow security fixes
-- ============================================================
-- Keep credit spending, worker selection, reviews, and protected
-- account fields enforceable at the database boundary. Server
-- actions use SECURITY DEFINER RPCs below; direct authenticated
-- table writes no longer bypass those invariants.

-- ── Shared helpers ───────────────────────────────────────────
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
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_privileged_db_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user NOT IN ('anon', 'authenticated');
$$;

REVOKE ALL ON FUNCTION public.is_privileged_db_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_privileged_db_role() TO anon, authenticated;

-- ── Protect profile/admin-only fields from self escalation ───
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_role() OR public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    IF NEW.role = 'admin'
       OR NEW.blocked_at IS NOT NULL
       OR NEW.block_reason IS NOT NULL THEN
      RAISE EXCEPTION 'protected_profile_field';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.role = 'admin'
     OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at
     OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
    RAISE EXCEPTION 'protected_profile_field';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ── Protect worker system fields from self minting/tampering ─
CREATE OR REPLACE FUNCTION public.protect_worker_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_db_role() OR public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_pro IS DISTINCT FROM false
       OR NEW.verified IS DISTINCT FROM false
       OR NEW.bid_credits IS DISTINCT FROM 5
       OR NEW.rating_avg IS DISTINCT FROM 0
       OR NEW.rating_count IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'protected_worker_field';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.is_pro IS DISTINCT FROM OLD.is_pro
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.bid_credits IS DISTINCT FROM OLD.bid_credits
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count THEN
    RAISE EXCEPTION 'protected_worker_field';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_worker_system_fields ON public.profiles_worker;
CREATE TRIGGER protect_worker_system_fields
  BEFORE INSERT OR UPDATE ON public.profiles_worker
  FOR EACH ROW EXECUTE FUNCTION public.protect_worker_system_fields();

-- ── Disable direct writes that bypass workflow invariants ─────
DROP POLICY IF EXISTS "bids_worker_insert" ON public.bids;
DROP POLICY IF EXISTS "client_update_bids_on_own_jobs" ON public.bids;
DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;

DROP POLICY IF EXISTS "jobs_own_update" ON public.jobs;
CREATE POLICY "jobs_own_cancel" ON public.jobs
  FOR UPDATE
  USING (client_id = auth.uid() AND status = 'active')
  WITH CHECK (
    client_id = auth.uid()
    AND status = 'cancelled'
    AND selected_worker_id IS NULL
  );

-- Keep the old function name non-exploitable for any deployments
-- where clients may still know it. Bid creation uses create_bid.
CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_worker_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = auth.uid() AND bid_credits > 0;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.spend_bid_credit(uuid) FROM authenticated;

-- ── Atomic bid creation with credit deduction ─────────────────
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
  v_role text;
  v_blocked_at timestamptz;
  v_credits integer;
  v_job_status text;
  v_job_expires_at timestamptz;
  v_client_id uuid;
  v_bid_id uuid;
BEGIN
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.role, p.blocked_at, pw.bid_credits
    INTO v_role, v_blocked_at, v_credits
    FROM public.profiles p
    JOIN public.profiles_worker pw ON pw.id = p.id
   WHERE p.id = v_worker_id
   FOR UPDATE OF pw;

  IF v_role IS DISTINCT FROM 'worker' THEN
    RAISE EXCEPTION 'not_worker';
  END IF;

  IF v_blocked_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  IF v_credits IS NULL OR v_credits < 1 THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  SELECT status, expires_at, client_id
    INTO v_job_status, v_job_expires_at, v_client_id
    FROM public.jobs
   WHERE id = p_job_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_client_id = v_worker_id THEN
    RAISE EXCEPTION 'cannot_bid_own_job';
  END IF;

  IF v_job_status <> 'active' OR v_job_expires_at <= now() THEN
    RAISE EXCEPTION 'job_not_active';
  END IF;

  BEGIN
    INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
    VALUES (p_job_id, v_worker_id, p_price, btrim(p_comment), p_start_date, 'sent')
    RETURNING id INTO v_bid_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_bid' USING ERRCODE = '23505';
  END;

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = v_worker_id;

  RETURN v_bid_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bid(uuid, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bid(uuid, numeric, text, date) TO authenticated;

-- ── Atomic worker selection ──────────────────────────────────
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
  v_client_id uuid;
  v_status text;
  v_worker_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT client_id, status
    INTO v_client_id, v_status
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_status <> 'active' THEN
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
    RAISE EXCEPTION 'invalid_bid';
  END IF;

  UPDATE public.bids
  SET status = CASE WHEN id = p_bid_id THEN 'selected' ELSE 'rejected' END
  WHERE job_id = p_job_id;

  UPDATE public.jobs
  SET status = 'in_progress',
      selected_worker_id = v_worker_id
  WHERE id = p_job_id;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;

-- ── Atomic review completion and rating recalculation ─────────
CREATE OR REPLACE FUNCTION public.complete_job_with_review(
  p_job_id uuid,
  p_rating integer,
  p_text text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_status text;
  v_worker_id uuid;
  v_rating_avg numeric(3,2);
  v_rating_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT client_id, status, selected_worker_id
    INTO v_client_id, v_status, v_worker_id
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  IF v_client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'no_worker_selected';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  INSERT INTO public.reviews (job_id, author_id, worker_id, rating, text)
  VALUES (p_job_id, auth.uid(), v_worker_id, p_rating, NULLIF(btrim(p_text), ''));

  UPDATE public.jobs
  SET status = 'done'
  WHERE id = p_job_id;

  SELECT round(avg(rating)::numeric, 2), count(*)::integer
    INTO v_rating_avg, v_rating_count
    FROM public.reviews
   WHERE worker_id = v_worker_id;

  UPDATE public.profiles_worker
  SET rating_avg = COALESCE(v_rating_avg, 0),
      rating_count = COALESCE(v_rating_count, 0)
  WHERE id = v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_job_with_review(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) TO authenticated;
