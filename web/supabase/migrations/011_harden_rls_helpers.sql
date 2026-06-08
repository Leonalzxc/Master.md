-- ============================================================
-- Harden RLS helper functions and notification inserts
-- ============================================================

-- The jobs_worker_bid_read policy calls this SECURITY DEFINER helper to avoid
-- recursive jobs <-> bids RLS checks. Keep that policy path working, but make
-- direct RPC calls unable to probe bid relationships for other workers.
CREATE OR REPLACE FUNCTION public.worker_has_bid_on_job(p_job_id uuid, p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_worker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bids
      WHERE job_id = p_job_id AND worker_id = p_worker_id
    );
$$;

-- Notification rows are created by SECURITY DEFINER triggers. A public INSERT
-- policy lets any API caller forge notifications for arbitrary users.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
