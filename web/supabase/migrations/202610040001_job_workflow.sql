-- Upgrade after 202609230001 and 202609240001. No rows are deleted.
BEGIN;

-- All state transitions go through actor-aware transactional functions.
REVOKE UPDATE, DELETE ON public.jobs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.bids FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon, authenticated;
DO $acl$
DECLARE tab text; cols text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['jobs','bids','reviews','notifications'] LOOP
    SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
      WHERE attrelid = format('public.%I', tab)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE UPDATE (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, tab);
    IF tab IN ('reviews','notifications') THEN
      EXECUTE format('REVOKE INSERT (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, tab);
    END IF;
  END LOOP;
END;
$acl$;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- This old helper can exist in deployed databases with another notification schema.
DO $old_rpc$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT oid::regprocedure FROM pg_proc
    WHERE pronamespace='public'::regnamespace AND proname='create_notification'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f); END LOOP;
END;
$old_rpc$;

CREATE OR REPLACE FUNCTION public.select_job_worker(p_job_id uuid, p_bid_id uuid)
RETURNS TABLE(worker_id uuid, changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $select$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE; b public.bids%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN
    RAISE EXCEPTION 'account_blocked';
  END IF;
  SELECT * INTO b FROM public.bids WHERE id=p_bid_id AND job_id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_bid'; END IF;
  IF j.status IN ('in_progress','done') AND j.selected_worker_id=b.worker_id AND b.status='selected' THEN
    RETURN QUERY SELECT b.worker_id,false; RETURN;
  END IF;
  IF j.status<>'active' OR j.expires_at<=now() OR b.status<>'sent' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  PERFORM id FROM public.profiles WHERE id=b.worker_id FOR SHARE;
  IF b.worker_id=actor_id OR NOT EXISTS (SELECT 1 FROM public.profiles
    WHERE id=b.worker_id AND role='worker' AND blocked_at IS NULL) THEN RAISE EXCEPTION 'invalid_bid'; END IF;
  UPDATE public.bids SET status=CASE WHEN id=p_bid_id THEN 'selected' ELSE 'rejected' END WHERE job_id=p_job_id;
  UPDATE public.jobs SET status='in_progress',selected_worker_id=b.worker_id WHERE id=p_job_id;
  RETURN QUERY SELECT b.worker_id,true;
END;
$select$;

CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $cancel$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN RAISE EXCEPTION 'account_blocked'; END IF;
  IF j.status='cancelled' THEN RETURN false; END IF;
  IF j.status<>'active' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.bids SET status='rejected' WHERE job_id=p_job_id AND status='sent';
  UPDATE public.jobs SET status='cancelled' WHERE id=p_job_id;
  RETURN true;
END;
$cancel$;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id uuid,p_rating integer,p_text text DEFAULT '')
RETURNS TABLE(review_id uuid,changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $complete$
DECLARE actor_id uuid:=auth.uid(); j public.jobs%ROWTYPE; existing_id uuid; new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR char_length(coalesce(p_text,''))>1000 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO j FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND OR j.client_id<>actor_id THEN RAISE EXCEPTION 'not_authorized'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL) THEN RAISE EXCEPTION 'account_blocked'; END IF;
  SELECT id INTO existing_id FROM public.reviews WHERE job_id=p_job_id AND author_id=actor_id;
  IF j.status='done' AND existing_id IS NOT NULL THEN
    RETURN QUERY SELECT existing_id,false; RETURN;
  END IF;
  IF j.status<>'in_progress' OR j.selected_worker_id IS NULL OR existing_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.bids WHERE job_id=p_job_id AND worker_id=j.selected_worker_id AND status='selected') THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  -- Serialize two completed jobs for one worker before recomputing the rating.
  PERFORM id FROM public.profiles_worker WHERE id=j.selected_worker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state'; END IF;
  INSERT INTO public.reviews(job_id,author_id,worker_id,rating,text)
    VALUES(p_job_id,actor_id,j.selected_worker_id,p_rating,nullif(btrim(coalesce(p_text,'')),'')) RETURNING id INTO new_id;
  UPDATE public.jobs SET status='done' WHERE id=p_job_id;
  UPDATE public.profiles_worker w SET rating_avg=s.avg,rating_count=s.n FROM (
    SELECT coalesce(round(avg(r.rating),2),0) AS avg,count(*)::integer AS n
    FROM public.reviews r JOIN public.jobs job ON job.id=r.job_id
    WHERE r.worker_id=j.selected_worker_id AND job.status='done'
      AND job.selected_worker_id=r.worker_id AND job.client_id=r.author_id
  ) s WHERE w.id=j.selected_worker_id;
  RETURN QUERY SELECT new_id,true;
END;
$complete$;

REVOKE ALL ON FUNCTION public.select_job_worker(uuid,uuid),public.cancel_job(uuid),public.complete_job(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.select_job_worker(uuid,uuid),public.cancel_job(uuid),public.complete_job(uuid,integer,text) TO authenticated;

-- New requests must also obey identity, block and initial-state invariants,
-- including requests sent directly to PostgREST.
CREATE OR REPLACE FUNCTION public.guard_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $new_job$
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.client_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id=auth.uid() AND blocked_at IS NULL AND name IS NOT NULL AND btrim(name)<>''
    ) THEN RAISE EXCEPTION 'not_authorized'; END IF;
    IF NEW.status<>'active' OR NEW.selected_worker_id IS NOT NULL
      OR char_length(btrim(NEW.description)) NOT BETWEEN 10 AND 5000
      OR NEW.category NOT IN ('electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting')
      OR NEW.budget_min<0 OR NEW.budget_max<0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
    NEW.expires_at:=now()+CASE WHEN NEW.urgent THEN interval '7 days' ELSE interval '30 days' END;
  END IF;
  RETURN NEW;
END;
$new_job$;
DROP TRIGGER IF EXISTS guard_new_job ON public.jobs;
CREATE TRIGGER guard_new_job BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_new_job();

NOTIFY pgrst,'reload schema';
COMMIT;
