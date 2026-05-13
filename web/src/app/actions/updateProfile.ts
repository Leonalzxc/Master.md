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

  // Always upsert profiles_worker so the record exists when user switches to worker
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
      // keep existing values if already set
      is_pro: false,
      verified: false,
      bid_credits: 5,
      rating_avg: 0,
      rating_count: 0,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false });
  if (workerError) throw new Error(workerError.message);

  revalidatePath(`/${data.locale}/account/profile`);
  revalidatePath(`/${data.locale}/account/client`);
  revalidatePath(`/${data.locale}/account/worker`);
  revalidatePath(`/${data.locale}/workers/${user.id}`);
}
