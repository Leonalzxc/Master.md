'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { escapeTelegramHtml } from '@/lib/telegram-security';
import { sendTelegramMessage } from '@/lib/telegram';

import { bidInputSchema, bidErrors, type BidError, type BidInput, type BidResult, type SubmitBidRow } from '@/lib/bids';

// Expected domain errors are returned, not thrown: production Server Actions
// intentionally hide thrown error messages from the browser.
export async function createBid(input: BidInput): Promise<BidResult> {
  const parsed = bidInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  input = parsed.data;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: 'not_authenticated' };

  const rpcClient = supabase as unknown as {
    rpc(name: 'submit_bid', args: {
      p_job_id: string; p_price: number; p_comment: string; p_start_date: string | null;
    }): PromiseLike<{ data: SubmitBidRow[] | null; error: { message: string; code: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc('submit_bid', {
    p_job_id: input.jobId, p_price: input.price,
    p_comment: input.comment, p_start_date: input.startDate || null,
  });
  if (error) {
    if (error.code === 'P0001' && bidErrors.includes(error.message as BidError)) {
      return { ok: false, error: error.message as BidError };
    }
    console.error('[createBid] submit_bid failed', { code: error.code });
    return { ok: false, error: 'temporarily_unavailable' };
  }
  const submitted = data?.[0];
  if (!submitted) return { ok: false, error: 'temporarily_unavailable' };
  const result: BidResult = {
    ok: true, bidId: submitted.bid_id, created: submitted.created,
    creditsRemaining: submitted.credits_remaining,
  };
  revalidatePath(`/${input.locale}/jobs/${input.jobId}`);

  revalidatePath(`/${input.locale}/account/worker`);
  revalidatePath(`/${input.locale}/credits`);
  if (!submitted.created) return result;

  // Notify only on a new bid. Database notifications are in the transaction.
  try {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('client_id, description, category, city')
      .eq('id', input.jobId)
      .single();

    if (jobData) {
      const { data: ownerData } = await createAdminClient()
        .from('profiles')
        .select('telegram_chat_id, name')
        .eq('id', (jobData as { client_id: string }).client_id)
        .single();

      const owner = ownerData as { telegram_chat_id: number | null; name: string | null } | null;
      if (owner?.telegram_chat_id) {
        const { data: workerData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        const workerName = (workerData as { name: string | null } | null)?.name ?? 'Мастер';
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master-md.vercel.app';

        await sendTelegramMessage({
          chatId: owner.telegram_chat_id,
          text: `💬 <b>Новый отклик на вашу заявку</b>\n\n👷 Мастер: <b>${escapeTelegramHtml(workerName)}</b>${input.price ? `\n💰 Цена: ${input.price} MDL` : ''}\n\n<a href="${siteUrl}/${input.locale}/jobs/${input.jobId}">Посмотреть отклики →</a>`,
        });
      }
    }
  } catch {
    // Notifications are non-critical — don't fail the bid creation
  }
  return result;
}
