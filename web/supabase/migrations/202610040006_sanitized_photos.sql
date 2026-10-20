-- Paired with /api/photos. No legacy files or references are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.photo_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  url text UNIQUE
);
CREATE INDEX IF NOT EXISTS photo_uploads_user_created ON public.photo_uploads(user_id,created_at);
ALTER TABLE public.photo_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_uploads FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.photo_uploads TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_photo_upload()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $reserve$
DECLARE actor_id uuid:=auth.uid(); new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- Serializes the rolling limits, including across parallel HTTP requests.
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL
    AND char_length(btrim(name))>=2 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF (SELECT count(*) FROM public.photo_uploads WHERE user_id=actor_id AND created_at>now()-interval '10 minutes')>=15
    OR (SELECT count(*) FROM public.photo_uploads WHERE user_id=actor_id AND created_at>now()-interval '24 hours')>=30 THEN
    RAISE EXCEPTION 'photo_rate_limit';
  END IF;
  INSERT INTO public.photo_uploads(user_id) VALUES(actor_id) RETURNING id INTO new_id;
  RETURN new_id;
END;
$reserve$;
REVOKE ALL ON FUNCTION public.reserve_photo_upload() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_photo_upload() TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('job-photos','job-photos',true,4194304,ARRAY['image/jpeg'])
ON CONFLICT(id) DO UPDATE SET file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
-- RESTRICTIVE rules also close unknown older permissive own-folder policies.
-- Service role bypasses RLS; authenticated users cannot upload raw EXIF or
-- overwrite/delete a published asset directly. Other buckets are unaffected.
DROP POLICY IF EXISTS photo_pipeline_insert ON storage.objects;
DROP POLICY IF EXISTS photo_pipeline_update ON storage.objects;
DROP POLICY IF EXISTS photo_pipeline_delete ON storage.objects;
CREATE POLICY photo_pipeline_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
  WITH CHECK(bucket_id<>'job-photos');
CREATE POLICY photo_pipeline_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING(bucket_id<>'job-photos') WITH CHECK(bucket_id<>'job-photos');
CREATE POLICY photo_pipeline_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING(bucket_id<>'job-photos');

CREATE OR REPLACE FUNCTION public.guard_photo_references()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $references$
DECLARE image text; old_images text[]:=ARRAY[]::text[]; owner_id uuid;
BEGIN
  IF TG_OP='UPDATE' THEN old_images:=coalesce(OLD.photos,ARRAY[]::text[]); END IF;
  IF TG_TABLE_NAME='jobs' THEN owner_id:=NEW.client_id; ELSE owner_id:=NEW.id; END IF;
  -- BEFORE INSERT also runs for the INSERT half of an upsert. Preserve the
  -- owner's existing portfolio when save_my_profile takes that route.
  IF TG_OP='INSERT' AND TG_TABLE_NAME='profiles_worker' THEN
    SELECT coalesce(photos,ARRAY[]::text[]) INTO old_images FROM public.profiles_worker WHERE id=owner_id;
    old_images:=coalesce(old_images,ARRAY[]::text[]);
  END IF;
  IF NEW.photos IS DISTINCT FROM old_images AND (
    cardinality(NEW.photos)>CASE WHEN TG_TABLE_NAME='jobs' THEN 5 ELSE 10 END
    OR coalesce(array_ndims(NEW.photos),1)>1
    OR (SELECT count(DISTINCT entry) FROM unnest(NEW.photos) entry)<>cardinality(NEW.photos)
  ) THEN RAISE EXCEPTION 'invalid_photo_reference'; END IF;
  FOREACH image IN ARRAY coalesce(NEW.photos,ARRAY[]::text[]) LOOP
    -- Retain old references; do not silently destroy existing portfolios/jobs.
    IF image IS NULL THEN RAISE EXCEPTION 'invalid_photo_reference'; END IF;
    IF NOT image=ANY(old_images) AND NOT EXISTS (
      SELECT 1 FROM public.photo_uploads u WHERE u.user_id=owner_id AND u.url=image AND u.uploaded_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'invalid_photo_reference'; END IF;
  END LOOP;
  RETURN NEW;
END;
$references$;
REVOKE ALL ON FUNCTION public.guard_photo_references() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_photo_references ON public.jobs;
DROP TRIGGER IF EXISTS guard_photo_references ON public.profiles_worker;
CREATE TRIGGER guard_photo_references BEFORE INSERT OR UPDATE OF photos ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_photo_references();
CREATE TRIGGER guard_photo_references BEFORE INSERT OR UPDATE OF photos ON public.profiles_worker
  FOR EACH ROW EXECUTE FUNCTION public.guard_photo_references();
NOTIFY pgrst,'reload schema';
COMMIT;
