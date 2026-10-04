import 'server-only';
import { createClient } from './server';
import { workflowErrors, type WorkflowError, type WorkflowResult } from '@/lib/workflow';

type Rpc = { rpc(name: string, args: Record<string,unknown>): PromiseLike<{
  data: unknown; error: { code: string; message: string } | null;
}> };
export async function runWorkflow<T>(name: string, args: Record<string,unknown>): Promise<WorkflowResult<T>> {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  const { data, error } = await (client as unknown as Rpc).rpc(name,args);
  if (error) {
    if (error.code === 'P0001' && workflowErrors.includes(error.message as WorkflowError)) {
      return { ok: false, error: error.message as WorkflowError };
    }
    console.error('[workflow]', name, { code: error.code });
    return { ok: false, error: 'temporarily_unavailable' };
  }
  if (data === null) return { ok: false, error: 'temporarily_unavailable' };
  return { ok: true, data: data as T };
}
