-- Migration: listings + inquiries
-- Requires PostGIS for geography type

create extension if not exists postgis;

-- =========================================
-- listings
-- =========================================
create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  price        numeric(12, 2) not null check (price >= 0),
  currency     text not null default 'MDL',
  location     geography(Point, 4326),
  images       text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists listings_location_gix
  on public.listings using gist (location);

create index if not exists listings_created_at_idx
  on public.listings (created_at desc);

-- =========================================
-- listing_inquiries (контактные обращения)
-- =========================================
create table if not exists public.listing_inquiries (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  message     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists listing_inquiries_listing_id_idx
  on public.listing_inquiries (listing_id);

-- =========================================
-- RPC: get_listing_by_id с распакованными lat/lng
-- =========================================
create or replace function public.get_listing_by_id(p_id uuid)
returns table (
  id          uuid,
  title       text,
  description text,
  price       numeric,
  currency    text,
  lat         double precision,
  lng         double precision,
  images      text[],
  created_at  timestamptz
)
language sql
stable
as $$
  select
    l.id,
    l.title,
    l.description,
    l.price,
    l.currency,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    l.images,
    l.created_at
  from public.listings l
  where l.id = p_id;
$$;

-- =========================================
-- RLS
-- =========================================
alter table public.listings enable row level security;
alter table public.listing_inquiries enable row level security;

drop policy if exists "listings public read" on public.listings;
create policy "listings public read"
  on public.listings
  for select
  using (true);

drop policy if exists "inquiries public insert" on public.listing_inquiries;
create policy "inquiries public insert"
  on public.listing_inquiries
  for insert
  with check (true);