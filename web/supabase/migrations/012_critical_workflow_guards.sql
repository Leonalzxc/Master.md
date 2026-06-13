-- ============================================================
-- Critical workflow guards
-- ============================================================

-- Shared helper for RLS policies and SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.is_active_profile(p_user_id uuid)
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

REVOKE EXECUTE ON FUNCTION public.is_active_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO authenticated;

-- ============================================================
-- Profiles: prevent self-admin/self-unblock and worker-system-field tampering
-- ============================================================

DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND blocked_at IS NULL
  )
  WITH CHECK (
    id = auth.uid()
    AND role IN ('client', 'worker')
    AND blocked_at IS NULL
    AND block_reason IS NULL
  );

CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.blocked_at IS NULL
    )
  );

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.blocked_at IS NULL
    )
  );

REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT INSERT (id, phone, role, name, city, telegram_chat_id) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (name, city, role, telegram_chat_id) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "worker_own_write" ON public.profiles_worker;

CREATE POLICY "worker_own_insert" ON public.profiles_worker
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND public.is_active_profile(auth.uid())
    AND is_pro = false
    AND verified = false
    AND bid_credits = 5
    AND rating_avg = 0
    AND rating_count = 0
    AND completed_at IS NULL
  );

CREATE POLICY "worker_own_update" ON public.profiles_worker
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND public.is_active_profile(auth.uid())
  )
  WITH CHECK (
    id = auth.uid()
    AND public.is_active_profile(auth.uid())
  );

REVOKE INSERT, UPDATE ON TABLE public.profiles_worker FROM anon, authenticated;
GRANT INSERT (
  id,
  categories,
  areas,
  experience_yrs,
  bio,
  photos,
  viber,
  telegram,
  whatsapp,
  verification_submitted_at
) ON TABLE public.profiles_worker TO authenticated;
GRANT UPDATE (
  id,
  categories,
  areas,
  experience_yrs,
  bio,
  photos,
  viber,
  telegram,
  whatsapp,
  verification_submitted_at
) ON TABLE public.profiles_worker TO authenticated;

-- ============================================================
-- Jobs: blocked users cannot create or mutate jobs
-- ============================================================

DROP POLICY IF EXISTS "jobs_own_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_own_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_read" ON public.jobs;
DROP POLICY IF EXISTS "jobs_admin_update" ON public.jobs;

CREATE POLICY "jobs_own_insert" ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND public.is_active_profile(auth.uid())
  );

CREATE POLICY "jobs_own_update" ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
    AND public.is_active_profile(auth.uid())
  )
  WITH CHECK (
    client_id = auth.uid()
    AND public.is_active_profile(auth.uid())
  );

CREATE POLICY "jobs_admin_read" ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.blocked_at IS NULL
    )
  );

CREATE POLICY "jobs_admin_update" ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.blocked_at IS NULL
    )
  );

-- ============================================================
-- Bid credits and bid creation: caller-bound and transactional
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_bid_credit(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF auth.uid() IS NULL OR p_worker_id IS DISTINCT FROM auth.uid() THEN
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

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = p_worker_id;

  RETURN true;
END;
$$;

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

  PERFORM 1
  FROM public.jobs AS j
  JOIN public.profiles AS client ON client.id = j.client_id
  WHERE j.id = p_job_id
    AND j.status = 'active'
    AND j.expires_at > now()
    AND client.blocked_at IS NULL
  FOR UPDATE OF j;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
  VALUES (p_job_id, v_worker_id, p_price, btrim(p_comment), p_start_date, 'sent')
  RETURNING id INTO v_bid_id;

  UPDATE public.profiles_worker
  SET bid_credits = bid_credits - 1
  WHERE id = v_worker_id;

  RETURN v_bid_id;
END;
$$;

REVOKE INSERT, UPDATE ON TABLE public.bids FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_bid_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bid_with_credit(uuid, numeric, text, date) TO authenticated;

-- ============================================================
-- Worker selection: validate bid-job-worker integrity atomically
-- ============================================================

CREATE OR REPLACE FUNCTION public.select_worker_for_job(
  p_job_id uuid,
  p_bid_id uuid,
  p_worker_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_worker_id uuid;
  v_job_status text;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT j.status INTO v_job_status
  FROM public.jobs AS j
  JOIN public.profiles AS client ON client.id = j.client_id
  WHERE j.id = p_job_id
    AND j.client_id = v_client_id
    AND client.blocked_at IS NULL
  FOR UPDATE OF j;

  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_job_status <> 'active' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT b.worker_id INTO v_worker_id
  FROM public.bids AS b
  JOIN public.profiles AS worker ON worker.id = b.worker_id
  WHERE b.id = p_bid_id
    AND b.job_id = p_job_id
    AND b.worker_id = p_worker_id
    AND b.status = 'sent'
    AND worker.role = 'worker'
    AND worker.blocked_at IS NULL
  FOR UPDATE OF b;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'invalid_bid';
  END IF;

  UPDATE public.bids
  SET status = 'rejected'
  WHERE job_id = p_job_id
    AND id <> p_bid_id
    AND status <> 'rejected';

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

REVOKE EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid, uuid) TO authenticated;

-- ============================================================
-- Reviews: enforce legitimate review writes and maintain ratings
-- ============================================================

DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;

CREATE POLICY "reviews_client_insert" ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.jobs AS j
      JOIN public.profiles AS worker ON worker.id = j.selected_worker_id
      WHERE j.id = reviews.job_id
        AND j.client_id = auth.uid()
        AND j.status = 'in_progress'
        AND j.selected_worker_id = reviews.worker_id
        AND worker.role = 'worker'
        AND worker.blocked_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.refresh_worker_rating(p_worker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating_avg numeric(3,2);
  v_rating_count integer;
BEGIN
  SELECT COALESCE(round(avg(rating)::numeric, 1), 0), count(*)::integer
  INTO v_rating_avg, v_rating_count
  FROM public.reviews
  WHERE worker_id = p_worker_id;

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
    PERFORM public.refresh_worker_rating(OLD.worker_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_worker_rating(NEW.worker_id);

  IF TG_OP = 'UPDATE' AND NEW.worker_id IS DISTINCT FROM OLD.worker_id THEN
    PERFORM public.refresh_worker_rating(OLD.worker_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_worker_rating ON public.reviews;
CREATE TRIGGER trg_refresh_worker_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_worker_rating_from_review();

CREATE OR REPLACE FUNCTION public.submit_review_for_job(
  p_job_id uuid,
  p_rating integer,
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid := auth.uid();
  v_worker_id uuid;
BEGIN
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  SELECT j.selected_worker_id INTO v_worker_id
  FROM public.jobs AS j
  JOIN public.profiles AS client ON client.id = j.client_id
  JOIN public.profiles AS worker ON worker.id = j.selected_worker_id
  WHERE j.id = p_job_id
    AND j.client_id = v_author_id
    AND j.status = 'in_progress'
    AND j.selected_worker_id IS NOT NULL
    AND client.blocked_at IS NULL
    AND worker.role = 'worker'
    AND worker.blocked_at IS NULL
  FOR UPDATE OF j;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'invalid_job';
  END IF;

  INSERT INTO public.reviews (job_id, author_id, worker_id, rating, text)
  VALUES (p_job_id, v_author_id, v_worker_id, p_rating, NULLIF(btrim(p_text), ''));

  UPDATE public.jobs
  SET status = 'done'
  WHERE id = p_job_id;

  RETURN v_worker_id;
END;
$$;

-- The RPC is the only application write path; table INSERT remains policy-guarded
-- for service-side repair scripts but unavailable to browser clients.
REVOKE INSERT ON TABLE public.reviews FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_worker_rating(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_worker_rating_from_review() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_review_for_job(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review_for_job(uuid, integer, text) TO authenticated;

UPDATE public.profiles_worker AS pw
SET rating_avg = stats.rating_avg,
    rating_count = stats.rating_count
FROM (
  SELECT worker_id,
         COALESCE(round(avg(rating)::numeric, 1), 0)::numeric(3,2) AS rating_avg,
         count(*)::integer AS rating_count
  FROM public.reviews
  GROUP BY worker_id
) AS stats
WHERE pw.id = stats.worker_id;

UPDATE public.profiles_worker AS pw
SET rating_avg = 0,
    rating_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reviews AS r
  WHERE r.worker_id = pw.id
);

-- ============================================================
-- Admin privileged mutations
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_user_blocked(
  p_user_id uuid,
  p_blocked boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS me
    WHERE me.id = auth.uid()
      AND me.role = 'admin'
      AND me.blocked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
  SET blocked_at = CASE WHEN p_blocked THEN now() ELSE NULL END,
      block_reason = CASE WHEN p_blocked THEN COALESCE(NULLIF(btrim(p_reason), ''), 'Blocked by administrator') ELSE NULL END
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS me
    WHERE me.id = auth.uid()
      AND me.role = 'admin'
      AND me.blocked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.set_user_blocked(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_blocked(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_bid_credits(uuid, integer) TO authenticated;
