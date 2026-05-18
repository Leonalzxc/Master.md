-- Add `city` to listings + RPCs for index page

alter table public.listings
  add column if not exists city text;

create index if not exists listings_city_idx
  on public.listings (city);

-- Extend single-item RPC to include city
create or replace function public.get_listing_by_id(p_id uuid)
returns table (
  id          uuid,
  title       text,
  description text,
  price       numeric,
  currency    text,
  city        text,
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
    l.city,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    l.images,
    l.created_at
  from public.listings l
  where l.id = p_id;
$$;

-- List RPC: filter by city + sort by price
-- p_sort in: 'price_asc' | 'price_desc' | 'created_desc'
create or replace function public.list_listings(
  p_city text default null,
  p_sort text default 'created_desc',
  p_limit int default 60,
  p_offset int default 0
)
returns table (
  id          uuid,
  title       text,
  price       numeric,
  currency    text,
  city        text,
  lat         double precision,
  lng         double precision,
  cover_image text,
  created_at  timestamptz
)
language sql
stable
as $$
  select
    l.id,
    l.title,
    l.price,
    l.currency,
    l.city,
    st_y(l.location::geometry) as lat,
    st_x(l.location::geometry) as lng,
    case when array_length(l.images, 1) > 0 then l.images[1] else null end as cover_image,
    l.created_at
  from public.listings l
  where (p_city is null or l.city = p_city)
  order by
    case when p_sort = 'price_asc'    then l.price end asc nulls last,
    case when p_sort = 'price_desc'   then l.price end desc nulls last,
    case when p_sort = 'created_desc' then l.created_at end desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- Returns list of distinct, non-null cities (for the filter dropdown)
create or replace function public.list_listing_cities()
returns table (city text)
language sql
stable
as $$
  select distinct l.city
  from public.listings l
  where l.city is not null and l.city <> ''
  order by 1;
$$;