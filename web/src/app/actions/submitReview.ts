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

  // Prevent duplicate reviews
  const { data: existing } = await supabase
    .from('reviews').select('id').eq('job_id', jobId).single();
  if (existing) throw new Error('already_reviewed');

  // Insert review
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('reviews') as any).insert({
    job_id: jobId,
    author_id: user.id,
    worker_id: workerId,
    rating,
    text: text.trim() || null,
  });

  // Mark job as done
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('jobs') as any).update({ status: 'done' }).eq('id', jobId);

  // Recalculate worker rating
  const { data: allReviews } = await supabase
    .from('reviews').select('rating').eq('worker_id', workerId);
  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((s, r) => s + (r as { rating: number }).rating, 0) / allReviews.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles_worker') as any).update({
      rating_avg: Math.round(avg * 10) / 10,
      rating_count: allReviews.length,
    }).eq('id', workerId);
  }

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/workers/${workerId}`);

  redirect(`/${locale}/account/client?reviewed=1`);
}
