'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createJob(formData: {
  category: string;
  description: string;
  city: string;
  area: string;
  budget: string;
  urgent: boolean;
  needsQuote: boolean;
  locale: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${formData.locale}/auth?next=/${formData.locale}/request/new`);

  const budgetNum = formData.budget ? parseFloat(formData.budget) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('jobs') as any).insert({
    client_id: user.id,
    category: formData.category,
    description: formData.description.trim(),
    city: formData.city,
    area: formData.area,
    budget_min: budgetNum,
    urgent: formData.urgent,
    needs_quote: formData.needsQuote,
    status: 'active',
  }).select('id').single();

  if (error) throw new Error(error.message);

  revalidatePath(`/${formData.locale}/jobs`);
  revalidatePath(`/${formData.locale}/account/client`);
  redirect(`/${formData.locale}/jobs/${data.id}`);
}
