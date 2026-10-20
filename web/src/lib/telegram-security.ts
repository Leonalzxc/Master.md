import { createHash, timingSafeEqual } from 'node:crypto';
export const telegramTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const escapeTelegramHtml = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function validWebhookSecret(actual: string | null, expected: string | undefined): boolean {
  if (!expected || !actual) return false;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
export type TelegramCommand = { chatId:number; updateId:number; token?:string; stop:boolean };
export function parseTelegramCommand(input: unknown): TelegramCommand | null {
  if (!input || typeof input !== 'object') return null;
  const body=input as {update_id?:unknown;message?:{chat?:{id?:unknown;type?:unknown};from?:{id?:unknown};text?:unknown}};
  const message=body.message;
  if (!Number.isSafeInteger(body.update_id) || (body.update_id as number)<0 || !message || message.chat?.type!=='private' ||
    !Number.isSafeInteger(message.chat.id) || (message.chat.id as number)<=0 || message.from?.id!==message.chat.id || typeof message.text!=='string') return null;
  if (message.text==='/stop') return {chatId:message.chat.id as number,updateId:body.update_id as number,stop:true};
  const match=/^\/start ([a-f0-9]{64})$/.exec(message.text);
  if (!match) return null;
  return {chatId:message.chat.id as number,updateId:body.update_id as number,token:match[1],stop:false};
}
