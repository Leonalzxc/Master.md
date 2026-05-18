import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getListingById } from "@/lib/supabase/listings";
import ListingDetail from "@/components/features/ListingDetail";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const listing = await getListingById(id);
  const t = await getTranslations("listing");

  if (!listing) {
    return { title: t("notFoundTitle") };
  }

  return {
    title: listing.title,
    description: listing.description.slice(0, 160),
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) notFound();

  const listing = await getListingById(id);
  if (!listing) notFound();

  return <ListingDetail listing={listing} />;
}