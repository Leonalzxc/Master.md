import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Telegram Bot Webhook
 *
 * Register with:
 *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *   { "url": "https://master-md.vercel.app/api/telegram/webhook" }
 *
 * Flow:
 *   1. User taps "Connect Telegram" in profile → deep link: t.me/BOT?start=USER_ID
 *   2. User presses "Start" → bot receives /start USER_ID
 *   3. This webhook stores profiles.telegram_chat_id = message.chat.id
 *
 * NOTE: Uses service-role client (bypasses RLS) because this is a
 * server-to-server webhook — no user session exists in this context.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function sendReply(chatId: number, text: string) {
  if (!BOT_TOKEN) {
    console.error('[TG webhook] TELEGRAM_BOT_TOKEN is not set');
    return;
  }
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('[TG webhook] sendReply failed:', e);
  }
}

export async function POST(req: NextRequest) {
  // Verify secret header (optional)
  if (WEBHOOK_SECRET) {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = (body.message ?? body.edited_message) as {
    chat: { id: number };
    text?: string;
  } | undefined;

  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text ?? '';

  // Wrap everything in try-catch so the webhook always returns 200
  // (Telegram retries on non-200 which causes spam)
  try {
    // Service-role client — bypasses RLS, safe for server-to-server webhook
    const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKeySet) {
      console.error('[TG webhook] SUPABASE_SERVICE_ROLE_KEY is not set!');
      await sendReply(chatId, '⚙️ Ошибка конфигурации сервера. Обратитесь к администратору.');
      return NextResponse.json({ ok: true });
    }

    const supabase = createServiceClient();

    // /start <userId>
    if (text.startsWith('/start')) {
      const userId = text.split(' ')[1]?.trim();

      if (!userId) {
        await sendReply(chatId,
          '👋 <b>Добро пожаловать в MASTER Moldova!</b>\n\nЧтобы подключить уведомления, нажмите кнопку "Подключить Telegram" в вашем профиле на сайте.'
        );
        return NextResponse.json({ ok: true });
      }

      // Check if this chat_id already linked to someone else
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

      if (existing && (existing as { id: string }).id !== userId) {
        await sendReply(chatId, '⚠️ Этот Telegram уже привязан к другому аккаунту. Отвяжите его в профиле.');
        return NextResponse.json({ ok: true });
      }

      // Update profile with telegram_chat_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error } = await (supabase.from('profiles') as any)
        .update({ telegram_chat_id: chatId })
        .eq('id', userId)
        .select('name')
        .single();

      if (error || !profile) {
        console.error('[TG webhook] update error:', JSON.stringify(error), 'userId:', userId);
        await sendReply(chatId, '❌ Не удалось привязать аккаунт. Попробуйте снова из профиля на сайте.');
        return NextResponse.json({ ok: true });
      }

      const name = (profile as { name?: string | null }).name ?? 'Пользователь';
      await sendReply(chatId,
        `✅ <b>Готово, ${name}!</b>\n\nВы будете получать уведомления:\n• 💬 Новые отклики на ваши заявки\n• ✅ Выбор вас исполнителем\n• 📋 Важные обновления по заявкам`
      );
      return NextResponse.json({ ok: true });
    }

    // /stop — unlink
    if (text.startsWith('/stop')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({ telegram_chat_id: null })
        .eq('telegram_chat_id', chatId);

      await sendReply(chatId, '👋 Уведомления отключены. Вы всегда можете снова подключить их в профиле.');
      return NextResponse.json({ ok: true });
    }

    // Default
    await sendReply(chatId,
      'ℹ️ Для управления уведомлениями перейдите в <b>профиль</b> на сайте MASTER Moldova.\n\nКоманды:\n/stop — отключить уведомления'
    );

  } catch (err) {
    console.error('[TG webhook] unhandled error:', err);
    await sendReply(chatId, '⚠️ Произошла ошибка. Попробуйте позже.').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
