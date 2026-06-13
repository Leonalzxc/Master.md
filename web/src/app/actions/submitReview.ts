'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireActiveUser } from './authGuards';

export async function submitReview(
  jobId: string,
  rating: number,
  text: string,
  locale: string,
) {
  if (rating < 1 || rating > 5) throw new Error('Invalid rating');

  const supabase = await createClient();
  await requireActiveUser(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workerId, error } = await (supabase as any).rpc('submit_review_for_job', {
    p_job_id: jobId,
    p_rating: rating,
    p_text: text,
  });
  if (error) {
    if (error.code === '23505') throw new Error('already_reviewed');
    if (error.message.includes('invalid_job')) throw new Error('invalid_status');
    throw new Error(error.message);
  }

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/workers/${workerId as string}`);

  redirect(`/${locale}/account/client?reviewed=1`);
}
