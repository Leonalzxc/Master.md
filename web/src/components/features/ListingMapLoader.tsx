"use client";

import dynamic from "next/dynamic";

const ListingMap = dynamic(() => import("./ListingMap"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-xl bg-neutral-100" />
  ),
});

type Props = {
  lat: number;
  lng: number;
  title: string;
};

export default function ListingMapLoader(props: Props) {
  return <ListingMap {...props} />;
}