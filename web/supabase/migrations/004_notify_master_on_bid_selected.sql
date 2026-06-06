-- ─────────────────────────────────────────────────────────────
-- Migration 004: notifications table + triggers
-- ─────────────────────────────────────────────────────────────

-- 1. Create notifications table (idempotent)
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'general',
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  link       text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

-- 2. Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service-role (server actions) can insert notifications for any user
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 3. Enable Realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ─────────────────────────────────────────────────────────────
-- 4. Trigger: notify master when their bid is selected
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_master_on_bid_selected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id   uuid;
  v_worker_id uuid;
BEGIN
  -- We only care about status changing TO 'selected'
  IF NEW.status = 'selected' AND (OLD.status IS DISTINCT FROM 'selected') THEN
    v_job_id    := NEW.job_request_id;
    v_worker_id := NEW.worker_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_worker_id,
      'bid_selected',
      'Ваш отклик принят!',
      'Заказчик выбрал вас исполнителем. Контакты открыты.',
      '/ru/dashboard/jobs/' || v_job_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_master_bid_selected ON public.bids;
CREATE TRIGGER trg_notify_master_bid_selected
  AFTER UPDATE OF status ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_master_on_bid_selected();

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger: notify client when a new bid arrives on their job
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_client_on_new_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Get the owner of the job request
  SELECT user_id INTO v_client_id
  FROM public.job_requests
  WHERE id = NEW.job_request_id;

  IF v_client_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_client_id,
      'new_bid',
      'Новый отклик на вашу заявку',
      'Мастер оставил отклик. Посмотрите предложение.',
      '/ru/dashboard/requests/' || NEW.job_request_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_new_bid ON public.bids;
CREATE TRIGGER trg_notify_client_new_bid
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_new_bid();