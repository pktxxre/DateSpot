# P3 — Bigger Features

These require design decisions or data model changes before touching code. Plan before building.

---

## 17. Ratings per category

**Problem:** Comparing a friendly casual date spot to a special occasion restaurant on the same rating scale doesn't make sense. A dive bar might be a great casual date but rank poorly against a Michelin-starred restaurant on a single unified scale.

**Expected behavior:**
- Ratings are scoped **per category** (e.g., a spot's rank only competes with other spots in the same category)
- The This or That comparison flow (step 4) only compares spots within the same category
- Leaderboards, top spots, and map hierarchies all reflect per-category rank

**Design questions to answer before building:**
- What are the categories? (See P3 item 19 for the updated category list)
- Does a spot have one category or can it belong to multiple?
- What happens when a user has only one spot in a category — do comparisons wait until there are two?
- How is per-category rank displayed on a spot card vs. a global rank?

**Notes:**
- This likely touches the data model (spot table, ratings table, comparison history)
- Design the schema change first and align on it before writing any UI
- This is the most architecturally significant feature in the backlog

---

## 18. True search localization

**Problem:** P0 scoped the search fix to a 5-mile GPS radius. This fuller version makes search aware of the user's language, locale, and adjustable radius preferences.

**Expected behavior:**
- Pull the user's preferred **language and locale** from device settings (native APIs) and pass to search
- Use **GPS coordinates** in real time to set the search origin
- Default search radius: **5 miles**; consider exposing a radius control in the future
- Fall back to IP-based geolocation if GPS is unavailable or denied

**Implementation steps:**
1. Device Settings: Use native APIs to read the user's preferred language and geographic locale
2. GPS: Request location permission; use coordinates as the search bias origin
3. IP fallback: If GPS unavailable, use IP-based geolocation for approximate coordinates
4. Pass all of the above to the search API as bias/filter parameters

**Notes:**
- P0 already fixes the immediate "wrong city" problem; this is the complete, production-quality version
- Test with location permission denied to verify the fallback path works
- Consider a visible "Searching near [City]" label in the search UI so users know where results are anchored

---

## 19. New and refined categories

**Problem:** The current category list is missing common date activities and "Outdoors" is too broad to be useful.

**Changes:**
- Add **Cafes** as a category
- Add **Shopping** as a category
- Break **Outdoors** into subcategories — examples:
  - Hike / Trail
  - Park
  - Beach
  - Scenic View / Overlook
  - (others TBD based on your user base)

**Design questions to answer before building:**
- Should "Outdoors" remain as a parent category with subcategories, or be fully replaced?
- Are subcategories selectable independently, or always nested under Outdoors?
- How do category changes affect existing spots that were tagged as "Outdoors"? (migration path)
- Does adding categories require updating the P3 per-category ratings design?

**Notes:**
- Coordinate this with item 17 (ratings per category) — the final category list should be locked before building the ratings schema
- Adding categories is straightforward; the migration of existing "Outdoors" spots requires a decision on how to reclassify them
