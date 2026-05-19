-- Atomically select a worker for a job.
--
-- The client action must not trust a browser-provided worker id. This helper
-- verifies ownership and bid membership inside one transaction, derives the
-- selected worker from the bid row, and updates the related rows together.

-- Keep the RLS recursion breaker from 010, but bind it to the current user so
-- direct RPC calls cannot probe whether arbitrary workers bid on private jobs.
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
      SELECT 1 FROM public.bids
      WHERE job_id = p_job_id AND worker_id = p_worker_id
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
  v_job public.jobs%ROWTYPE;
  v_bid public.bids%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_job.status <> 'active' THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_bid
  FROM public.bids
  WHERE id = p_bid_id
    AND job_id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.bids
  SET status = CASE WHEN id = p_bid_id THEN 'selected' ELSE 'rejected' END
  WHERE job_id = p_job_id;

  UPDATE public.jobs
  SET
    status = 'in_progress',
    selected_worker_id = v_bid.worker_id
  WHERE id = p_job_id;

  RETURN v_bid.worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;
