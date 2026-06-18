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

  // Review insertion, job completion, and rating recalculation must commit
  // together; the RPC also enforces job ownership and selected worker.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('complete_job_with_review', {
    p_job_id: jobId,
    p_rating: rating,
    p_text: text,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/workers`);

  redirect(`/${locale}/account/client?reviewed=1`);
}
