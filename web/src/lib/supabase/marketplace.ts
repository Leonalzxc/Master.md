import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ProfileWorker } from './types';
// Safe for guest reads and joins. Never replace these with '*'.
export const PUBLIC_JOB_COLUMNS = 'id,client_id,description,category,city,area,budget_min,budget_max,urgent,needs_quote,photos,status,selected_worker_id,created_at,expires_at';
export const PUBLIC_WORKER_COLUMNS = 'id,categories,areas,experience_yrs,bio,photos,is_pro,rating_avg,rating_count,verified,completed_at';
export type WorkerContact = {name: string|null;phone: string;viber: string|null;telegram: string|null;whatsapp: string|null};
type RpcClient = { rpc(name: string,args?: Record<string,string>): PromiseLike<{data:unknown;error:{code:string}|null}> };
async function read<T>(client: SupabaseClient<Database>,name:string,args?:Record<string,string>):Promise<T|null> {
  const {data,error}=await (client as unknown as RpcClient).rpc(name,args);
  if (error) { console.error('[private read]',name,{code:error.code}); throw new Error('Private data unavailable'); }
  return (data as T[]|null)?.[0] ?? null;
}
export const getMyWorkerProfile = (client: SupabaseClient<Database>) => read<ProfileWorker>(client,'get_my_worker_profile');
export const getJobLocation = (client: SupabaseClient<Database>,jobId:string) => read<{lat:number|null;lng:number|null}>(client,'get_job_location',{p_job_id:jobId});
export const getJobWorkerContact = (client: SupabaseClient<Database>,jobId:string) => read<WorkerContact>(client,'get_job_worker_contact',{p_job_id:jobId});
