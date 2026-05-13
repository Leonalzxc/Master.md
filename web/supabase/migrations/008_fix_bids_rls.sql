-- ============================================================
-- Fix bids insert policy: check role='worker' instead of
-- profiles_worker.completed_at (which may be null for some workers)
-- ============================================================

drop policy if exists "bids_worker_insert" on public.bids;

create policy "bids_worker_insert" on public.bids for insert
  with check (
    worker_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'worker'
    )
  );
