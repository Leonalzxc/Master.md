-- Add telegram_chat_id to profiles
-- Stores the Telegram chat ID after user connects via the bot
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT DEFAULT NULL;

-- Index for lookups when receiving bot messages
CREATE INDEX IF NOT EXISTS profiles_telegram_chat_id_idx ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- RLS: user can update their own telegram_chat_id
-- (already covered by existing profiles update policy)
