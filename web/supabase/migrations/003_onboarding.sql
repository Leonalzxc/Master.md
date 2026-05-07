-- Add verification tracking to worker profiles
alter table public.profiles_worker
  add column if not exists verification_submitted_at timestamptz;

-- Storage bucket for verification documents (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do nothing;

-- Storage RLS policies
create policy "workers_upload_own_verification_doc"
on storage.objects for insert
with check (
  bucket_id = 'verification-docs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "workers_read_own_verification_doc"
on storage.objects for select
using (
  bucket_id = 'verification-docs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
