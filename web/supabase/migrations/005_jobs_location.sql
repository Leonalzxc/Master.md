-- Add lat/lng coordinates to jobs
alter table public.jobs
  add column if not exists lat  double precision,
  add column if not exists lng  double precision;
