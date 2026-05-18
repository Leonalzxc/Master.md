import { getTranslations } from "next-intl/server";
import {
  listListings,
  listListingCities,
} from "@/lib/supabase/listings";
import {
  LISTING_SORT_VALUES,
  type ListingSort,
} from "@/lib/supabase/types";
import ListingCard from "@/components/features/ListingCard";
import ListingsFilters from "@/components/features/ListingsFilters";

type SearchParams = Promise<{
  city?: string | string[];
  sort?: string | string[];
}>;

type Params = Promise<{ locale: string }>;

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function isListingSort(v: string | undefined): v is ListingSort {
  return !!v && (LISTING_SORT_VALUES as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: { params: Params }) {
  await params;
  const t = await getTranslations("listings");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function ListingsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const cityParam = pickString(sp.city)?.trim() || null;
  const sortParam = pickString(sp.sort);
  const sort: ListingSort = isListingSort(sortParam) ? sortParam : "created_desc";

  const [listings, cities, t] = await Promise.all([
    listListings({ city: cityParam, sort }),
    listListingCities(),
    getTranslations("listings"),
  ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-neutral-600">{t("subtitle")}</p>
      </header>

      <ListingsFilters
        locale={locale}
        cities={cities}
        selectedCity={cityParam}
        selectedSort={sort}
      />

      {listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          {t("empty")}
        </p>
      ) : (
        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label={t("title")}
        >
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </section>
      )}

      <p className="text-sm text-neutral-500">
        {t("count", { count: listings.length })}
      </p>
    </main>
  );
}