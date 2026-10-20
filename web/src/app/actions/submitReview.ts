'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { runWorkflow } from '@/lib/supabase/workflow';
import type { WorkflowResult } from '@/lib/workflow';
export async function submitReview(jobId:string,rating:number,text:string,locale:string):Promise<WorkflowResult<{review_id:string;changed:boolean}[]>> {
  const valid=z.object({jobId:z.string().uuid(),rating:z.number().int().min(1).max(5),text:z.string().max(1000),locale:z.enum(['ru','ro'])}).safeParse({jobId,rating,text,locale});
  if (!valid.success) return {ok:false,error:'invalid_input'};
  const result=await runWorkflow<{review_id:string;changed:boolean}[]>('complete_job',{p_job_id:jobId,p_rating:rating,p_text:text.trim()});
  if (result.ok) {
    revalidatePath(`/${locale}/jobs/${jobId}`);
    revalidatePath(`/${locale}/account/client`);
    revalidatePath(`/${locale}/account/worker`);
    revalidatePath(`/${locale}/workers`);
  }
  return result;
}
