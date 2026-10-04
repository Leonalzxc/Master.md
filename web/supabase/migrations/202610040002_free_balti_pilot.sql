-- Approved free RU/RO pilot in Bălți. Apply after 202610040001.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_bid(
  p_job_id uuid, p_price numeric, p_comment text, p_start_date date DEFAULT NULL
)
RETURNS TABLE (bid_id uuid, created boolean, credits_remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  target public.jobs%ROWTYPE;
  actor public.profiles%ROWTYPE;
  existing_id uuid;
  balance integer;
  new_id uuid;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_price IS NULL OR p_price::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_price <= 0 OR p_price > 1000000000
     OR p_comment IS NULL OR char_length(btrim(p_comment)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Serializes retries on one job, including concurrent select/cancel/expire.
  SELECT * INTO target FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_unavailable'; END IF;
  IF target.client_id = actor_id THEN RAISE EXCEPTION 'own_job'; END IF;

  -- Prevent a concurrent block/role change from taking effect mid-operation.
  PERFORM id FROM public.profiles WHERE id IN (actor_id, target.client_id) ORDER BY id FOR SHARE;
  SELECT * INTO actor FROM public.profiles WHERE id = actor_id;
  IF NOT FOUND OR actor.role <> 'worker' THEN RAISE EXCEPTION 'not_worker'; END IF;
  IF actor.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'account_blocked'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target.client_id AND blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;

  -- Serializes the rolling daily limit across jobs for the same worker.
  SELECT bid_credits INTO balance FROM public.profiles_worker WHERE id = actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_worker'; END IF;
  SELECT id INTO existing_id FROM public.bids WHERE job_id = p_job_id AND worker_id = actor_id;
  IF FOUND THEN
    RETURN QUERY SELECT existing_id, false, balance;
    RETURN;
  END IF;

  IF target.status <> 'active' OR target.expires_at <= now() THEN
    RAISE EXCEPTION 'job_unavailable';
  END IF;
  IF p_start_date IS NOT NULL AND p_start_date < current_date THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF target.city <> 'Бельцы' THEN RAISE EXCEPTION 'job_unavailable'; END IF;
  IF (SELECT count(*) FROM public.bids WHERE worker_id=actor_id
      AND created_at > now()-interval '24 hours') >= 10 THEN RAISE EXCEPTION 'daily_limit'; END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
    VALUES (p_job_id, actor_id, p_price, btrim(p_comment), p_start_date, 'sent') RETURNING id INTO new_id;
  -- Free pilot: existing balances are preserved; no credit is deducted.
  RETURN QUERY SELECT new_id, true, balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_bid(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bid(uuid, numeric, text, date) TO authenticated;


-- Existing jobs and balances are retained; only NEW pilot requests are scoped.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
CREATE OR REPLACE FUNCTION public.guard_pilot_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $pilot$
BEGIN
  IF auth.role()='authenticated' THEN
    IF NEW.city <> 'Бельцы' OR NEW.lat IS NULL OR NEW.lng IS NULL
      OR NOT (NEW.lat BETWEEN 47.68 AND 47.83 AND NEW.lng BETWEEN 27.82 AND 28.02)
    THEN RAISE EXCEPTION 'pilot_location_required'; END IF;
    -- The row lock makes concurrent requests obey the same rolling limit.
    PERFORM id FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
    IF (SELECT count(*) FROM public.jobs WHERE client_id=auth.uid()
      AND created_at > now()-interval '24 hours') >= 5 THEN RAISE EXCEPTION 'job_daily_limit'; END IF;
  END IF;
  RETURN NEW;
END;
$pilot$;
DROP TRIGGER IF EXISTS guard_pilot_job ON public.jobs;
CREATE TRIGGER guard_pilot_job BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_pilot_job();
CREATE INDEX IF NOT EXISTS bids_worker_created ON public.bids(worker_id,created_at);
CREATE INDEX IF NOT EXISTS jobs_client_created ON public.jobs(client_id,created_at);

NOTIFY pgrst,'reload schema';
COMMIT;
