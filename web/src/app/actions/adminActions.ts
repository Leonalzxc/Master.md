'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((rawProfile as any)?.role !== 'admin') throw new Error('not_authorized');
  return user;
}

export async function blockUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles') as any)
    .update({ blocked_at: new Date().toISOString(), block_reason: 'Заблокирован администратором' })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}

export async function unblockUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles') as any)
    .update({ blocked_at: null, block_reason: null })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}

export async function blockJob(formData: FormData) {
  const jobId = formData.get('jobId') as string;
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('jobs') as any)
    .update({ status: 'blocked' })
    .eq('id', jobId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/jobs`);
}

export async function expireJobs(formData: FormData) {
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('expire_overdue_jobs');
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/jobs`);
  return { expired: data as number };
}

export async function addCredits(formData: FormData) {
  const userId = formData.get('userId') as string;
  const amount = Number(formData.get('amount') ?? 10);
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pw } = await (supabase.from('profiles_worker') as any)
    .select('bid_credits')
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = (pw as any)?.bid_credits ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles_worker') as any)
    .update({ bid_credits: current + amount })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}
