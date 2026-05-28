-- Privacy Settings Migration
-- Run this in the Supabase SQL Editor after the base schema.sql has been applied.

-- ─── 1. Add privacy columns to profiles ─────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_activity boolean NOT NULL DEFAULT true;

-- ─── 2. Index for the visits RLS join (avoids per-row seq scan on profiles) ─

CREATE INDEX IF NOT EXISTS profiles_id_show_activity
  ON public.profiles (id, show_activity);

-- ─── 3. Update visits friend-read policy to respect show_activity ────────────
-- The old policy let any accepted friend read all your visits regardless.
-- The new policy adds a join on profiles.show_activity so that visits from
-- users who turned off activity sharing are blocked at the DB level — not
-- just filtered in app code (which can be bypassed via the REST API).

DROP POLICY IF EXISTS "read friends visits" ON public.visits;
CREATE POLICY "read friends visits"
  ON public.visits FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.friends f
      JOIN public.profiles p ON p.id = public.visits.user_id
      WHERE f.status = 'accepted'
        AND p.show_activity = true
        AND (
          (f.user_id  = auth.uid() AND f.friend_id = public.visits.user_id)
          OR (f.friend_id = auth.uid() AND f.user_id  = public.visits.user_id)
        )
    )
  );

-- Note on is_private:
-- Profile visibility (is_private) is enforced at the app layer — the
-- "read any profile" policy stays open so private profiles remain searchable
-- by username/handle (Instagram model). The user/[id] screen shows a locked
-- state when is_private=true and the viewer is not an accepted follower.
-- Actual activity data (visits) is protected at the DB level via show_activity above.
