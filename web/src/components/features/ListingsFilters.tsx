import { getTranslations } from "next-intl/server";
import { applyListingsFilters } from "@/app/actions/listings";
import { LISTING_SORT_VALUES, type ListingSort } from "@/lib/supabase/types";

type Props = {
  locale: string;
  cities: string[];
  selectedCity: string | null;
  selectedSort: ListingSort;
};

export default async function ListingsFilters({
  locale,
  cities,
  selectedCity,
  selectedSort,
}: Props) {
  const t = await getTranslations("listings.filters");

  return (
    <form
      action={applyListingsFilters}
      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="locale" value={locale} />

      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="city" className="text-sm font-medium text-neutral-700">
          {t("city")}
        </label>
        <select
          id="city"
          name="city"
          defaultValue={selectedCity ?? ""}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
        >
          <option value="">{t("allCities")}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="sort" className="text-sm font-medium text-neutral-700">
          {t("sort")}
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={selectedSort}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
        >
          {LISTING_SORT_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`sortOptions.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
      >
        {t("apply")}
      </button>
    </form>
  );
}