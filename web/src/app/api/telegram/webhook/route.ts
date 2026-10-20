import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';
import { escapeTelegramHtml, parseTelegramCommand, telegramTokenHash, validWebhookSecret } from '@/lib/telegram-security';
export const runtime='nodejs';
export async function POST(req: NextRequest) {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ok:false},{status:503});
  if (!validWebhookSecret(req.headers.get('x-telegram-bot-api-secret-token'),secret)) return NextResponse.json({ok:false},{status:401});
  let input: unknown;
  try { input=await req.json(); } catch { return NextResponse.json({ok:false},{status:400}); }
  const command=parseTelegramCommand(input);
  // UUID links, edited messages and group commands cannot mutate an account.
  if (!command) return NextResponse.json({ok:true});
  try {
    const admin=createAdminClient() as unknown as {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:{result:string;name:string|null}[]|null;error:{code:string}|null}>};
    const {data,error}=await admin.rpc('consume_telegram_update',{
      p_token_hash:command.token ? telegramTokenHash(command.token) : null,
      p_chat_id:command.chatId,p_update_id:command.updateId,p_stop:command.stop,
    });
    if(error) {console.error('[telegram update]',{code:error.code});return NextResponse.json({ok:false},{status:503});}
    const result=data?.[0];
    if(!result) return NextResponse.json({ok:false},{status:503});
    if(result.result==='duplicate') return NextResponse.json({ok:true});
    const reply=result.result==='linked' ? `✅ Готово, ${escapeTelegramHtml(result.name ?? 'пользователь')}! Уведомления подключены. Notificările sunt conectate.`
      : result.result==='stopped' ? 'Уведомления отключены. Notificările sunt dezactivate.'
      : 'Ссылка недействительна. Создайте новую в профиле сайта. Link invalid. Creați unul nou în profil.';
    await sendTelegramMessage({chatId:command.chatId,text:reply});
    return NextResponse.json({ok:true});
  } catch {console.error('[telegram update] unavailable');return NextResponse.json({ok:false},{status:503});}
}
