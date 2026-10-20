import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './types';
import { getMyProfile } from './profiles';

export async function ensureMyProfile(client: SupabaseClient<Database>, user: User) {
  const existing = await getMyProfile(client);
  if (existing) return existing;
  if (!user.phone) throw new Error('A verified phone is required');

  // INSERT only. A concurrent request must never overwrite an existing role.
  const { error } = await client.from('profiles').insert({
    id: user.id, phone: user.phone, role: 'client',
  } as never);
  if (error && error.code !== '23505') throw new Error('Could not create profile');

  const created = await getMyProfile(client);
  if (!created) throw new Error('Profile is unavailable. Please retry.');
  return created;
}
