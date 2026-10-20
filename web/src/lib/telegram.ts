/**
 * Telegram Bot API helper.
 *
 * Setup:
 *  1. Create a bot via @BotFather → get TELEGRAM_BOT_TOKEN
 *  2. Set TELEGRAM_BOT_TOKEN in .env.local and Vercel env vars
 *  3. Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (without @) for the connect button deep link
 *  4. Set TELEGRAM_WEBHOOK_SECRET in server environment.
 *  5. Register setWebhook via POST with url and the same secret_token.
 *     Keep the bot token out of browser URLs, logs and chat.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface TgMessage {
  chatId: number | string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  disableWebPagePreview?: boolean;
}

/**
 * Send a message via Telegram Bot API.
 * Returns true on success, false on failure (never throws — safe to call fire-and-forget).
 */
export async function sendTelegramMessage({ chatId, text, parseMode = 'HTML', disableWebPagePreview = true }: TgMessage): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — skipping notification');
    return false;
  }

  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: disableWebPagePreview,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Telegram] sendMessage failed:', {code:err.error_code});
      return false;
    }

    return true;
  } catch {
    console.error('[Telegram] sendMessage unavailable');
    return false;
  }
}
