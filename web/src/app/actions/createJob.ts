'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { escapeTelegramHtml } from '@/lib/telegram-security';
import { sendTelegramMessage } from '@/lib/telegram';
import { CATEGORY_LABELS_RU, type Category } from '@/lib/mock/data';

import { jobInputSchema, type JobInput, type JobResult } from '@/lib/jobs';

export async function createJob(input: JobInput): Promise<JobResult> {
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const formData = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const budgetNum = formData.budget ? Number(formData.budget) : null;

  // Jobs expire in 30 days by default; urgent jobs expire in 7 days
  const expiryDays = formData.urgent ? 7 : 30;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('jobs')
    .insert({
      client_id: user.id,
      category: formData.category,
      description: formData.description.trim(),
      city: formData.city,
      area: formData.area,
      lat: formData.lat,
      lng: formData.lng,
      budget_min: budgetNum,
      urgent: formData.urgent,
      needs_quote: formData.needsQuote,
      photos: formData.photos.length > 0 ? formData.photos : null,
      status: 'active',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message === 'job_daily_limit') return { ok: false, error: 'daily_limit' };
    if (error.message === 'pilot_location_required' || error.message === 'invalid_input') return { ok: false, error: 'invalid_input' };
    if (error.message === 'not_authorized') return { ok: false, error: 'not_authorized' };
    console.error('[createJob]', { code: error.code });
    return { ok: false, error: 'temporarily_unavailable' };
  }

  revalidatePath(`/${formData.locale}/jobs`);
  revalidatePath(`/${formData.locale}/account/client`);

  // Fire-and-forget: notify matching workers via Telegram
  notifyMatchingWorkers({
    jobId: data.id,
    category: formData.category,
    city: formData.city,
    description: formData.description,
    urgent: formData.urgent,
    locale: formData.locale,
  }).catch((e) => console.error('[createJob] notification error:', e));

  return { ok: true, jobId: data.id };
}

async function notifyMatchingWorkers({
  jobId, category, city, description, urgent, locale,
}: {
  jobId: string; category: string; city: string;
  description: string; urgent: boolean; locale: string;
}) {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master-md.vercel.app';

  // Find workers in the same city whose categories include this job's category
  // and who have connected Telegram (telegram_chat_id is set)
  const { data: rawMatchingWorkers } = await admin
    .from('profiles')
    .select('id, name, telegram_chat_id')
    .eq('city', city)
    .eq('role', 'worker')
    .is('blocked_at', null)
    .not('telegram_chat_id', 'is', null);

  const matchingWorkers = rawMatchingWorkers as { id: string; name: string | null; telegram_chat_id: number }[] | null;
  if (!matchingWorkers || matchingWorkers.length === 0) return;

  // Filter by category (profiles_worker.categories is array — need separate query)
  const workerIds = matchingWorkers.map((w: { id: string }) => w.id);
  const { data: rawWorkerMeta } = await admin
    .from('profiles_worker')
    .select('id, categories')
    .in('id', workerIds);

  const workerMeta = rawWorkerMeta as { id: string; categories: string[] }[] | null;
  const categorySet = new Set(
    (workerMeta ?? [])
      .filter((pw: { id: string; categories: string[] }) =>
        Array.isArray(pw.categories) && pw.categories.includes(category)
      )
      .map((pw: { id: string }) => pw.id)
  );

  const targets = matchingWorkers.filter(
    (w: { id: string }) => categorySet.has(w.id)
  ) as { id: string; name: string | null; telegram_chat_id: number }[];

  if (targets.length === 0) return;

  const catLabel = CATEGORY_LABELS_RU[category as Category] ?? category;
  const snippet = description.length > 120 ? description.slice(0, 120) + '…' : description;
  const jobUrl = `${siteUrl}/${locale}/jobs/${jobId}`;

  const text = [
    urgent ? '⚡ <b>Срочная заявка!</b>' : '📋 <b>Новая заявка</b>',
    `<b>${catLabel}</b> · ${city}`,
    '',
    escapeTelegramHtml(snippet),
    '',
    `👉 <a href="${jobUrl}">Откликнуться</a>`,
  ].join('\n');

  // Send in parallel, max 30 notifications per job (rate limit protection)
  await Promise.allSettled(
    targets.slice(0, 30).map((w) =>
      sendTelegramMessage({ chatId: w.telegram_chat_id, text })
    )
  );
}
