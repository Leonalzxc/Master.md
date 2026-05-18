import { getTranslations } from "next-intl/server";
import ListingGallery from "./ListingGallery";
import ListingMapLoader from "./ListingMapLoader";
import ContactForm from "./ContactForm";
import type { Listing } from "@/lib/supabase/types";

type Props = {
  listing: Listing;
};

export default async function ListingDetail({ listing }: Props) {
  const t = await getTranslations("listing");

  const priceFormatted = new Intl.NumberFormat("ru-MD", {
    style: "currency",
    currency: listing.currency || "MDL",
    maximumFractionDigits: 0,
  }).format(listing.price);

  const hasCoords =
    typeof listing.lat === "number" && typeof listing.lng === "number";

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {listing.title}
        </h1>
        {listing.city && (
          <p className="text-neutral-600">{listing.city}</p>
        )}
        <p className="text-2xl font-medium text-emerald-700">
          {priceFormatted}
        </p>
      </header>

      <ListingGallery images={listing.images} title={listing.title} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("descriptionTitle")}</h2>
        <p className="whitespace-pre-line leading-relaxed text-neutral-800">
          {listing.description || t("noDescription")}
        </p>
      </section>

      {hasCoords && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t("locationTitle")}</h2>
          <ListingMapLoader
            lat={listing.lat as number}
            lng={listing.lng as number}
            title={listing.title}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("contactTitle")}</h2>
        <ContactForm listingId={listing.id} />
      </section>
    </article>
  );
}