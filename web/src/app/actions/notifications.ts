'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Notification } from '@/lib/supabase/types';

export type { Notification };

export async function fetchNotifications(
  userId: string,
): Promise<Notification[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, link, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markRead(id: string): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function markAllRead(userId: string): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}