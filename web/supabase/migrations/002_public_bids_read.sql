-- Allow anyone to read bids on active jobs
-- Workers compete publicly — showing bids builds trust for the marketplace
create policy "bids_public_read_on_active_jobs" on public.bids for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = bids.job_id and jobs.status = 'active'
    )
  );
