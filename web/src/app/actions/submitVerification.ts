'use server';

import { revalidatePath } from 'next/cache';
import { getMyWorkerProfile } from '@/lib/supabase/marketplace';
import { createClient } from '@/lib/supabase/server';

export async function submitVerification(formData: FormData) {
  const locale = (formData.get('locale') as string) || 'ru';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check they have a worker profile with at least one category
  const pw = await getMyWorkerProfile(supabase);

  if (!pw) throw new Error('Worker profile not found');
  if (pw.verified) throw new Error('Already verified');
  if (pw.verification_submitted_at) throw new Error('Verification already submitted');
  if (!pw.categories || (pw.categories as string[]).length === 0) {
    throw new Error('Please add at least one category to your profile first');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles_worker') as any)
    .update({ verification_submitted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/account/worker`);
  revalidatePath(`/${locale}/account/verify`);
}
