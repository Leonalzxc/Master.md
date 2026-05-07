'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/lib/supabase/types';

export async function updateProfile(data: {
  name: string;
  city: string;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase.from('profiles') as any)
    .update({ name: data.name.trim(), city: data.city })
    .eq('id', user.id);
  if (profileError) throw new Error(profileError.message);

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (rawProfile as any)?.role;

  if (role === 'worker') {
    const expNum = data.experience_yrs ? parseInt(data.experience_yrs, 10) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: workerError } = await (supabase.from('profiles_worker') as any)
      .upsert({
        id: user.id,
        bio: data.bio.trim() || null,
        categories: data.categories,
        areas: data.areas,
        experience_yrs: expNum,
        viber: data.viber.trim() || null,
        telegram: data.telegram.trim() || null,
        whatsapp: data.whatsapp.trim() || null,
      }, { onConflict: 'id' });
    if (workerError) throw new Error(workerError.message);
  }

  revalidatePath(`/${data.locale}/account/profile`);
  revalidatePath(`/${data.locale}/account/worker`);
  revalidatePath(`/${data.locale}/workers/${user.id}`);
}
