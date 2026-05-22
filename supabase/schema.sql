-- DateSpot Supabase Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/sql
--
-- MIGRATION (run once if tables already exist):
-- See the "MIGRATION" section at the bottom of this file.

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

-- ─────────────────────────────────────────────
-- 8. stacks — user-created collections of visits
-- ─────────────────────────────────────────────
create table if not exists public.stacks (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  rating      float8 not null default 0,
  rank_order  float8 not null default 0,
  tier        text,
  tier_note   text,
  cover_photo text,
  created_at  timestamptz not null default now()
);

alter table public.stacks enable row level security;

create policy "read own stacks"
  on public.stacks for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own stacks"
  on public.stacks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own stacks"
  on public.stacks for update
  to authenticated
  using (auth.uid() = user_id);

create policy "delete own stacks"
  on public.stacks for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 9. stack_visits — junction: which visits belong to which stack
-- ─────────────────────────────────────────────
create table if not exists public.stack_visits (
  stack_id text    not null references public.stacks(id) on delete cascade,
  visit_id text    not null references public.visits(id) on delete cascade,
  position integer not null default 0,
  primary key (stack_id, visit_id)
);

alter table public.stack_visits enable row level security;

create policy "read own stack_visits"
  on public.stack_visits for select
  to authenticated
  using (exists (
    select 1 from public.stacks where id = stack_id and user_id = auth.uid()
  ));

create policy "insert own stack_visits"
  on public.stack_visits for insert
  to authenticated
  with check (exists (
    select 1 from public.stacks where id = stack_id and user_id = auth.uid()
  ));

create policy "update own stack_visits"
  on public.stack_visits for update
  to authenticated
  using (exists (
    select 1 from public.stacks where id = stack_id and user_id = auth.uid()
  ));

create policy "delete own stack_visits"
  on public.stack_visits for delete
  to authenticated
  using (exists (
    select 1 from public.stacks where id = stack_id and user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────
-- 10. profiles — user display info (name, handle, bio, city)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          text not null default '',
  handle            text not null default '',
  bio               text not null default '',
  profile_photo_uri text,
  avatar_emoticon   text not null default '',
  email             text not null default '',
  phone             text not null default '',
  city              text not null default '',
  city_lat          float8,
  city_lng          float8,
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "delete own profile"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- MIGRATION — run this block if the tables above already exist
-- Adds columns that were only stored locally before cloud sync was added.
-- ─────────────────────────────────────────────

-- visits: add columns missing from original cloud schema
alter table public.visits add column if not exists occasion_type    text not null default 'romantic';
alter table public.visits add column if not exists address          text;
alter table public.visits add column if not exists canonical_place_id text;
alter table public.visits add column if not exists canonical_name   text;
alter table public.visits add column if not exists canonical_lat    float8;
alter table public.visits add column if not exists canonical_lng    float8;
alter table public.visits add column if not exists resolution_status text not null default 'pending';
alter table public.visits add column if not exists rank_order       float8 not null default 0;

-- future_spots: add canonical resolution columns
alter table public.future_spots add column if not exists canonical_place_id  text;
alter table public.future_spots add column if not exists canonical_name      text;
alter table public.future_spots add column if not exists canonical_lat       float8;
alter table public.future_spots add column if not exists canonical_lng       float8;
alter table public.future_spots add column if not exists resolution_status   text not null default 'pending';

-- ─────────────────────────────────────────────
-- 11. friends — friend requests + accepted friendships
-- ─────────────────────────────────────────────

-- Allow all authenticated users to read any profile (needed for friend search)
drop policy if exists "read own profile" on public.profiles;
create policy "read any profile"
  on public.profiles for select
  to authenticated
  using (true);

create table if not exists public.friends (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

alter table public.friends enable row level security;

create policy "read own friendships"
  on public.friends for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "insert own friend request"
  on public.friends for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update received request"
  on public.friends for update
  to authenticated
  using (auth.uid() = friend_id);

create policy "delete own friendship"
  on public.friends for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Allow users to read visits belonging to their accepted friends
create policy "read friends visits"
  on public.visits for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = public.visits.user_id)
          or (f.friend_id = auth.uid() and f.user_id = public.visits.user_id)
        )
    )
  );

-- Emoji reactions on visits (visit_id is text to match visits.id PK type)
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  visit_id    text not null references public.visits(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique(visit_id, user_id)
);

alter table public.reactions enable row level security;
create policy "read reactions" on public.reactions for select to authenticated using (true);
create policy "insert own reaction" on public.reactions for insert with check (auth.uid() = user_id);
create policy "delete own reaction" on public.reactions for delete using (auth.uid() = user_id);

-- Notification inbox (ref_id is text to hold both visits.id and friends.id::text)
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  actor_id    uuid not null references auth.users(id) on delete cascade,
  type        text not null,  -- 'friend_request' | 'reaction'
  ref_id      text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "insert own notification" on public.notifications
  for insert with check (auth.uid() = actor_id);
create policy "update own notification" on public.notifications
  for update using (auth.uid() = user_id);

-- Security-definer RPC for accepting a friend request
-- (bypasses RLS so the acceptor can insert the reverse row)
create or replace function public.accept_friend_request(request_id uuid)
returns void language plpgsql security definer as $$
declare
  req record;
begin
  select * into req from public.friends where id = request_id;
  if req is null then raise exception 'request not found'; end if;
  if req.friend_id is distinct from auth.uid() then raise exception 'not authorized'; end if;
  update public.friends set status = 'accepted' where id = request_id;
  insert into public.friends (user_id, friend_id, status)
  values (req.friend_id, req.user_id, 'accepted')
  on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;
