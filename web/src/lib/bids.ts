import { z } from 'zod';

export const bidInputSchema = z.object({
  jobId: z.string().uuid(),
  price: z.number().finite().positive().max(1_000_000_000),
  comment: z.string().trim().min(10).max(2000),
  startDate: z.union([z.literal(''), z.iso.date()]),
  locale: z.enum(['ru', 'ro']),
});

export type BidInput = z.input<typeof bidInputSchema>;
export const bidErrors = [
  'not_authenticated', 'not_worker', 'account_blocked', 'own_job',
  'job_unavailable', 'no_credits', 'invalid_input', 'temporarily_unavailable',
] as const;
export type BidError = typeof bidErrors[number];
export type BidResult =
  | { ok: true; bidId: string; created: boolean; creditsRemaining: number }
  | { ok: false; error: BidError };

export type SubmitBidRow = { bid_id: string; created: boolean; credits_remaining: number };
