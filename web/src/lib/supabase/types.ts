export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Category =
  | 'electric' | 'plumbing' | 'finishing' | 'roofing'
  | 'tiling' | 'minorRepairs' | 'furniture' | 'painting';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string;
          role: 'client' | 'worker' | 'admin';
          name: string | null;
          city: string | null;
          created_at: string;
          blocked_at: string | null;
          block_reason: string | null;
          telegram_chat_id: number | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      profiles_worker: {
        Row: {
          id: string;
          categories: Category[];
          areas: string[];
          experience_yrs: number | null;
          bio: string | null;
          photos: string[] | null;
          viber: string | null;
          telegram: string | null;
          whatsapp: string | null;
          is_pro: boolean;
          pro_until: string | null;
          bid_credits: number;
          rating_avg: number;
          rating_count: number;
          verified: boolean;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles_worker']['Row'], never>;
        Update: Partial<Database['public']['Tables']['profiles_worker']['Row']>;
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          description: string;
          category: Category;
          city: string;
          area: string;
          budget_min: number | null;
          budget_max: number | null;
          urgent: boolean;
          needs_quote: boolean;
          photos: string[] | null;
          status: 'active' | 'in_progress' | 'done' | 'cancelled' | 'blocked';
          selected_worker_id: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at' | 'expires_at'>;
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
      };
      bids: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          price: number | null;
          price_max: number | null;
          comment: string;
          start_date: string | null;
          status: 'sent' | 'selected' | 'rejected';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bids']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['bids']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          job_id: string;
          author_id: string;
          worker_id: string;
          rating: number;
          text: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

// Convenience row types
export type Profile      = Database['public']['Tables']['profiles']['Row'];
export type ProfileWorker = Database['public']['Tables']['profiles_worker']['Row'];
export type Job          = Database['public']['Tables']['jobs']['Row'];
export type Bid          = Database['public']['Tables']['bids']['Row'];
export type Review       = Database['public']['Tables']['reviews']['Row'];

// Joined types for UI
export type JobWithBidCount = Job & { bid_count: number };
export type WorkerWithProfile = Profile & ProfileWorker;
export type BidWithWorker = Bid & {
  worker: Profile & Pick<ProfileWorker, 'is_pro' | 'verified' | 'rating_avg' | 'rating_count'>;
};
