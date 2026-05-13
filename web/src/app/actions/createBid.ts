'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

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

  // Notify job owner via Telegram (fire-and-forget)
  try {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('client_id, description, category, city')
      .eq('id', input.jobId)
      .single();

    if (jobData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('telegram_chat_id, name')
        .eq('id', (jobData as any).client_id)
        .single();

      const owner = ownerData as { telegram_chat_id: number | null; name: string | null } | null;
      if (owner?.telegram_chat_id) {
        const { data: workerData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        const workerName = (workerData as { name: string | null } | null)?.name ?? 'Мастер';
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';

        await sendTelegramMessage({
          chatId: owner.telegram_chat_id,
          text: `💬 <b>Новый отклик на вашу заявку</b>\n\n👷 Мастер: <b>${workerName}</b>${input.price ? `\n💰 Цена: ${input.price} MDL` : ''}\n\n<a href="${siteUrl}/ru/jobs/${input.jobId}">Посмотреть отклики →</a>`,
        });
      }
    }
  } catch {
    // Notifications are non-critical — don't fail the bid creation
  }
}
