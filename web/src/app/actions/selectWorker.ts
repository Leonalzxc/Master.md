'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

type SelectWorkerRpc = (
  fn: 'select_worker_for_job',
  args: { p_job_id: string; p_bid_id: string },
) => Promise<{ data: string | null; error: { message: string } | null }>;

export async function selectWorker(jobId: string, bidId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const selectWorkerForJob = supabase.rpc as unknown as SelectWorkerRpc;
  const { data: selectedWorkerId, error } = await selectWorkerForJob('select_worker_for_job', {
    p_job_id: jobId,
    p_bid_id: bidId,
  });
  if (error) throw new Error(error.message);
  if (!selectedWorkerId) throw new Error('Invalid bid selection');

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);

  // Notify selected worker via Telegram (fire-and-forget)
  try {
    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', selectedWorkerId)
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
