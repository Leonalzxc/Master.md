'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/telegram';

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { data: rawProfile, error } = await supabase.from('profiles').select('role,blocked_at').eq('id', user.id).single();
  const profile = rawProfile as { role: string; blocked_at: string | null } | null;
  if (error || profile?.role !== 'admin' || profile.blocked_at) throw new Error('not_authorized');
  return user;
}

export async function blockUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const locale = formData.get('locale') as string;

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

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

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

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

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('jobs') as any)
    .update({ status: 'blocked' })
    .eq('id', jobId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/jobs`);
}

export async function approveVerification(formData: FormData) {
  const workerId = formData.get('workerId') as string;
  const locale = formData.get('locale') as string;

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles_worker') as any)
    .update({ verified: true })
    .eq('id', workerId);

  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/workers/${workerId}`);
  revalidatePath(`/${locale}/account/worker`);

  // Notify worker via Telegram (fire-and-forget)
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('telegram_chat_id, name')
      .eq('id', workerId)
      .single();
    const p = profileData as { telegram_chat_id: number | null; name: string | null } | null;
    if (p?.telegram_chat_id) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://master.md';
      await sendTelegramMessage({
        chatId: p.telegram_chat_id,
        text: `✅ <b>Верификация одобрена!</b>\n\nПоздравляем! Ваш профиль прошёл верификацию. Теперь на вашей странице отображается значок ✓ Проверен.\n\n<a href="${siteUrl}/${locale}/account/worker">Открыть профиль →</a>`,
      });
    }
  } catch {
    // Non-critical
  }
}

export async function rejectVerification(formData: FormData) {
  const workerId = formData.get('workerId') as string;
  const locale = formData.get('locale') as string;

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('profiles_worker') as any)
    .update({ verification_submitted_at: null })
    .eq('id', workerId);

  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
}

export async function addCredits(formData: FormData) {
  const userId = formData.get('userId') as string;
  const amount = Number(formData.get('amount') ?? 10);
  const locale = formData.get('locale') as string;

  const sessionClient = await createClient();
  await requireAdmin(sessionClient);
  const supabase = createAdminClient();

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

export async function expireJobs(formData: FormData): Promise<void> {
  const locale = formData.get('locale') === 'ro' ? 'ro' : 'ru';
  const session = await createClient();
  await requireAdmin(session);
  const admin = createAdminClient() as unknown as {
    rpc(name: 'expire_overdue_jobs'): Promise<{ error: { message: string } | null }>;
  };
  const { error } = await admin.rpc('expire_overdue_jobs');
  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/jobs`);
  revalidatePath(`/${locale}/account/client`);
}
