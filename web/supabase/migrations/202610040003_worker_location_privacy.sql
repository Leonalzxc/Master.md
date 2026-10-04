-- Deploy with explicit public column readers. Retains all existing data.
BEGIN;
REVOKE SELECT ON public.jobs,public.profiles_worker FROM PUBLIC,anon,authenticated;
DO $acl$
DECLARE tab text;cols text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['jobs','profiles_worker'] LOOP
    SELECT string_agg(quote_ident(attname),', ') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',tab)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,tab);
  END LOOP;
END;
$acl$;
GRANT SELECT (id,client_id,description,category,city,area,budget_min,budget_max,urgent,needs_quote,photos,status,selected_worker_id,created_at,expires_at)
  ON public.jobs TO anon,authenticated;
GRANT SELECT (id,categories,areas,experience_yrs,bio,photos,is_pro,rating_avg,rating_count,verified,completed_at)
  ON public.profiles_worker TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_worker_profile()
RETURNS SETOF public.profiles_worker LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $own$
  SELECT w.* FROM public.profiles_worker w WHERE w.id=auth.uid() AND auth.uid() IS NOT NULL;
$own$;
CREATE OR REPLACE FUNCTION public.get_job_location(p_job_id uuid)
RETURNS TABLE(lat double precision,lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $loc$
  SELECT j.lat,j.lng FROM public.jobs j JOIN public.profiles actor ON actor.id=auth.uid()
  JOIN public.profiles client ON client.id=j.client_id
  WHERE j.id=p_job_id AND actor.blocked_at IS NULL AND client.blocked_at IS NULL AND (
    j.client_id=auth.uid() OR (j.status='in_progress' AND j.selected_worker_id=auth.uid()
      AND EXISTS (SELECT 1 FROM public.bids b WHERE b.job_id=j.id AND b.worker_id=auth.uid() AND b.status='selected'))
  );
$loc$;
CREATE OR REPLACE FUNCTION public.get_job_worker_contact(p_job_id uuid)
RETURNS TABLE(name text,phone text,viber text,telegram text,whatsapp text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $contact$
  SELECT worker.name,worker.phone,w.viber,w.telegram,w.whatsapp FROM public.jobs j
  JOIN public.profiles worker ON worker.id=j.selected_worker_id
  JOIN public.profiles client ON client.id=j.client_id
  JOIN public.profiles_worker w ON w.id=worker.id
  WHERE j.id=p_job_id AND j.client_id=auth.uid() AND j.status='in_progress'
    AND client.blocked_at IS NULL AND worker.blocked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.job_id=j.id AND b.worker_id=worker.id AND b.status='selected');
$contact$;
REVOKE ALL ON FUNCTION public.get_my_worker_profile(),public.get_job_location(uuid),public.get_job_worker_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_worker_profile(),public.get_job_location(uuid),public.get_job_worker_contact(uuid) TO authenticated;
-- Atomic profile edits use the authenticated identity, never a supplied user id.
CREATE OR REPLACE FUNCTION public.save_my_profile(p_data jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $save$
DECLARE actor_id uuid:=auth.uid(); cats text[]; zones text[]; images text[]; exp integer;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_data IS NULL OR p_data->>'role' NOT IN ('client','worker') OR p_data->>'city' IS DISTINCT FROM 'Бельцы'
    OR coalesce(char_length(btrim(p_data->>'name')),0) NOT BETWEEN 2 AND 80
    OR char_length(coalesce(p_data->>'bio',''))>2000
    OR char_length(coalesce(p_data->>'viber',''))>100 OR char_length(coalesce(p_data->>'telegram',''))>100
    OR char_length(coalesce(p_data->>'whatsapp',''))>100 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  cats:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'categories','[]'::jsonb)));
  zones:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'areas','[]'::jsonb)));
  images:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'photos','[]'::jsonb)));
  exp:=nullif(p_data->>'experience_yrs','')::integer;
  IF cardinality(cats)>8 OR cardinality(zones)>20 OR cardinality(images)>10 OR exp NOT BETWEEN 0 AND 80
    OR NOT cats <@ ARRAY['electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting'] THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  UPDATE public.profiles SET name=btrim(p_data->>'name'),role=p_data->>'role',city='Бельцы' WHERE id=actor_id;
  INSERT INTO public.profiles_worker(id,bio,categories,areas,experience_yrs,viber,telegram,whatsapp,photos)
    VALUES(actor_id,nullif(btrim(p_data->>'bio'),''),cats,zones,exp,
      nullif(btrim(p_data->>'viber'),''),nullif(btrim(p_data->>'telegram'),''),nullif(btrim(p_data->>'whatsapp'),''),images)
  ON CONFLICT(id) DO UPDATE SET bio=excluded.bio,categories=excluded.categories,areas=excluded.areas,
    experience_yrs=excluded.experience_yrs,viber=excluded.viber,telegram=excluded.telegram,whatsapp=excluded.whatsapp,photos=excluded.photos;
  RETURN true;
END;
$save$;
REVOKE ALL ON FUNCTION public.save_my_profile(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_profile(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
