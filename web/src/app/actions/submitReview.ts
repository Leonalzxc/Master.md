'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function submitReview(
  jobId: string,
  rating: number,
  text: string,
  locale: string,
) {
  if (rating < 1 || rating > 5) throw new Error('Invalid rating');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  // Insert the review, mark the job done, and refresh worker rating atomically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: workerId, error } = await (supabase as any).rpc('complete_job_with_review', {
    p_job_id: jobId,
    p_rating: rating,
    p_text: text,
  });
  if (error) throw new Error(error.message);
  if (!workerId) throw new Error('worker_not_found');

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/workers/${workerId}`);

  redirect(`/${locale}/account/client?reviewed=1`);
}
