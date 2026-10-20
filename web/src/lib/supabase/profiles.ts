import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Profile } from './types';

// Explicit allowlist: never replace this with '*' on public pages.
export const PUBLIC_PROFILE_COLUMNS = 'id,name,role,city,created_at,blocked_at';

export type PublicProfile = Pick<Profile, 'id' | 'name' | 'role' | 'city' | 'created_at' | 'blocked_at'>;
export type ClientContact = Pick<Profile, 'name' | 'phone'>;

// The existing hand-written Database types do not describe Relationships yet.
// Isolate the RPC typing adapter here rather than casting all public queries.
type ProfileRpcClient = {
  rpc(name: 'get_my_profile'): PromiseLike<{ data: Profile[] | null; error: { message: string } | null }>;
  rpc(name: 'get_job_client_contact', args: { p_job_id: string }): PromiseLike<{
    data: ClientContact[] | null; error: { message: string } | null;
  }>;
};

export async function getMyProfile(client: SupabaseClient<Database>): Promise<Profile | null> {
  const { data, error } = await (client as unknown as ProfileRpcClient).rpc('get_my_profile');
  // A database failure is not an absent profile: never overwrite it on error.
  if (error) throw new Error(`Profile read failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function getJobClientContact(client: SupabaseClient<Database>, jobId: string): Promise<ClientContact | null> {
  const { data, error } = await (client as unknown as ProfileRpcClient)
    .rpc('get_job_client_contact', { p_job_id: jobId });
  if (error) throw new Error(`Contact read failed: ${error.message}`);
  return data?.[0] ?? null;
}
