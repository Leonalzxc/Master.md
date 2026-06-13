import type { User } from '@supabase/supabase-js';
import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileAuthFields = {
  role: string;
  blocked_at: string | null;
};

export async function requireActiveUser(supabase: SupabaseServerClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('not_authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, blocked_at')
    .eq('id', user.id)
    .single();

  if (error || !profile) throw new Error('profile_not_found');
  if ((profile as ProfileAuthFields).blocked_at) throw new Error('account_blocked');

  return user;
}

export async function requireAdmin(supabase: SupabaseServerClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('not_authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, blocked_at')
    .eq('id', user.id)
    .single();

  const authFields = profile as ProfileAuthFields | null;
  if (error || !authFields || authFields.role !== 'admin' || authFields.blocked_at) {
    throw new Error('not_authorized');
  }

  return user;
}
