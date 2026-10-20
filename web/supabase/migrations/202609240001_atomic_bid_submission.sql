-- Apply after 003, 006, 008, 011, 013 and 202609230001.
-- Coordinate with the frontend release: older code cannot insert bids directly.
BEGIN;

-- No browser may spend someone else's credit or insert an uncharged bid.
REVOKE EXECUTE ON FUNCTION public.spend_bid_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.bids FROM PUBLIC, anon, authenticated;

-- A worker may edit their profile, but not mint credits, set verification/rating,
-- or delete/recreate the worker row to obtain another starting balance.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles_worker FROM PUBLIC, anon, authenticated;
DO $grants$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
    WHERE attrelid = 'public.bids'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%s) ON public.bids FROM PUBLIC, anon, authenticated', cols);
  SELECT string_agg(quote_ident(attname), ', ') INTO cols FROM pg_attribute
    WHERE attrelid = 'public.profiles_worker'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.profiles_worker FROM PUBLIC, anon, authenticated', cols);
END;
$grants$;
GRANT INSERT (id, categories, areas, experience_yrs, bio, photos, viber, telegram, whatsapp, verification_submitted_at),
      UPDATE (id, categories, areas, experience_yrs, bio, photos, viber, telegram, whatsapp, verification_submitted_at)
  ON public.profiles_worker TO authenticated;

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

  -- Serializes the last credit across different jobs for the same worker.
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
  IF balance < 1 THEN RAISE EXCEPTION 'no_credits'; END IF;

  INSERT INTO public.bids (job_id, worker_id, price, comment, start_date, status)
    VALUES (p_job_id, actor_id, p_price, btrim(p_comment), p_start_date, 'sent') RETURNING id INTO new_id;
  UPDATE public.profiles_worker SET bid_credits = bid_credits - 1 WHERE id = actor_id
    RETURNING bid_credits INTO balance;
  -- A trigger/constraint failure rolls back BOTH the bid and balance change.
  RETURN QUERY SELECT new_id, true, balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_bid(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_bid(uuid, numeric, text, date) TO authenticated;

-- Admin top-ups must use an increment too: read-then-write can erase a debit
-- committed between those two requests. Authentication is in the admin action.
CREATE OR REPLACE FUNCTION public.grant_bid_credits(p_worker_id uuid, p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $grant$
DECLARE balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  UPDATE public.profiles_worker SET bid_credits = bid_credits + p_amount
    WHERE id = p_worker_id RETURNING bid_credits INTO balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'worker_not_found'; END IF;
  RETURN balance;
END;
$grant$;
REVOKE ALL ON FUNCTION public.grant_bid_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_bid_credits(uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
