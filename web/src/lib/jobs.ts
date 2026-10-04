import { z } from 'zod';
import { isPilotLocation, PILOT_CITY } from './pilot';
export const jobInputSchema = z.object({
  requestId: z.uuid(),
  category: z.enum(['electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting']),
  description: z.string().trim().max(5000).refine(value => Array.from(value).length >= 20),
  city: z.literal(PILOT_CITY), area: z.string().trim().max(100),
  lat: z.number().finite(), lng: z.number().finite(),
  budget: z.string().trim().max(20).refine(value => value === '' || (/^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) <= 1_000_000_000)),
  urgent: z.boolean(), needsQuote: z.boolean(), photos: z.array(z.url()).max(5),
  locale: z.enum(['ru','ro']),
}).refine(value => isPilotLocation(value.lat,value.lng));
export type JobInput = z.input<typeof jobInputSchema>;
export type JobResult = { ok: true; jobId: string } | { ok: false; error: 'invalid_input' | 'not_authenticated' | 'not_authorized' | 'daily_limit' | 'publication_conflict' | 'temporarily_unavailable'; jobId?: string };
export function jobErrorText(error: Exclude<JobResult,{ok:true}>['error'], locale: string) {
  const text = {
    invalid_input: ['Проверьте описание, бюджет и точку в Бельцах.', 'Verificați descrierea, bugetul și punctul din Bălți.'],
    not_authenticated: ['Войдите, чтобы опубликовать заявку.', 'Autentificați-vă pentru a publica cererea.'],
    not_authorized: ['Заполните профиль или обратитесь в поддержку.', 'Completați profilul sau contactați asistența.'],
    daily_limit: ['До 5 новых заявок за 24 часа. Повторите позже.', 'Până la 5 cereri noi în 24 de ore. Reîncercați mai târziu.'],
    publication_conflict: ['Предыдущая отправка уже создала заявку с другими данными. Откройте её перед новой публикацией.', 'Trimiterea anterioară a creat deja o cerere cu alte date. Deschideți-o înainte de a publica alta.'],
    temporarily_unavailable: ['Не удалось опубликовать заявку. Повторите позже.', 'Cererea nu a putut fi publicată. Reîncercați mai târziu.'],
  };
  return text[error][locale === 'ro' ? 1 : 0];
}
