'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function selectWorker(jobId: string, bidId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // The RPC validates ownership/status and updates bids + job atomically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedWorkerId, error } = await (supabase as any).rpc('select_worker_for_job', {
    p_job_id: jobId,
    p_bid_id: bidId,
  });
  if (error) throw new Error(error.message);

  const notificationWorkerId = selectedWorkerId as string | null;
  if (!notificationWorkerId) throw new Error('worker_not_found');

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);

  // Notify selected worker via Telegram (fire-and-forget)
  try {
    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', notificationWorkerId)
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
