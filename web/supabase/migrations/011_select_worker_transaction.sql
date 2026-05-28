-- Atomically select a bid's worker for an active job.
--
-- The application previously performed this as several independent updates,
-- which could leave bids/job status inconsistent if the bid did not belong to
-- the job or two selections raced. Keeping it in one function makes the row
-- lock and status transition indivisible.

CREATE OR REPLACE FUNCTION public.select_worker_for_job(p_job_id uuid, p_bid_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
BEGIN
  SELECT b.worker_id
    INTO v_worker_id
    FROM public.jobs j
    JOIN public.bids b ON b.job_id = j.id
   WHERE j.id = p_job_id
     AND b.id = p_bid_id
     AND j.client_id = auth.uid()
     AND j.status = 'active'
     AND b.status = 'sent'
   FOR UPDATE OF j;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'invalid_bid_selection'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bids
     SET status = CASE WHEN id = p_bid_id THEN 'selected' ELSE 'rejected' END
   WHERE job_id = p_job_id;

  UPDATE public.jobs
     SET status = 'in_progress',
         selected_worker_id = v_worker_id
   WHERE id = p_job_id
     AND client_id = auth.uid()
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_bid_selection'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.select_worker_for_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_worker_for_job(uuid, uuid) TO authenticated;
