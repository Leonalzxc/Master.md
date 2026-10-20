-- Existing production has the 012 new-job trigger and expiry helper.
-- Preserve the trigger, but restrict recipients to eligible pilot workers.
BEGIN;
CREATE OR REPLACE FUNCTION public.notify_workers_new_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $notify$
BEGIN
  IF NEW.status <> 'active' OR NEW.city IS DISTINCT FROM 'Бельцы' THEN RETURN NEW; END IF;
  INSERT INTO public.notifications(user_id,type,title,body,payload)
  SELECT p.id,'new_bid',
    CASE WHEN NEW.urgent THEN '⚡ Срочная заявка в вашей категории!' ELSE '📋 Новая заявка в вашей категории' END,
    left(NEW.description,60) || CASE WHEN length(NEW.description)>60 THEN '…' ELSE '' END,
    jsonb_build_object('job_id',NEW.id::text,'city',NEW.city,'category',NEW.category)
  FROM public.profiles p JOIN public.profiles_worker pw ON pw.id=p.id
  WHERE p.role='worker' AND p.blocked_at IS NULL AND p.city=NEW.city
    AND p.id<>NEW.client_id AND pw.categories @> ARRAY[NEW.category];
  RETURN NEW;
END;
$notify$;
REVOKE ALL ON FUNCTION public.notify_workers_new_job() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_notify_workers_new_job ON public.jobs;
CREATE TRIGGER trg_notify_workers_new_job AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_workers_new_job();

-- Do not expose the SECURITY DEFINER expiry helper to browser callers.
-- Serialize against select/cancel/bid and reject pending bids when closing a job.
CREATE OR REPLACE FUNCTION public.expire_overdue_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $expire$
DECLARE target record; expired integer:=0;
BEGIN
  FOR target IN SELECT id FROM public.jobs
    WHERE status='active' AND expires_at<=now() ORDER BY id FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.bids SET status='rejected' WHERE job_id=target.id AND status='sent';
    UPDATE public.jobs SET status='cancelled' WHERE id=target.id;
    expired:=expired+1;
  END LOOP;
  RETURN expired;
END;
$expire$;
REVOKE ALL ON FUNCTION public.expire_overdue_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_jobs() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
