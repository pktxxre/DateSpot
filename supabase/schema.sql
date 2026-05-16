-- DateSpot Supabase Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/sql

-- ─────────────────────────────────────────────
-- 1. visits
-- ─────────────────────────────────────────────
create table if not exists public.visits (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  venue_name    text not null,
  lat           float8 not null,
  lng           float8 not null,
  visited_at    timestamptz not null,
  rating        float8 not null default 0,
  rank_order    float8 not null default 0,
  notes         text,
  activity_type text not null default 'other',
  price         int2 not null default 2,
  photos        text,                          -- JSON array of Supabase Storage URLs
  triage        text not null default 'okay',  -- 'bad' | 'okay' | 'great'
  date_type     text,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.visits enable row level security;

-- Anyone (including anon) can read seed spots
create policy "read seed spots"
  on public.visits for select
  using (is_seed = true);

-- Authenticated users can read their own visits
create policy "read own visits"
  on public.visits for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert their own visits
create policy "insert own visits"
  on public.visits for insert
  to authenticated
  with check (auth.uid() = user_id and is_seed = false);

-- Authenticated users can update their own visits
create policy "update own visits"
  on public.visits for update
  to authenticated
  using (auth.uid() = user_id and is_seed = false);

-- Authenticated users can delete their own visits
create policy "delete own visits"
  on public.visits for delete
  to authenticated
  using (auth.uid() = user_id and is_seed = false);

-- ─────────────────────────────────────────────
-- 2. future_spots
-- ─────────────────────────────────────────────
create table if not exists public.future_spots (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  venue_name text not null,
  lat        float8 not null,
  lng        float8 not null,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.future_spots enable row level security;

create policy "read own future spots"
  on public.future_spots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own future spots"
  on public.future_spots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own future spots"
  on public.future_spots for update
  to authenticated
  using (auth.uid() = user_id);

create policy "delete own future spots"
  on public.future_spots for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. settings  (seed version tracking)
-- ─────────────────────────────────────────────
create table if not exists public.settings (
  key   text primary key,
  value text
);

alter table public.settings enable row level security;

-- Public read (used by app to check seed_version)
create policy "read settings"
  on public.settings for select
  using (true);

-- ─────────────────────────────────────────────
-- 4. Storage bucket: photos
-- ─────────────────────────────────────────────
-- Run separately in Storage dashboard if bucket doesn't exist yet.
-- insert into storage.buckets (id, name, public) values ('photos', 'photos', true);

-- Allow authenticated users to upload to photos bucket
-- create policy "upload photos"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'photos');

-- Allow public read of photos
-- create policy "read photos"
--   on storage.objects for select
--   using (bucket_id = 'photos');

-- ─────────────────────────────────────────────
-- 5. top_spots — canonical crowd-sourced top spots per city
-- ─────────────────────────────────────────────
-- canonical_place_id is a vendor-neutral composite:
--   sha256(normalize(venue_name) + geohash6(lat, lng))
-- osm_place_id is Nominatim enrichment only (not the PK).
create table if not exists public.top_spots (
  canonical_place_id  text primary key,
  canonical_name      text not null,
  canonical_lat       float8 not null,
  canonical_lng       float8 not null,
  osm_place_id        text,
  city                text,
  activity_type       text,
  visit_count         int4 not null default 1,
  last_visited_at     timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.top_spots enable row level security;

-- Anyone can read Top Spots (seed data model)
create policy "read top spots"
  on public.top_spots for select
  using (true);

-- Only service role (Edge Function) can write — prevents client-side manipulation
-- No authenticated user write policy intentional.

-- Index for city-based Top Spots queries
create index if not exists top_spots_city_visit_count
  on public.top_spots (city, visit_count desc);

-- ─────────────────────────────────────────────
-- 6. upsert_top_spot() — called by the resolve-place Edge Function (service role)
--    Increments visit_count if the canonical place already exists.
-- ─────────────────────────────────────────────
create or replace function public.upsert_top_spot(
  p_canonical_place_id text,
  p_canonical_name     text,
  p_canonical_lat      float8,
  p_canonical_lng      float8,
  p_osm_place_id       text,
  p_city               text,
  p_activity_type      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.top_spots (
    canonical_place_id, canonical_name, canonical_lat, canonical_lng,
    osm_place_id, city, activity_type, visit_count, last_visited_at, updated_at
  ) values (
    p_canonical_place_id, p_canonical_name, p_canonical_lat, p_canonical_lng,
    p_osm_place_id, p_city, p_activity_type, 1, now(), now()
  )
  on conflict (canonical_place_id) do update
    set visit_count      = top_spots.visit_count + 1,
        last_visited_at  = now(),
        updated_at       = now();
end;
$$;

-- ─────────────────────────────────────────────
-- 7. delete_user() — lets a user delete their own account
-- ─────────────────────────────────────────────
-- Run this in the Supabase SQL Editor. The SECURITY DEFINER clause lets it
-- run as the postgres superuser so it can delete from auth.users.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
