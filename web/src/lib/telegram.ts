/**
 * Telegram Bot API helper.
 *
 * Setup:
 *  1. Create a bot via @BotFather → get TELEGRAM_BOT_TOKEN
 *  2. Set TELEGRAM_BOT_TOKEN in .env.local and Vercel env vars
 *  3. Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (without @) for the connect button deep link
 *  4. Register webhook:
 *     https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook
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
      console.error('[Telegram] sendMessage failed:', err);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Telegram] sendMessage error:', e);
    return false;
  }
}

/**
 * Build the deep link for "Connect Telegram" button.
 * When user taps it, the bot receives `/start {userId}` and we store their chat_id.
 */
export function telegramConnectUrl(userId: string): string {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) return '';
  return `https://t.me/${botUsername}?start=${userId}`;
}
