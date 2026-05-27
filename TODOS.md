# TODOS

Deferred items from planning and review sessions. Each item has context on why it was deferred.

---

## Testing

- [x] **P0: AsyncStorage Jest mock** — Fixed in v0.1.4.1: added `moduleNameMapper` to jest config in `package.json` pointing to the bundled mock. Also updated `ratingColor` thresholds in `visits.test.ts` to match current implementation (green >= 6.8, orange >= 3.3). All 21 tests now pass. **Completed: v0.1.4.1 (2026-05-21)**

---

## Cloud Sync (added v0.2.0.0, 2026-05-22)

- [ ] **P2: restoreFromCloud concurrent-call guard** — If `SIGNED_IN` fires twice on login, both calls pass the `COUNT = 0` guard before either writes rows. Add a module-level `_restoring` boolean to early-return if a restore is in progress. Low risk (INSERT OR IGNORE prevents duplication), but causes double `recomputeRatings()` call.

- [ ] **P2: syncStackToCloud atomic delete+insert** — `syncStackToCloud` deletes then re-inserts `stack_visits`. A network drop between the two leaves the cloud stack with no members. Wrap in a Supabase RPC or add retry logic.

## Testing (added v0.2.0.0, 2026-05-22)

- [ ] **P2: Unit test coverage for lib/sync.ts and lib/friends.ts** — Both are new files (267 and 295 lines) with 0% test coverage. Requires Supabase mock setup. **Updated v0.4.0.0:** Coverage improved to ~65% on pure logic paths (added tests for friendlyDate, stackTier, stackCreation, ranking edge cases, cleanAddress); Supabase-dependent modules still need mock setup.

## Deferred from v0.4.0.0 review (added 2026-05-27)

- [ ] **P2: `handleCheckHandle` error not surfaced** — In `app/auth/index.tsx` and `app/onboarding.tsx`, the handle-availability Supabase query doesn't check the `error` field; a query failure silently allows the user through. Add `if (error) { setHandleChecking(false); return; }` before `setHandleTaken(!!data)`.

- [ ] **P2: Notifications non-atomic dedup** — `notifyActivity` in `lib/notifications.ts` does a select-then-insert for deduplication; two rapid calls can both pass the guard. Add a unique constraint on `(user_id, actor_id, type, ref_id)` in Supabase and handle the 409/23505 error in the insert path.

- [ ] **P3: Supabase JWT stored in unencrypted AsyncStorage** — Session tokens are readable on rooted devices. Consider migrating to `expo-secure-store` for the auth storage adapter (low urgency for early-stage).

## Canonical Place Resolution (deferred from autoplan review, 2026-05-15)

- [ ] **Friend-graph visit attribution** — Sync user visits to Supabase with `user_id` attached. Enables "3 of your friends visited this place" in Top Spots — the actual moat vs. Yelp. Requires: new `user_visits` Supabase table, RLS so users only see their own, opt-in consent UX, and changes to `getTopSpots()` to filter by friend graph. Bigger scope than current feature.

- [ ] **Retry for visits stuck in `pending` resolution_status** — When the Edge Function is unreachable (airplane mode, Supabase down), visits stay in `pending` forever. Add a retry pass on app open: query visits WHERE resolution_status = 'pending' AND created_at < now() - 1 hour, re-trigger `resolveCanonicalPlace()` for each. Batch to avoid hammering Nominatim.

- [ ] **Per-user deduplication in top_spots** — Same user logging the same canonical place twice inflates `visit_count`. Fix: track (user_id, canonical_place_id) pairs in a separate `top_spot_contributions` table; upsert instead of increment when the pair already exists. Requires user_id to flow through the Edge Function.

- [ ] **Production Nominatim** — The free public Nominatim API has a 1 req/sec policy. Fine for early stage. At ~5,000 daily visit logs, switch to a self-hosted Nominatim instance (Docker image available) or a paid provider (e.g., LocationIQ). Supabase Edge Function only needs the base URL changed.

- [ ] **visit_count decrement on visit delete** — When a user deletes a visit that was `resolution_status = 'resolved'`, the corresponding `top_spots.visit_count` should decrement. Needs a "delete-canonical" Edge Function call from `deleteVisit()`, or a Postgres trigger on a `user_visits` table. Currently an orphan — the count stays inflated.

- [ ] **Admin view of top_spots** — Simple Supabase dashboard query or a script to monitor Top Spots quality: spot the top 20 by visit_count per city, flag any with suspiciously high counts (gaming indicator). No UI needed — just a saved SQL query.

- [ ] **Expose resolution_status in spot detail** — In `app/spot/[id].tsx`, optionally show a "Matched to canonical place" indicator in debug/dev builds. Helps validate the pipeline is working without needing DB access.
