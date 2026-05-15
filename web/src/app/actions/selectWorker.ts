'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function selectWorker(jobId: string, bidId: string, workerId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current user owns this job
  const { data: rawJob } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = rawJob as any;
  if (!job || job.client_id !== user.id) throw new Error('Not authorized');
  if (job.status !== 'active') throw new Error('Invalid job status');

  const { data: rawBid } = await supabase
    .from('bids')
    .select('id, job_id, worker_id, status')
    .eq('id', bidId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bid = rawBid as any;
  if (!bid || bid.job_id !== jobId || bid.worker_id !== workerId || bid.status !== 'sent') {
    throw new Error('Invalid bid');
  }

  // Select this bid, reject all others for the same job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: selectError } = await (supabase.from('bids') as any)
    .update({ status: 'selected' })
    .eq('id', bidId)
    .eq('job_id', jobId)
    .eq('worker_id', workerId);
  if (selectError) throw new Error(selectError.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rejectError } = await (supabase.from('bids') as any)
    .update({ status: 'rejected' })
    .eq('job_id', jobId)
    .neq('id', bidId);
  if (rejectError) throw new Error(rejectError.message);
  // Update job status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: jobError } = await (supabase.from('jobs') as any).update({
    status: 'in_progress',
    selected_worker_id: workerId,
  }).eq('id', jobId);
  if (jobError) throw new Error(jobError.message);

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);

  // Notify selected worker via Telegram (fire-and-forget)
  try {
    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', workerId)
      .single();

    const worker = workerProfile as { telegram_chat_id: number | null; name: string | null } | null;
    if (worker?.telegram_chat_id) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';
      await sendTelegramMessage({
        chatId: worker.telegram_chat_id,
        text: `🎉 <b>Вас выбрали исполнителем!</b>\n\nЗаказчик выбрал вас для выполнения работы. Теперь вам доступны контакты заказчика.\n\n<a href="${siteUrl}/${locale}/jobs/${jobId}">Открыть заявку →</a>`,
      });
    }
  } catch {
    // Non-critical
  }
}
