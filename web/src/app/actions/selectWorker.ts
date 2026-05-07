'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function selectWorker(jobId: string, bidId: string, workerId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current user owns this job
  const { data: rawJob } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = rawJob as any;
  if (!job || job.client_id !== user.id) throw new Error('Not authorized');

  // Select this bid, reject all others for the same job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('bids') as any).update({ status: 'selected' }).eq('id', bidId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('bids') as any).update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bidId);
  // Update job status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('jobs') as any).update({
    status: 'in_progress',
    selected_worker_id: workerId,
  }).eq('id', jobId);

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
}
