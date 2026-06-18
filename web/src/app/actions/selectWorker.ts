'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function selectWorker(jobId: string, bidId: string, _workerId: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify the current user owns this job
  const { data: rawJob } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = rawJob as any;
  if (!job || job.client_id !== user.id) throw new Error('Not authorized');

  // Select the bid atomically in the database so the stored worker always
  // comes from the bid row, not from client-supplied form data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedWorkerId, error } = await (supabase as any).rpc('select_worker_for_job', {
    p_job_id: jobId,
    p_bid_id: bidId,
  });
  if (error) throw new Error(error.message);
  const workerToNotify = selectedWorkerId as string | null;

  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);

  // Notify selected worker via Telegram (fire-and-forget)
  try {
    if (!workerToNotify) return;

    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', workerToNotify)
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
