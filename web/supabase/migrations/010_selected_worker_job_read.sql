-- Keep accepted jobs visible to the selected worker.
-- Without this, changing a job to in_progress hides it from the worker who
-- needs the job page to see the client's contact details.

drop policy if exists "jobs_active_read" on public.jobs;

create policy "jobs_active_read" on public.jobs for select
  using (
    status = 'active'
    or client_id = auth.uid()
    or selected_worker_id = auth.uid()
  );
