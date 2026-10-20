'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CITIES, CATEGORY_LABELS_RU } from '@/lib/mock/data';

type PublishResult = { ok: true; jobId: string } | {
  ok: false; error: 'not_authenticated' | 'invalid_input' | 'temporarily_unavailable';
};

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
}): Promise<PublishResult> {
  if (!formData || !['ru', 'ro'].includes(formData.locale) ||
      typeof formData.description !== 'string' || formData.description.trim().length < 20 ||
      formData.description.length > 5000 || typeof formData.category !== 'string' || !Object.hasOwn(CATEGORY_LABELS_RU, formData.category) ||
      typeof formData.city !== 'string' || !CITIES.includes(formData.city) ||
      typeof formData.area !== 'string' || formData.area.length > 100 ||
      !Number.isFinite(formData.lat) || !Number.isFinite(formData.lng) ||
      typeof formData.urgent !== 'boolean' || typeof formData.needsQuote !== 'boolean' ||
      !Array.isArray(formData.photos) || formData.photos.length > 5 || formData.photos.some(photo => typeof photo !== 'string') ||
      typeof formData.budget !== 'string' ||
      (formData.budget.trim() !== '' && (!/^\d+(?:\.\d{1,2})?$/.test(formData.budget.trim()) || Number(formData.budget) > 1_000_000_000))) {
    return { ok: false, error: 'invalid_input' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const budgetNum = formData.budget.trim() ? Number(formData.budget) : null;

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

  if (error || !data?.id) {
    console.error('[createJob]', { code: error?.code ?? 'NO_ROW' });
    return { ok: false, error: 'temporarily_unavailable' };
  }

  revalidatePath(`/${formData.locale}/jobs`);
  revalidatePath(`/${formData.locale}/account/client`);
  return { ok: true, jobId: data.id };
}
