-- Allow workers to read jobs they have placed a bid on
-- Previously the jobs_active_read policy only allowed:
--   status = 'active'  OR  client_id = auth.uid()
-- This meant workers couldn't see in_progress/done jobs in their bid joins,
-- making the worker dashboard show empty "В работе" / "Завершённые" sections.

CREATE POLICY "jobs_worker_bid_read" ON public.jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bids
      WHERE bids.job_id = jobs.id
        AND bids.worker_id = auth.uid()
    )
  );
