-- DateSpot — Initial Schema
-- Migration: 20260422000001_initial_schema
--
-- Creates all V1 tables, RLS policies, and the public_profiles view.
-- Run in your Supabase project via the SQL editor or Supabase CLI.

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE spot_type AS ENUM ('scenic', 'activity', 'food', 'event', 'other');
CREATE TYPE cost_tier AS ENUM ('free', '$', '$$', '$$$');

-- ─────────────────────────────────────────────────────────────────────────────
-- users
--
-- Mirrors Supabase Auth. Created via trigger on auth.users insert so the row
-- exists by the time the app first queries it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  name        text NOT NULL DEFAULT '',
  avatar_url  text,
  username    text UNIQUE,                   -- nullable; set on first share action
  profile_public boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Constraint: username must be alphanumeric, 3–20 chars (or null)
ALTER TABLE users ADD CONSTRAINT users_username_format
  CHECK (username IS NULL OR (username ~ '^[a-zA-Z0-9]{3,20}$'));

-- Trigger: create users row on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- places (per-user, not shared between users in V1)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE places (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat                 float8 NOT NULL,
  lng                 float8 NOT NULL,
  title               text NOT NULL,
  type                spot_type NOT NULL DEFAULT 'other',
  cost                cost_tier NOT NULL DEFAULT 'free',
  external_place_id   text,    -- Mapbox Place ID; reserved for V2 dedup
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX places_user_id_idx ON places(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- visits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE visits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id          uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  rating            smallint NOT NULL CHECK (rating BETWEEN 1 AND 10),
  with_person       text,                    -- private; never exposed publicly
  date_time         timestamptz NOT NULL DEFAULT now(),
  duration_minutes  integer,
  notes             text CHECK (char_length(notes) <= 1500),
  photos            text[] NOT NULL DEFAULT '{}',  -- storage paths, NOT signed URLs
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visits_user_id_idx  ON visits(user_id);
CREATE INDEX visits_place_id_idx ON visits(place_id);
CREATE INDEX visits_rating_idx   ON visits(user_id, rating);

-- ─────────────────────────────────────────────────────────────────────────────
-- pins (wishlist / saved spots — UI label: "Saved")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)  -- one pin per place per user
);

CREATE INDEX pins_user_id_idx ON pins(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- public_profiles VIEW
--
-- Used by the share sheet deep link (V1) and future web profile (V1.5).
-- Exposes: username, title, type, cost, rating, lat, lng.
-- Never exposes: with_person, notes, photos, visit dates.
-- Only shows spots where profile_public = true AND rating >= 7.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public_profiles AS
SELECT
  u.username,
  pl.title,
  pl.type,
  pl.cost,
  v.rating,
  pl.lat,
  pl.lng
FROM visits v
JOIN places pl ON pl.id = v.place_id
JOIN users u   ON u.id  = v.user_id
WHERE u.profile_public = true
  AND v.rating >= 7;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE: private photos bucket
-- ─────────────────────────────────────────────────────────────────────────────

-- Run this in the Supabase dashboard → Storage → New bucket:
--   Name: spots
--   Public: false
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('spots', 'spots', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users  ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins   ENABLE ROW LEVEL SECURITY;

-- users: full CRUD on own row
CREATE POLICY users_own ON users
  FOR ALL USING (id = auth.uid());

-- places: full CRUD on own rows
CREATE POLICY places_own ON places
  FOR ALL USING (user_id = auth.uid());

-- visits: full CRUD on own rows
CREATE POLICY visits_own ON visits
  FOR ALL USING (user_id = auth.uid());

-- pins: full CRUD on own rows
CREATE POLICY pins_own ON pins
  FOR ALL USING (user_id = auth.uid());

-- public_profiles view: readable by all authenticated users
-- (the view's WHERE clause already filters to profile_public = true)
CREATE POLICY public_profiles_read ON users
  FOR SELECT USING (profile_public = true);

-- Storage RLS: users can only access their own files.
-- Path structure: {user_id}/{filename}
CREATE POLICY storage_own_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'spots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY storage_own_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'spots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY storage_own_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'spots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
