-- ============================================================
-- MASTER Moldova — Job photos via Supabase Storage
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- jobs.photos already exists (text[]) in 001_init_schema.sql
-- This migration sets up the Storage bucket + policies.

-- ── Storage bucket ────────────────────────────────────────────
-- Run this in SQL Editor (storage schema):
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  true,
  5242880,  -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- ── Storage RLS policies ──────────────────────────────────────
-- Anyone can read (bucket is public)
create policy "job_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'job-photos');

-- Authenticated users can upload to their own folder: {user_id}/{filename}
create policy "job_photos_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
create policy "job_photos_auth_delete"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
