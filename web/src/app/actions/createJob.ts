'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';
import { CATEGORY_LABELS_RU, type Category } from '@/lib/mock/data';

export async function createJob(formData: {
  category: string;
  description: string;
  city: string;
  area: string;
  lat: number;
  lng: number;
  budget: string;
  urgent: boolean;
  needsQuote: boolean;
  photos: string[];
  locale: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/${formData.locale}/auth?next=/${formData.locale}/request/new`);

  const budgetNum = formData.budget ? parseFloat(formData.budget) : null;

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
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

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

  redirect(`/${formData.locale}/jobs/${data.id}`);
}

async function notifyMatchingWorkers({
  jobId, category, city, description, urgent, locale,
}: {
  jobId: string; category: string; city: string;
  description: string; urgent: boolean; locale: string;
}) {
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';

  // Find workers in the same city whose categories include this job's category
  // and who have connected Telegram (telegram_chat_id is set)
  const { data: matchingWorkers } = await (admin as any)
    .from('profiles')
    .select('id, name, telegram_chat_id')
    .eq('city', city)
    .eq('role', 'worker')
    .not('telegram_chat_id', 'is', null);

  if (!matchingWorkers || matchingWorkers.length === 0) return;

  // Filter by category (profiles_worker.categories is array — need separate query)
  const workerIds = matchingWorkers.map((w: { id: string }) => w.id);
  const { data: workerMeta } = await (admin as any)
    .from('profiles_worker')
    .select('id, categories')
    .in('id', workerIds);

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
    snippet,
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
