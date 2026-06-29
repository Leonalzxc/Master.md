import { getTranslations } from "next-intl/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
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
    <>
      <Header />
      <main className="flex-1" style={{ background: 'var(--bg-deep)', paddingBottom: 64 }}>
        <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--glass-border)', padding: '24px 0' }}>
          <div className="container">
            <h1 className="font-bold text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {t("title")}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {t("subtitle")} · {listings.length} {t("count", { count: listings.length })}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>
          <ListingsFilters
            locale={locale}
            cities={cities}
            selectedCity={cityParam}
            selectedSort={sort}
          />

          {listings.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center mt-6"
              style={{ border: '1.5px dashed var(--glass-border)', color: 'var(--text-muted)', fontSize: 14 }}
            >
              {t("empty")}
            </div>
          ) : (
            <section
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6"
              aria-label={t("title")}
            >
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}