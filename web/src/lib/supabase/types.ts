// ============================================================
// Core domain types for MASTER Moldova
// ============================================================

export type { Category } from "@/lib/mock/data";

export type UserRole = "client" | "worker" | "admin";

export type Profile = {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  city: string | null;
  avatar_url: string | null;
  telegram_chat_id?: number | null;
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
// Jobs (заявки клиентов)
// ------------------------------------------------------------

export const JOB_STATUSES = [
  "open",
  "active",
  "in_progress",
  "done",
  "cancelled",
  "blocked",
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
// Bids (отклики мастеров на заявки)
// ------------------------------------------------------------

export const BID_STATUSES = ["sent", "selected", "rejected"] as const;
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
// Offers (отклики мастеров)
// ------------------------------------------------------------

export const OFFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
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

export type Notification = {
  id: string;
  user_id: string;
  type: string;
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
  "created_desc",
  "created_asc",
  "budget_desc",
  "budget_asc",
] as const;
export type JobSort = (typeof JOB_SORT_VALUES)[number];

export const WORKER_SORT_VALUES = [
  "rating_desc",
  "rating_asc",
  "experience_desc",
] as const;
export type WorkerSort = (typeof WORKER_SORT_VALUES)[number];

// ============================================================
// Legacy Listing types (для обратной совместимости)
// ============================================================

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

// ============================================================
// Supabase Database schema
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Insertable<T> = Partial<T>;
type Updatable<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insertable<Profile> & { id: string; phone: string };
        Update: Updatable<Profile>;
        Relationships: [];
      };
      profiles_worker: {
        Row: ProfileWorker;
        Insert: Insertable<ProfileWorker> & { id: string };
        Update: Updatable<ProfileWorker>;
        Relationships: [
          {
            foreignKeyName: "profiles_worker_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: Job;
        Insert: Insertable<Job> & {
          client_id: string;
          title: string;
          description: string;
          category: string;
        };
        Update: Updatable<Job>;
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_assigned_worker_id_fkey";
            columns: ["assigned_worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bids: {
        Row: Bid;
        Insert: Insertable<Bid> & { job_id: string; worker_id: string };
        Update: Updatable<Bid>;
        Relationships: [
          {
            foreignKeyName: "bids_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bids_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      offers: {
        Row: Offer;
        Insert: Insertable<Offer> & {
          job_id: string;
          worker_id: string;
          message: string;
        };
        Update: Updatable<Offer>;
        Relationships: [
          {
            foreignKeyName: "offers_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: Review;
        Insert: Insertable<Review> & {
          worker_id: string;
          author_id: string;
          rating: number;
        };
        Update: Updatable<Review>;
        Relationships: [
          {
            foreignKeyName: "reviews_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: Notification;
        Insert: Insertable<Notification> & {
          user_id: string;
          type: string;
          title: string;
        };
        Update: Updatable<Notification>;
        Relationships: [];
      };
      listing_inquiries: {
        Row: ListingInquiryInput & { id: string; created_at: string };
        Insert: ListingInquiryInput;
        Update: Updatable<ListingInquiryInput>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      job_status: JobStatus;
      offer_status: OfferStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];

export type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
export type OfferInsert = Database["public"]["Tables"]["offers"]["Insert"];

export type BidRow = Database["public"]["Tables"]["bids"]["Row"];
export type BidInsert = Database["public"]["Tables"]["bids"]["Insert"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileWorkerRow =
  Database["public"]["Tables"]["profiles_worker"]["Row"];

export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
