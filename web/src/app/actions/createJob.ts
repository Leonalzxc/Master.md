'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

  // Jobs expire in 30 days by default; urgent jobs expire in 7 days
  const expiryDays = formData.urgent ? 7 : 30;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('jobs')
    .insert({
      client_id: user.id,
      title: formData.description.trim().slice(0, 80),
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

  if (error) throw new Error(error.message);

  revalidatePath(`/${formData.locale}/jobs`);
  revalidatePath(`/${formData.locale}/account/client`);
  redirect(`/${formData.locale}/jobs/${data.id}`);
}