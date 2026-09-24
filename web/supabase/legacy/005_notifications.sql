-- ============================================================
-- 005_notifications.sql
-- Notifications: table, RLS, realtime, triggers
-- ============================================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'general',
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL DEFAULT '',
  link       TEXT,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications(user_id, read)
  WHERE read = FALSE;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anyone_insert_notifications"    ON public.notifications;

CREATE POLICY "users_select_own_notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger functions run as SECURITY DEFINER → bypass RLS on INSERT
CREATE POLICY "anyone_insert_notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- ── Realtime ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname    = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END$$;

-- ── Helper function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_link    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);
END;
$$;

-- ── Trigger 1: new bid → notify job owner (client) ───────────
-- Uses table: public.job_requests (user_id = client), public.bids (worker_id)
CREATE OR REPLACE FUNCTION public.notify_client_on_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- job_requests.user_id is the client who posted the request
  SELECT user_id
    INTO v_client_id
    FROM public.job_requests
   WHERE id = NEW.job_request_id;

  IF v_client_id IS NOT NULL AND v_client_id <> NEW.worker_id THEN
    PERFORM public.create_notification(
      v_client_id,
      'new_bid',
      'Новый отклик на вашу заявку',
      'Мастер оставил отклик. Посмотрите предложение.',
      '/ru/dashboard/requests/' || NEW.job_request_id::TEXT
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

-- ── Trigger 2: bid selected → notify master (worker) ─────────
CREATE OR REPLACE FUNCTION public.notify_master_on_bid_selected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'selected' AND (OLD.status IS DISTINCT FROM 'selected') THEN
    PERFORM public.create_notification(
      NEW.worker_id,
      'bid_selected',
      'Ваш отклик принят!',
      'Заказчик выбрал вас исполнителем. Контакты открыты.',
      '/ru/dashboard/jobs/' || NEW.job_request_id::TEXT
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