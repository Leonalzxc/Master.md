-- Harden critical multi-row job actions.
--
-- Browser-supplied worker ids are not trustworthy, and selecting a bid or
-- completing a job spans multiple tables. Keep those invariants in
-- SECURITY DEFINER functions so ownership, bid membership, and status checks
-- happen in the same transaction as the writes.

CREATE OR REPLACE FUNCTION public.worker_has_bid_on_job(p_job_id uuid, p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_worker_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.bids
      WHERE job_id = p_job_id
        AND worker_id = p_worker_id
    );
$$;

REVOKE ALL ON FUNCTION public.worker_has_bid_on_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_has_bid_on_job(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.worker_has_bid_on_job(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.select_worker_for_job(p_job_id uuid, p_bid_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_job_status text;
  v_worker_id uuid;
  v_bid_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT client_id, status
    INTO v_client_id, v_job_status
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_client_id <> v_user_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_job_status <> 'active' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  SELECT worker_id, status
    INTO v_worker_id, v_bid_status
    FROM public.bids
   WHERE id = p_bid_id
     AND job_id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_bid_status <> 'sent' THEN
    RAISE EXCEPTION 'invalid_bid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bids
     SET status = CASE WHEN id = p_bid_id THEN 'selected' ELSE 'rejected' END
   WHERE job_id = p_job_id
     AND status = 'sent';

  UPDATE public.jobs
     SET status = 'in_progress',
         selected_worker_id = v_worker_id
   WHERE id = p_job_id;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_job_with_review(
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
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_job_status text;
  v_worker_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = '22003';
  END IF;

  SELECT client_id, status, selected_worker_id
    INTO v_client_id, v_job_status, v_worker_id
    FROM public.jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_client_id <> v_user_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_job_status <> 'in_progress' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'no_worker_selected' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.reviews
     WHERE job_id = p_job_id
       AND author_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.reviews (job_id, author_id, worker_id, rating, text)
  VALUES (p_job_id, v_user_id, v_worker_id, p_rating, NULLIF(BTRIM(p_text), ''));

  UPDATE public.jobs
     SET status = 'done'
   WHERE id = p_job_id;

  UPDATE public.profiles_worker pw
     SET rating_avg = stats.rating_avg,
         rating_count = stats.rating_count
    FROM (
      SELECT ROUND(AVG(rating)::numeric, 1) AS rating_avg,
             COUNT(*)::int AS rating_count
        FROM public.reviews
       WHERE worker_id = v_worker_id
    ) stats
   WHERE pw.id = v_worker_id;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_job_with_review(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_job_with_review(uuid, integer, text) TO authenticated;
