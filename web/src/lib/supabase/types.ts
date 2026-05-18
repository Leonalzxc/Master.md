export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  images: string[];
  created_at: string;
};

export type ListingListItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  cover_image: string | null;
  created_at: string;
};

export type ListingInquiryInput = {
  listing_id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
};

export const LISTING_SORT_VALUES = [
  "price_asc",
  "price_desc",
  "created_desc",
] as const;
export type ListingSort = (typeof LISTING_SORT_VALUES)[number];