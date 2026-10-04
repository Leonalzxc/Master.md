'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

import { z } from 'zod';
import { runWorkflow } from '@/lib/supabase/workflow';
import type { WorkflowResult } from '@/lib/workflow';

export async function selectWorker(jobId:string,bidId:string,_workerId:string,locale:string):Promise<WorkflowResult<{worker_id:string;changed:boolean}[]>> {
  const valid=z.object({jobId:z.string().uuid(),bidId:z.string().uuid(),locale:z.enum(['ru','ro'])}).safeParse({jobId,bidId,locale});
  if (!valid.success) return {ok:false,error:'invalid_input'};
  const result=await runWorkflow<{worker_id:string;changed:boolean}[]>('select_job_worker',{p_job_id:jobId,p_bid_id:bidId});
  if (!result.ok) return result;
  const selected=result.data[0];
  if (!selected) return {ok:false,error:'temporarily_unavailable'};
  const workerId=selected.worker_id;
  revalidatePath(`/${locale}/jobs/${jobId}`);
  revalidatePath(`/${locale}/account/client`);
  revalidatePath(`/${locale}/account/worker`);
  if (!selected.changed) return result;

  // Notify selected worker via Telegram (fire-and-forget)
  try {
    const { data: workerProfile } = await createAdminClient()
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', workerId)
      .single();

    const worker = workerProfile as { telegram_chat_id: number | null; name: string | null } | null;
    if (worker?.telegram_chat_id) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master-md.vercel.app';
      await sendTelegramMessage({
        chatId: worker.telegram_chat_id,
        text: `🎉 <b>Вас выбрали исполнителем!</b>\n\nЗаказчик выбрал вас для выполнения работы. Теперь вам доступны контакты заказчика.\n\n<a href="${siteUrl}/${locale}/jobs/${jobId}">Открыть заявку →</a>`,
      });
    }
  } catch {
    // Non-critical
  }
  return result;
}
