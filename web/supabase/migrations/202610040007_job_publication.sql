-- Paired with createJob RPC caller. Retains legacy jobs and closes REST INSERT.
BEGIN;
CREATE TABLE IF NOT EXISTS public.job_publications (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  input_hash bytea NOT NULL,
  PRIMARY KEY(user_id,request_id)
);
ALTER TABLE public.job_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_publications FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.job_publications TO service_role;
REVOKE INSERT ON public.jobs FROM PUBLIC,anon,authenticated;
DO $acl$ DECLARE cols text; BEGIN
  SELECT string_agg(quote_ident(attname),', ') INTO cols FROM pg_attribute
    WHERE attrelid='public.jobs'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s) ON public.jobs FROM PUBLIC,anon,authenticated',cols);
END $acl$;

CREATE OR REPLACE FUNCTION public.guard_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
DECLARE spaces constant text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.client_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id=auth.uid() AND blocked_at IS NULL AND char_length(btrim(name,spaces))>=2
    ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
    NEW.description:=btrim(NEW.description,spaces);
    NEW.area:=btrim(NEW.area,spaces);
    IF NEW.status IS DISTINCT FROM 'active' OR NEW.selected_worker_id IS NOT NULL
      OR coalesce(char_length(NEW.description),0) NOT BETWEEN 20 AND 5000
      OR NEW.category IS NULL OR NEW.category NOT IN ('electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting')
      OR NEW.area IS NULL OR char_length(NEW.area)>100
      OR (NEW.budget_min IS NOT NULL AND (NEW.budget_min::text IN ('NaN','Infinity','-Infinity')
        OR NEW.budget_min<0 OR NEW.budget_min>1000000000 OR scale(NEW.budget_min)>2))
      OR (NEW.budget_max IS NOT NULL AND (NEW.budget_max::text IN ('NaN','Infinity','-Infinity')
        OR NEW.budget_max<0 OR NEW.budget_max>1000000000 OR scale(NEW.budget_max)>2))
      OR NEW.budget_max<NEW.budget_min THEN RAISE EXCEPTION 'invalid_input'; END IF;
    NEW.created_at:=now();
    NEW.expires_at:=now()+CASE WHEN NEW.urgent THEN interval '7 days' ELSE interval '30 days' END;
  END IF;
  RETURN NEW;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.publish_pilot_job(p_request_id uuid,p_input jsonb)
RETURNS TABLE(job_id uuid,created boolean,conflict boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $publish$
DECLARE actor_id uuid:=auth.uid(); saved public.job_publications%ROWTYPE;
  fingerprint bytea; new_id uuid; latitude double precision; longitude double precision;
  budget numeric; images text[];
  spaces constant text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
    OR pg_column_size(p_input)>65536
    OR p_input-ARRAY['category','description','city','area','lat','lng','budget','urgent','needs_quote','photos']<>'{}'::jsonb
    OR jsonb_typeof(p_input->'category') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'description') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'city') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'area') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'lat') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_input->'lng') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_input->'urgent') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_input->'needs_quote') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_input->'photos') IS DISTINCT FROM 'array'
    OR (p_input->'budget' IS NULL OR jsonb_typeof(p_input->'budget') NOT IN ('null','number')) THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  -- Serialize per actor before checking for replay or evaluating rolling cap.
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL
    AND char_length(btrim(name,spaces))>=2 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  fingerprint:=sha256(convert_to(p_input::text,'UTF8'));
  SELECT * INTO saved FROM public.job_publications WHERE user_id=actor_id AND request_id=p_request_id;
  IF FOUND THEN
    RETURN QUERY SELECT saved.job_id,false,saved.input_hash<>fingerprint;
    RETURN;
  END IF;
  BEGIN
    latitude:=(p_input->>'lat')::double precision;
    longitude:=(p_input->>'lng')::double precision;
    budget:=(p_input->>'budget')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid_input';
  END;
  IF jsonb_array_length(p_input->'photos')>5 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_input->'photos') e WHERE jsonb_typeof(e)<>'string'
  ) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  images:=ARRAY(SELECT jsonb_array_elements_text(p_input->'photos'));
  INSERT INTO public.jobs(client_id,description,category,city,area,lat,lng,budget_min,urgent,needs_quote,photos)
    VALUES(actor_id,p_input->>'description',p_input->>'category',p_input->>'city',p_input->>'area',latitude,longitude,
      budget,(p_input->>'urgent')::boolean,(p_input->>'needs_quote')::boolean,images) RETURNING id INTO new_id;
  INSERT INTO public.job_publications(user_id,request_id,job_id,input_hash) VALUES(actor_id,p_request_id,new_id,fingerprint);
  RETURN QUERY SELECT new_id,true,false;
END;
$publish$;
REVOKE ALL ON FUNCTION public.publish_pilot_job(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_pilot_job(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
