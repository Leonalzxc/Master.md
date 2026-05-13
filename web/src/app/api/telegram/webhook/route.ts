import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Telegram Bot Webhook
 *
 * Register with:
 *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *   { "url": "https://your-domain.com/api/telegram/webhook" }
 *
 * Flow:
 *   1. User taps "Connect Telegram" button in profile → deep link: t.me/BOT?start=USER_ID
 *   2. User presses "Start" → bot receives /start USER_ID
 *   3. This webhook stores profiles.telegram_chat_id = message.chat.id
 *   4. User sees confirmation message
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET; // optional extra security

async function sendReply(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  // Optional: verify secret header from Telegram
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
    from?: { first_name?: string };
  } | undefined;

  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text ?? '';

  // Handle /start <userId>
  if (text.startsWith('/start')) {
    const userId = text.split(' ')[1]?.trim();

    if (!userId) {
      await sendReply(chatId,
        '👋 <b>Добро пожаловать в MASTER Moldova!</b>\n\nЧтобы подключить уведомления, нажмите кнопку "Подключить Telegram" в вашем профиле на сайте.'
      );
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();

    // Check if this chat_id already linked to someone else
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    if (existing && (existing as { id: string }).id !== userId) {
      await sendReply(chatId, '⚠️ Этот Telegram уже привязан к другому аккаунту. Отвяжите его в профиле.');
      return NextResponse.json({ ok: true });
    }

    // Store telegram_chat_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase.from('profiles') as any)
      .update({ telegram_chat_id: chatId })
      .eq('id', userId)
      .select('name')
      .single();

    if (error || !profile) {
      await sendReply(chatId, '❌ Не удалось привязать аккаунт. Попробуйте снова из профиля на сайте.');
      return NextResponse.json({ ok: true });
    }

    const name = (profile as { name?: string | null }).name ?? 'Пользователь';
    await sendReply(chatId,
      `✅ <b>Готово, ${name}!</b>\n\nВы будете получать уведомления:\n• 💬 Новые отклики на ваши заявки\n• ✅ Выбор вас исполнителем\n• 📋 Важные обновления по заявкам`
    );

    return NextResponse.json({ ok: true });
  }

  // Handle /stop — unlink
  if (text.startsWith('/stop')) {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({ telegram_chat_id: null })
      .eq('telegram_chat_id', chatId);

    await sendReply(chatId, '👋 Уведомления отключены. Вы всегда можете снова подключить их в профиле.');
    return NextResponse.json({ ok: true });
  }

  // Default reply
  await sendReply(chatId,
    'ℹ️ Для управления уведомлениями перейдите в <b>профиль</b> на сайте MASTER Moldova.\n\nКоманды:\n/stop — отключить уведомления'
  );

  return NextResponse.json({ ok: true });
}
