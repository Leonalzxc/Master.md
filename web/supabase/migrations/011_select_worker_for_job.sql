-- Atomically select a worker for an active job owned by the caller.
--
-- The server action must not trust client-provided worker IDs: the selected
-- worker is derived from the bid row while the job row is locked.

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

  IF v_client_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_job_status <> 'active' THEN
    RAISE EXCEPTION 'job_not_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT worker_id
    INTO v_worker_id
    FROM public.bids
    WHERE id = p_bid_id
      AND job_id = p_job_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_bid' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.jobs
    SET status = 'in_progress',
        selected_worker_id = v_worker_id
    WHERE id = p_job_id
      AND client_id = v_user_id
      AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_active' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bids
    SET status = 'selected'
    WHERE id = p_bid_id
      AND job_id = p_job_id;

  UPDATE public.bids
    SET status = 'rejected'
    WHERE job_id = p_job_id
      AND id <> p_bid_id;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;
