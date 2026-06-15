'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './authGuards';

export async function blockUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('set_user_blocked', {
    p_user_id: userId,
    p_blocked: true,
    p_reason: 'Заблокирован администратором',
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}

export async function unblockUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('set_user_blocked', {
    p_user_id: userId,
    p_blocked: false,
    p_reason: null,
  });

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

export async function addCredits(formData: FormData) {
  const userId = formData.get('userId') as string;
  const amount = Number(formData.get('amount') ?? 10);
  const locale = formData.get('locale') as string;

  const supabase = await createClient();
  await requireAdmin(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('admin_add_bid_credits', {
    p_worker_id: userId,
    p_amount: amount,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}
