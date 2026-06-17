'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from './authGuards';

export async function cancelJob(jobId: string, locale: string) {
  const supabase = await createClient();
  const user = await requireActiveUser(supabase);

  // Verify ownership and status
  const { data: rawJob } = await supabase.from('jobs').select('client_id, status').eq('id', jobId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = rawJob as any;
  if (!job || job.client_id !== user.id) throw new Error('not_authorized');
  if (job.status !== 'active') throw new Error('cannot_cancel');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('jobs') as any)
    .update({ status: 'cancelled' })
    .eq('id', jobId)
    .eq('client_id', user.id); // TOCTOU guard: double-check ownership in UPDATE

  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/jobs`);
}
