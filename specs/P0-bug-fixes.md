# P0 — Bug Fixes

These break core flows. Build these before anything else.

---

## 1. Log from card opens wrong step

**Problem:** Tapping "Log" on a card from All Spots opens a "continue editing?" prompt instead of jumping directly to the logging flow at step 2.

**Expected behavior:** Tapping "Log" from any card in All Spots should open the logging modal at **step 2** — as if the user is logging that spot fresh. No "continue editing" prompt.

**Notes:**
- Step 2 is the date picker step (calendar picker — see P1 for the calendar UI change)
- The spot name should be pre-filled and shown at the top (editable but not auto-prompted — see P1)
- Do not resume any in-progress log state for that spot; start fresh at step 2

---

## 2. Map pin label overlap

**Problem:** When two spots are logged close together (e.g., across the street from each other), their name labels collide on the map.

**Expected behavior:** Position labels based on relative longitude:
- The spot further **east** (higher longitude) → label on the **right** side of the pin
- The spot further **west** (lower longitude) → label on the **left** side of the pin

**Notes:**
- This applies to both the Been To map and the Want to Go map
- Compare pin coordinates pairwise or against nearby cluster to determine which side to render the label
- Label text color stays black regardless (see P1 for the highlight color fix)

---

## 3. Search returning far-away results

**Problem:** The search bar when logging a spot returns results from outside Seattle (or wherever the user is). Users are seeing places from unrelated cities.

**Expected behavior:** Search results should default to within ~5 miles of the user's current location.

**Implementation:**
- Request GPS coordinates on the search step using native device APIs
- Pass coordinates + a radius (start with 5 miles / ~8km) as a bias parameter to the search API
- Fall back to IP-based geolocation if GPS permission is denied
- Do not block the search if location is unavailable — just drop the radius bias

**Notes:**
- This is the scoped fix. A fuller localization pass (device locale, language, adjustable radius) is in P3.
- The goal here is: user in Seattle should never see a result in Chicago as a top hit.
