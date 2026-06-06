// ============================================================
// Core domain types for MASTER Moldova
// ============================================================

export type { Category } from '@/lib/mock/data';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'client' | 'worker' | 'admin';

export type Profile = {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  city: string | null;
  avatar_url: string | null;
  telegram_chat_id?: number | null;
  blocked_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type ProfileWorker = {
  id: string;
  bio: string | null;
  categories: string[];
  areas: string[];
  experience_yrs: number | null;
  is_pro: boolean;
  verified: boolean;
  bid_credits: number;
  rating_avg: number;
  rating_count: number;
  portfolio: string[];
  photos: string[] | null;
  price_hint: string | null;
  viber: string | null;
  telegram: string | null;
  whatsapp: string | null;
  created_at?: string;
  updated_at?: string | null;
};

// ------------------------------------------------------------
// Jobs
// ------------------------------------------------------------

export const JOB_STATUSES = [
  'open',
  'active',
  'in_progress',
  'done',
  'cancelled',
  'blocked',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: string;
  city: string | null;
  address: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  images: string[];
  photos: string[] | null;
  urgent: boolean;
  needs_quote: boolean | null;
  status: JobStatus;
  assigned_worker_id: string | null;
  created_at: string;
  updated_at?: string | null;
};

// ------------------------------------------------------------
// Bids
// ------------------------------------------------------------

export const BID_STATUSES = ['sent', 'selected', 'rejected'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export type Bid = {
  id: string;
  job_id: string;
  worker_id: string;
  price: number | null;
  price_max: number | null;
  comment: string | null;
  start_date: string | null;
  status: BidStatus;
  created_at: string;
  updated_at?: string | null;
};

// ------------------------------------------------------------
// Offers
// ------------------------------------------------------------

export const OFFER_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type Offer = {
  id: string;
  job_id: string;
  worker_id: string;
  price: number | null;
  currency: string;
  message: string;
  status: OfferStatus;
  created_at: string;
  updated_at?: string | null;
};

// ------------------------------------------------------------
// Reviews
// ------------------------------------------------------------

export type Review = {
  id: string;
  job_id: string | null;
  worker_id: string;
  author_id: string;
  rating: number;
  text: string | null;
  created_at: string;
};

// ------------------------------------------------------------
// Notifications
// ------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'new_bid',
  'bid_selected',
  'bid_received',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

// ------------------------------------------------------------
// Sorting helpers
// ------------------------------------------------------------

export const JOB_SORT_VALUES = [
  'created_desc',
  'created_asc',
  'budget_desc',
  'budget_asc',
] as const;
export type JobSort = (typeof JOB_SORT_VALUES)[number];

export const WORKER_SORT_VALUES = [
  'rating_desc',
  'rating_asc',
  'experience_desc',
] as const;
export type WorkerSort = (typeof WORKER_SORT_VALUES)[number];

// ------------------------------------------------------------
// Legacy Listing types
// ------------------------------------------------------------

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
  'price_asc',
  'price_desc',
  'created_desc',
] as const;
export type ListingSort = (typeof LISTING_SORT_VALUES)[number];

// ------------------------------------------------------------
// Database interface
// ------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Profile>;
      };
      profiles_worker: {
        Row: ProfileWorker;
        Insert: Omit<ProfileWorker, 'created_at'> & { created_at?: string };
        Update: Partial<ProfileWorker>;
      };
      jobs: {
        Row: Job;
        Insert: Partial<Job> & { client_id: string; title: string; description: string; category: string };
        Update: Partial<Job>;
      };
      bids: {
        Row: Bid;
        Insert: Partial<Bid> & { job_id: string; worker_id: string };
        Update: Partial<Bid>;
      };
      offers: {
        Row: Offer;
        Insert: Partial<Offer> & { job_id: string; worker_id: string; message: string };
        Update: Partial<Offer>;
      };
      reviews: {
        Row: Review;
        Insert: Partial<Review> & { worker_id: string; author_id: string; rating: number };
        Update: Partial<Review>;
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> & { user_id: string; type: string; title: string };
        Update: Partial<Notification>;
      };
      listing_inquiries: {
        Row: ListingInquiryInput & { id: string; created_at: string };
        Insert: ListingInquiryInput;
        Update: Partial<ListingInquiryInput>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_notification: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title: string;
          p_body: string;
          p_link?: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}

export type JobRow = Database['public']['Tables']['jobs']['Row'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];

export type BidRow = Database['public']['Tables']['bids']['Row'];
export type BidInsert = Database['public']['Tables']['bids']['Insert'];

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileWorkerRow = Database['public']['Tables']['profiles_worker']['Row'];

export type ReviewRow = Database['public']['Tables']['reviews']['Row'];
