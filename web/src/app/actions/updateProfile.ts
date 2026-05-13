'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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

  // Save base profile including new role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase.from('profiles') as any)
    .update({ name: data.name.trim(), city: data.city || 'Бельцы', role: data.role })
    .eq('id', user.id);
  if (profileError) throw new Error(profileError.message);

  // Always upsert profiles_worker so the record exists when user switches to worker.
  // IMPORTANT: do NOT include system-managed fields (is_pro, verified, bid_credits,
  // rating_avg, rating_count) — they are managed by DB triggers / admin, not here.
  const expNum = data.experience_yrs ? parseInt(data.experience_yrs, 10) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: workerError } = await (supabase.from('profiles_worker') as any)
    .upsert({
      id: user.id,
      bio: data.bio.trim() || null,
      categories: data.categories.length > 0 ? data.categories : [],
      areas: data.areas.length > 0 ? data.areas : [],
      experience_yrs: expNum,
      viber: data.viber.trim() || null,
      telegram: data.telegram.trim() || null,
      whatsapp: data.whatsapp.trim() || null,
      photos: data.portfolio_photos && data.portfolio_photos.length > 0 ? data.portfolio_photos : null,
    }, { onConflict: 'id', ignoreDuplicates: false });
  if (workerError) throw new Error(workerError.message);

  revalidatePath(`/${data.locale}/account/profile`);
  revalidatePath(`/${data.locale}/account/client`);
  revalidatePath(`/${data.locale}/account/worker`);
  revalidatePath(`/${data.locale}/workers/${user.id}`);
}
