# TODOS

Deferred items from planning and review sessions. Each item has context on why it was deferred.

---

## Canonical Place Resolution (deferred from autoplan review, 2026-05-15)

- [ ] **Friend-graph visit attribution** — Sync user visits to Supabase with `user_id` attached. Enables "3 of your friends visited this place" in Top Spots — the actual moat vs. Yelp. Requires: new `user_visits` Supabase table, RLS so users only see their own, opt-in consent UX, and changes to `getTopSpots()` to filter by friend graph. Bigger scope than current feature.

- [ ] **Retry for visits stuck in `pending` resolution_status** — When the Edge Function is unreachable (airplane mode, Supabase down), visits stay in `pending` forever. Add a retry pass on app open: query visits WHERE resolution_status = 'pending' AND created_at < now() - 1 hour, re-trigger `resolveCanonicalPlace()` for each. Batch to avoid hammering Nominatim.

- [ ] **Per-user deduplication in top_spots** — Same user logging the same canonical place twice inflates `visit_count`. Fix: track (user_id, canonical_place_id) pairs in a separate `top_spot_contributions` table; upsert instead of increment when the pair already exists. Requires user_id to flow through the Edge Function.

- [ ] **Production Nominatim** — The free public Nominatim API has a 1 req/sec policy. Fine for early stage. At ~5,000 daily visit logs, switch to a self-hosted Nominatim instance (Docker image available) or a paid provider (e.g., LocationIQ). Supabase Edge Function only needs the base URL changed.

- [ ] **visit_count decrement on visit delete** — When a user deletes a visit that was `resolution_status = 'resolved'`, the corresponding `top_spots.visit_count` should decrement. Needs a "delete-canonical" Edge Function call from `deleteVisit()`, or a Postgres trigger on a `user_visits` table. Currently an orphan — the count stays inflated.

- [ ] **Admin view of top_spots** — Simple Supabase dashboard query or a script to monitor Top Spots quality: spot the top 20 by visit_count per city, flag any with suspiciously high counts (gaming indicator). No UI needed — just a saved SQL query.

- [ ] **Expose resolution_status in spot detail** — In `app/spot/[id].tsx`, optionally show a "Matched to canonical place" indicator in debug/dev builds. Helps validate the pipeline is working without needing DB access.
