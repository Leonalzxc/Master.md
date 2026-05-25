'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function selectWorker(jobId: string, bidId: string, workerId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current user owns this job
  const { data: rawJob } = await supabase
    .from('jobs')
    .select('client_id, status')
    .eq('id', jobId)
    .single();
  const job = rawJob as { client_id: string; status: string } | null;
  if (!job || job.client_id !== user.id) throw new Error('Not authorized');
  if (job.status !== 'active') throw new Error('cannot_select_worker');

  const { data: rawBid } = await supabase
    .from('bids')
    .select('job_id, worker_id, status')
    .eq('id', bidId)
    .single();
  const bid = rawBid as { job_id: string; worker_id: string; status: string } | null;
  if (!bid || bid.job_id !== jobId || bid.worker_id !== workerId || bid.status !== 'sent') {
    throw new Error('invalid_bid');
  }

  // Claim the active job first so concurrent selections cannot select multiple workers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e1 } = await (supabase.from('jobs') as any).update({
    status: 'in_progress',
    selected_worker_id: workerId,
  }).eq('id', jobId).eq('client_id', user.id).eq('status', 'active').select('id').single();
  if (e1) throw new Error(e1.message);

  // Select this bid, reject all other pending bids for the same job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e2 } = await (supabase.from('bids') as any).update({ status: 'selected' })
    .eq('id', bidId)
    .eq('job_id', jobId)
    .eq('worker_id', workerId)
    .eq('status', 'sent')
    .select('id')
    .single();
  if (e2) throw new Error(e2.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e3 } = await (supabase.from('bids') as any).update({ status: 'rejected' })
    .eq('job_id', jobId)
    .neq('id', bidId)
    .eq('status', 'sent');
  if (e3) throw new Error(e3.message);

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
