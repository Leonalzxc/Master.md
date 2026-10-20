BEGIN;
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS telegram_link_user_created ON public.telegram_link_tokens(user_id,created_at);
CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_link_tokens,public.telegram_processed_updates FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.issue_telegram_link(p_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE actor_id uuid:=auth.uid();
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM id FROM public.profiles WHERE id=actor_id AND blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF (SELECT count(*) FROM public.telegram_link_tokens WHERE user_id=actor_id AND created_at>now()-interval '10 minutes')>=3 THEN
    RAISE EXCEPTION 'link_rate_limit';
  END IF;
  UPDATE public.telegram_link_tokens SET used_at=now() WHERE user_id=actor_id AND used_at IS NULL;
  INSERT INTO public.telegram_link_tokens(token_hash,user_id) VALUES(p_token_hash,actor_id);
  RETURN true;
END;
$issue$;

-- Only a webhook authenticated by Telegram's secret may call this service RPC.
CREATE OR REPLACE FUNCTION public.consume_telegram_update(p_token_hash text,p_chat_id bigint,p_update_id bigint,p_stop boolean DEFAULT false)
RETURNS TABLE(result text,name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $consume$
DECLARE link public.telegram_link_tokens%ROWTYPE;actor_name text;
BEGIN
  IF p_chat_id IS NULL OR p_chat_id<=0 OR p_update_id IS NULL OR p_update_id<0 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  -- Deduplicate all commands, including /stop, before changing any binding.
  INSERT INTO public.telegram_processed_updates(update_id) VALUES(p_update_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN QUERY SELECT 'duplicate'::text,NULL::text; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(p_chat_id);
  IF p_stop THEN
    -- Delayed older /stop events must not undo a newer link event.
    IF EXISTS (SELECT 1 FROM public.telegram_chat_updates WHERE chat_id=p_chat_id AND update_id>p_update_id) THEN
      RETURN QUERY SELECT 'duplicate'::text,NULL::text; RETURN;
    END IF;
    UPDATE public.profiles SET telegram_chat_id=NULL WHERE telegram_chat_id=p_chat_id;
    INSERT INTO public.telegram_chat_updates(chat_id,update_id) VALUES(p_chat_id,p_update_id)
      ON CONFLICT(chat_id) DO UPDATE SET update_id=excluded.update_id;
    RETURN QUERY SELECT 'stopped'::text,NULL::text; RETURN;
  END IF;
  SELECT * INTO link FROM public.telegram_link_tokens WHERE token_hash=p_token_hash;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN; END IF;
  -- Same lock order as issue_telegram_link: profile, then token.
  PERFORM id FROM public.profiles WHERE id=link.user_id FOR UPDATE;
  SELECT * INTO link FROM public.telegram_link_tokens WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR link.used_at IS NOT NULL OR link.expires_at<=now() THEN RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN; END IF;
  SELECT p.name INTO actor_name FROM public.profiles p WHERE p.id=link.user_id AND p.blocked_at IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.profiles WHERE telegram_chat_id=p_chat_id AND id<>link.user_id) THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.telegram_chat_updates WHERE chat_id=p_chat_id AND update_id>p_update_id) THEN
    RETURN QUERY SELECT 'invalid'::text,NULL::text; RETURN;
  END IF;
  UPDATE public.profiles SET telegram_chat_id=p_chat_id WHERE id=link.user_id;
  UPDATE public.telegram_link_tokens SET used_at=now() WHERE token_hash=p_token_hash;
  INSERT INTO public.telegram_chat_updates(chat_id,update_id) VALUES(p_chat_id,p_update_id)
    ON CONFLICT(chat_id) DO UPDATE SET update_id=excluded.update_id;
  RETURN QUERY SELECT 'linked'::text,actor_name;
END;
$consume$;
CREATE TABLE IF NOT EXISTS public.telegram_chat_updates(chat_id bigint PRIMARY KEY,update_id bigint NOT NULL);
ALTER TABLE public.telegram_chat_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_chat_updates FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.issue_telegram_link(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_telegram_link(text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_telegram_update(text,bigint,bigint,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_update(text,bigint,bigint,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
