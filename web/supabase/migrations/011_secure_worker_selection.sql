-- Select a worker from a bid in one trusted transaction.
-- The client supplies only job and bid ids; the worker id is read from bids.
CREATE OR REPLACE FUNCTION public.select_worker_for_job(p_job_id uuid, p_bid_id uuid)
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
  SELECT client_id, status
    INTO v_client_id, v_status
    FROM public.jobs
    WHERE id = p_job_id
    FOR UPDATE;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR v_client_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Job is not active' USING ERRCODE = 'P0001';
  END IF;

  SELECT worker_id
    INTO v_worker_id
    FROM public.bids
    WHERE id = p_bid_id
      AND job_id = p_job_id
    FOR UPDATE;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found for job' USING ERRCODE = 'P0002';
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
REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;

-- Keep the RLS helper usable in policies, but make direct RPC calls unable to
-- probe whether another worker has bid on a job.
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
