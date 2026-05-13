'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createBid(input: {
  jobId: string;
  price: number;
  comment: string;
  startDate: string;
  locale: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  // Must have role = 'worker'
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((rawProfile as any)?.role !== 'worker') throw new Error('not_worker');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('bids') as any).insert({
    job_id: input.jobId,
    worker_id: user.id,
    price: input.price,
    comment: input.comment.trim(),
    start_date: input.startDate || null,
    status: 'sent',
  });

  if (error) {
    if (error.code === '23505') throw new Error('already_bid');
    throw new Error(error.message);
  }

  revalidatePath(`/${input.locale}/jobs/${input.jobId}`);
}
