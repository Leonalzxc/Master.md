-- Allow workers to read jobs they have placed a bid on.
--
-- IMPORTANT: We cannot do a plain EXISTS (SELECT 1 FROM bids ...) in the jobs policy
-- because bids_client_read policy itself does EXISTS (SELECT 1 FROM jobs ...),
-- which creates infinite recursion. The fix is a SECURITY DEFINER helper function
-- that reads bids WITHOUT triggering RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.worker_has_bid_on_job(p_job_id uuid, p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bids
    WHERE job_id = p_job_id AND worker_id = p_worker_id
  );
$$;

-- Drop old version if it was created without SECURITY DEFINER
DROP POLICY IF EXISTS "jobs_worker_bid_read" ON public.jobs;

CREATE POLICY "jobs_worker_bid_read" ON public.jobs
  FOR SELECT
  USING (public.worker_has_bid_on_job(id, auth.uid()));
