export const PROFILE_PUBLIC_SELECT =
  'id, role, name, city, created_at, blocked_at, block_reason';

export const PROFILE_PRIVATE_SELECT =
  'name, phone, telegram_chat_id';

export const WORKER_PUBLIC_SELECT =
  'id, categories, areas, experience_yrs, bio, photos, is_pro, pro_until, bid_credits, rating_avg, rating_count, verified, completed_at, verification_submitted_at';

export type ProfilePrivateFields = {
  name: string | null;
  phone: string;
  telegram_chat_id: number | null;
};

export type WorkerPrivateContacts = {
  viber: string | null;
  telegram: string | null;
  whatsapp: string | null;
};

type MaybeSingleBuilder<T> = {
  maybeSingle(): Promise<{ data: T | null }>;
};

type SelectableBuilder<T> = MaybeSingleBuilder<T> & {
  select(columns: string): MaybeSingleBuilder<T>;
};

type PrivateRpcClient = {
  rpc(name: 'profile_private_fields', args: { p_profile_id: string }): SelectableBuilder<ProfilePrivateFields>;
  rpc(name: 'worker_private_contacts', args: { p_worker_id: string }): MaybeSingleBuilder<WorkerPrivateContacts>;
};

export function privateRpc(client: unknown): PrivateRpcClient {
  return client as PrivateRpcClient;
}
