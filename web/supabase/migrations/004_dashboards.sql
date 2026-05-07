-- Allow job owner (client) to update bid statuses (select / reject workers)
create policy "client_update_bids_on_own_jobs" on public.bids for update
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = bids.job_id and jobs.client_id = auth.uid()
    )
  );
