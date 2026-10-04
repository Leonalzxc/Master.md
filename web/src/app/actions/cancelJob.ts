'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { runWorkflow } from '@/lib/supabase/workflow';
import type { WorkflowResult } from '@/lib/workflow';
export async function cancelJob(jobId: string, locale: string): Promise<WorkflowResult<boolean>> {
  if (!z.string().uuid().safeParse(jobId).success || !['ru','ro'].includes(locale)) return { ok:false,error:'invalid_input' };
  const result=await runWorkflow<boolean>('cancel_job',{ p_job_id:jobId });
  if (result.ok) {
    revalidatePath(`/${locale}/jobs/${jobId}`);
    revalidatePath(`/${locale}/account/client`);
    revalidatePath(`/${locale}/account/worker`);
    revalidatePath(`/${locale}/jobs`);
  }
  return result;
}
