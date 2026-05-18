import { createClient } from "@/lib/supabase/server";
import type {
  Listing,
  ListingListItem,
  ListingSort,
} from "@/lib/supabase/types";

export async function getListingById(id: string): Promise<Listing | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_listing_by_id", { p_id: id })
    .maybeSingle<Listing>();

  if (error) {
    console.error("[getListingById] supabase error:", error.message);
    return null;
  }

  return data ?? null;
}

export type ListListingsParams = {
  city?: string | null;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
};

export async function listListings(
  params: ListListingsParams = {},
): Promise<ListingListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_listings", {
    p_city: params.city ?? null,
    p_sort: params.sort ?? "created_desc",
    p_limit: params.limit ?? 60,
    p_offset: params.offset ?? 0,
  });

  if (error) {
    console.error("[listListings] supabase error:", error.message);
    return [];
  }

  return (data ?? []) as ListingListItem[];
}

export async function listListingCities(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_listing_cities");

  if (error) {
    console.error("[listListingCities] supabase error:", error.message);
    return [];
  }

  return ((data ?? []) as { city: string }[])
    .map((r) => r.city)
    .filter((c): c is string => typeof c === "string" && c.length > 0);
}