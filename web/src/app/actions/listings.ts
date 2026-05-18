"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LISTING_SORT_VALUES } from "@/lib/supabase/types";

const FiltersSchema = z.object({
  locale: z.string().min(2).max(8),
  city: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sort: z.enum(LISTING_SORT_VALUES).optional(),
});

/**
 * Server action для формы фильтров.
 * Просто строит URL с query-параметрами и делает redirect — это
 * нативный паттерн App Router (shareable URL + SSR + кэш).
 */
export async function applyListingsFilters(formData: FormData): Promise<void> {
  const parsed = FiltersSchema.safeParse({
    locale: formData.get("locale"),
    city: formData.get("city"),
    sort: formData.get("sort"),
  });

  if (!parsed.success) {
    redirect(`/${formData.get("locale") ?? "ru"}/listings`);
  }

  const { locale, city, sort } = parsed.data;
  const sp = new URLSearchParams();
  if (city) sp.set("city", city);
  if (sort) sp.set("sort", sort);

  const qs = sp.toString();
  redirect(`/${locale}/listings${qs ? `?${qs}` : ""}`);
}