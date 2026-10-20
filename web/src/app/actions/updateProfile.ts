'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { PILOT_CITY } from '@/lib/pilot';
import type { Category } from '@/lib/supabase/types';

export async function updateProfile(data: {
  name: string;
  city: string;
  role: 'client' | 'worker';
  bio: string;
  categories: Category[];
  areas: string[];
  experience_yrs: string;
  viber: string;
  telegram: string;
  whatsapp: string;
  portfolio_photos?: string[];
  locale: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const parsed = z.object({
    name: z.string().trim().min(2).max(80), city: z.literal(PILOT_CITY), role: z.enum(['client','worker']),
    bio: z.string().trim().max(2000), categories: z.array(z.enum(['electric','plumbing','finishing','roofing','tiling','minorRepairs','furniture','painting'])).max(8),
    areas: z.array(z.string().max(100)).max(20), experience_yrs: z.string().refine(s => s === '' || (Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 80)),
    viber: z.string().trim().max(100), telegram: z.string().trim().max(100), whatsapp: z.string().trim().max(100),
    portfolio_photos: z.array(z.url()).max(10).optional(), locale: z.enum(['ru','ro']),
  }).safeParse(data);
  if (!parsed.success) throw new Error(data.locale === 'ro' ? 'Verificați datele profilului' : 'Проверьте данные профиля');
  const rpc = supabase as unknown as { rpc(name: string,args: Record<string,unknown>): PromiseLike<{error:{code:string}|null}> };
  const {error} = await rpc.rpc('save_my_profile',{p_data:{...parsed.data,photos:parsed.data.portfolio_photos ?? []}});
  if (error) {
    console.error('[save profile]',{code:error.code});
    throw new Error(data.locale === 'ro' ? 'Profilul nu a fost salvat. Reîncercați.' : 'Профиль не сохранён. Повторите попытку.');
  }

  revalidatePath(`/${data.locale}/account/profile`);
  revalidatePath(`/${data.locale}/account/client`);
  revalidatePath(`/${data.locale}/account/worker`);
  revalidatePath(`/${data.locale}/workers/${user.id}`);
}
