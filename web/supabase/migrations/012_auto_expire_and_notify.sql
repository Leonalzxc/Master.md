-- ============================================================
-- Auto-expire jobs + notify workers of new jobs in their categories
-- ============================================================

-- 1. Function: expire overdue active jobs
-- Call this periodically (e.g. via pg_cron or a cron Edge Function)
CREATE OR REPLACE FUNCTION public.expire_overdue_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.jobs
  SET status = 'cancelled'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. Function: notify workers when a new job is posted in their category+city
CREATE OR REPLACE FUNCTION public.notify_workers_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_job_title text;
BEGIN
  -- Only fire for new active jobs
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_job_title := left(NEW.description, 60);

  -- Find workers whose categories include this job's category
  -- and whose city matches (or worker has no city set)
  FOR r IN
    SELECT p.id, p.name
    FROM public.profiles p
    JOIN public.profiles_worker pw ON pw.id = p.id
    WHERE p.role = 'worker'
      AND pw.categories @> ARRAY[NEW.category]
      AND (p.city IS NULL OR p.city = '' OR p.city = NEW.city)
      AND p.id <> NEW.client_id  -- don't notify the client themselves
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      r.id,
      'new_bid',
      CASE
        WHEN NEW.urgent THEN '⚡ Срочная заявка в вашей категории!'
        ELSE '📋 Новая заявка в вашей категории'
      END,
      v_job_title || CASE WHEN length(NEW.description) > 60 THEN '…' ELSE '' END,
      jsonb_build_object('job_id', NEW.id::text, 'city', NEW.city, 'category', NEW.category)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then recreate
DROP TRIGGER IF EXISTS trg_notify_workers_new_job ON public.jobs;
CREATE TRIGGER trg_notify_workers_new_job
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_workers_new_job();

-- 3. Schedule auto-expire via pg_cron (if extension available)
-- Runs every hour — safe to apply even if pg_cron is not enabled yet
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'expire-overdue-jobs',
      '0 * * * *',
      'SELECT public.expire_overdue_jobs()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available, skip silently
  NULL;
END;
$do$;
