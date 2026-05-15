-- Allow the accepted worker to read the job after it leaves the public
-- "active" state. Without this, contacts-after-acceptance is blocked by RLS.
create policy "jobs_selected_worker_read" on public.jobs for select
  using (
    status in ('in_progress', 'done')
    and (
      selected_worker_id = auth.uid()
      or exists (
        select 1 from public.bids
        where bids.job_id = jobs.id
          and bids.worker_id = auth.uid()
          and bids.status = 'selected'
      )
    )
  );
