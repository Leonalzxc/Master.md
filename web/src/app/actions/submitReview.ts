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

  // Fetch job and verify ownership + status
  const { data: rawJob } = await supabase
    .from('jobs').select('*').eq('id', jobId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = rawJob as any;
  if (!job) throw new Error('job_not_found');
  if (job.client_id !== user.id) throw new Error('not_authorized');
  if (job.status !== 'in_progress') throw new Error('invalid_status');
  if (!job.selected_worker_id) throw new Error('no_worker_selected');

  const workerId: string = job.selected_worker_id;

  // Insert the review, mark the job done, and recalculate ratings atomically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: reviewError } = await (supabase as any).rpc('complete_job_with_review', {
    p_job_id: jobId,
    p_rating: rating,
    p_text: text.trim() || null,
  });
  if (reviewError) {
    if (reviewError.code === '23505' || reviewError.message === 'already_reviewed') {
      throw new Error('already_reviewed');
    }
    throw new Error(reviewError.message);
  }

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/workers/${workerId}`);

  redirect(`/${locale}/account/client?reviewed=1`);
}
