import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ListingListItem } from "@/lib/supabase/types";

type Props = {
  listing: ListingListItem;
};

export default async function ListingCard({ listing }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("listings");

  const priceFormatted = new Intl.NumberFormat(
    locale === "ro" ? "ro-MD" : "ru-MD",
    {
      style: "currency",
      currency: listing.currency || "MDL",
      maximumFractionDigits: 0,
    },
  ).format(listing.price);

  return (
    <Link
      href={`/${locale}/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-neutral-100">
        {listing.cover_image ? (
          <Image
            src={listing.cover_image}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
            {t("noImage")}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-neutral-900">
          {listing.title}
        </h3>

        {listing.city && (
          <p className="text-sm text-neutral-600">{listing.city}</p>
        )}

        <p className="mt-auto text-lg font-semibold text-emerald-700">
          {priceFormatted}
        </p>
      </div>
    </Link>
  );
}