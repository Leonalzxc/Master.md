"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const InquirySchema = z.object({
  listing_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z.string().trim().min(5).max(2000),
});

export type SubmitInquiryResult =
  | { ok: true }
  | { ok: false; error: "validation" | "server" };

export async function submitInquiry(
  input: unknown,
): Promise<SubmitInquiryResult> {
  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("listing_inquiries")
    .insert(parsed.data);

  if (error) {
    console.error("[submitInquiry] supabase error:", error.message);
    return { ok: false, error: "server" };
  }

  return { ok: true };
}