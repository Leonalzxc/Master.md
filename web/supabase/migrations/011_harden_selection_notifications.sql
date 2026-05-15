-- Harden notification inserts and bid visibility helper.
--
-- Notification rows are created by SECURITY DEFINER trigger functions. A public
-- insert policy lets any API caller forge notifications for arbitrary users.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;

-- Keep the jobs RLS helper bound to the authenticated user even if it is called
-- directly through RPC. The jobs policy already passes auth.uid(), so policy
-- behavior is unchanged.
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
