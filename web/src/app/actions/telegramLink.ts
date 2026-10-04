'use server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { telegramTokenHash } from '@/lib/telegram-security';
export async function createTelegramLink(): Promise<{ok:true;url:string}|{ok:false}> {
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if (!user) return {ok:false};
  const token=randomBytes(32).toString('hex');
  const rpc=client as unknown as {rpc(name:string,args:Record<string,string>):PromiseLike<{error:unknown}>};
  const {error}=await rpc.rpc('issue_telegram_link',{p_token_hash:telegramTokenHash(token)});
  if (error) return {ok:false};
  const username=process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Master_MDbot';
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) return {ok:false};
  return {ok:true,url:`https://t.me/${username}?start=${token}`};
}
