# Seed Data Generation Instructions

You are generating seed data for **DateSpot**, a date spot discovery and logging app for Seattle, WA. Your output must be a single valid JSON file containing an array of 60 date spot objects.

---

## Your Task

Generate exactly **60 date spot objects** for Seattle, WA. Each object represents a real, curated venue that is genuinely good for a date. Return them as a single JSON array — nothing else. No explanation, no markdown, no code fences. Just the raw JSON array starting with `[` and ending with `]`.

---

## Output Format

Each object must have exactly these fields:

```json
{
  "id": "seed_001",
  "user_id": "cb747060-ce98-43b5-925d-84ccdfca905f",
  "venue_name": "Pittock Mansion",
  "lat": 45.5267,
  "lng": -122.7163,
  "activity_type": "view",
  "price": 1,
  "rating": 7.5,
  "rank_order": 1.0,
  "notes": "Historic mansion with sweeping Portland views. Great for a scenic first date walk — free to explore the grounds.",
  "triage": "great",
  "is_seed": true,
  "visited_at": "2000-01-01T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Field Rules

| Field | Rule |
|-------|------|
| `id` | Sequential strings: `"seed_001"` through `"seed_060"` |
| `user_id` | Always exactly `"cb747060-ce98-43b5-925d-84ccdfca905f"` — do not change |
| `venue_name` | Real venue name as it appears on Google Maps |
| `lat` / `lng` | Real coordinates — must place the pin on the actual venue, not a nearby street |
| `activity_type` | One of the six exact values below |
| `price` | Integer 0, 1, 2, or 3 only — see table below |
| `rating` | Float — see triage mapping below |
| `rank_order` | Float from 0.1 to 1.0 — higher = shown first within its category |
| `notes` | 1–2 sentences. Why is this good for a date? Be specific — mention atmosphere, what makes it special, best time to go. Not generic. |
| `triage` | One of: `"great"`, `"okay"`, `"bad"` — see table below |
| `is_seed` | Always `true` |
| `visited_at` | Always `"2000-01-01T00:00:00Z"` |
| `created_at` | Always `"2025-01-01T00:00:00Z"` |

---

## Activity Types

Use **exactly** these strings — no variations:

| Value | What it covers |
|-------|----------------|
| `"food"` | Restaurants, brunch spots, food halls, picnic-worthy delis |
| `"drinks"` | Cocktail bars, wine bars, speakeasies, rooftop bars, breweries with vibe |
| `"outdoors"` | Hikes, parks, waterfronts, gardens, scenic walks |
| `"view"` | Scenic overlooks, rooftop decks, hilltop parks, bridges with views |
| `"entertainment"` | Bowling, mini golf, museums, comedy clubs, escape rooms, live music venues, movie theatres |
| `"other"` | Coffee shops, tea houses, bookshops with seating — good for a first date |

---

## Price Scale

| Value | Label | Meaning |
|-------|-------|---------|
| `0` | Free | No entry cost |
| `1` | $ | Under $20/person |
| `2` | $$ | $20–$50/person |
| `3` | $$$ | $50+/person |

---

## Triage + Rating Mapping

| Triage | Rating range | Use for |
|--------|-------------|---------|
| `"great"` | 7.0 – 10.0 | Exceptional date spots — memorable, atmosphere is the point |
| `"okay"` | 4.0 – 6.9 | Solid spots — good but not destination-worthy on their own |
| `"bad"` | 2.0 – 3.9 | Do not use — all seed spots should be `"great"` or `"okay"` |

Assign ratings as floats. Examples: `7.5`, `8.2`, `5.0`, `9.0`. Do not use integers.

---

## Category Distribution

Generate this many spots per category:

| Category | Count |
|----------|-------|
| `food` | 12 |
| `drinks` | 10 |
| `outdoors` | 10 |
| `view` | 8 |
| `entertainment` | 10 |
| `other` | 10 |
| **Total** | **60** |

---

## Quality Bar

Every spot must pass all of these:

1. **Real venue** — it actually exists in Seattle, WA as of 2024. No invented names.
2. **Accurate coordinates** — the pin must land on the venue, not a nearby intersection.
3. **Date-appropriate** — would you take a date here? Is there atmosphere, something to do, something to talk about?
4. **Specific notes** — "Great cocktail bar" is not acceptable. "Dark, intimate speakeasy in a basement — order the Negroni and ask for the back booth" is.
5. **Geographic spread** — don't cluster everything in one neighborhood. Cover: Capitol Hill, Belltown, Pioneer Square, South Lake Union, Fremont, Ballard, Queen Anne, West Seattle, Eastlake, International District, Pike Place area, Madrona.

---

## rank_order Guidance

Within each category, assign `rank_order` to express quality ranking:
- Top 2–3 spots in a category: `0.9` – `1.0`
- Great spots: `0.7` – `0.8`
- Solid spots: `0.5` – `0.6`
- Good but not standout: `0.3` – `0.4`

The app sorts `rank_order` descending (highest shown first).

---

## Notes Field Examples

**Good:**
> "Candlelit basement bar in Capitol Hill with serious cocktail craft. Order off the back of the menu for off-list drinks. Best for a second or third date."

> "Free loop trail with Lake Washington views at the top. Go in the evening for the sunset over the Olympics. Bring a jacket."

> "Counter-service ramen but the back room is dim and intimate — feels like a hidden spot even when it's busy. Best on a cold evening."

**Bad (too generic):**
> "Nice restaurant with good food and a cozy atmosphere."
> "Beautiful park with great views."
> "Popular bar with lots of drink options."

---

## Example Object

```json
{
  "id": "seed_001",
  "user_id": "cb747060-ce98-43b5-925d-84ccdfca905f",
  "venue_name": "Kerry Park",
  "lat": 47.6295,
  "lng": -122.3598,
  "activity_type": "view",
  "price": 0,
  "rating": 8.5,
  "rank_order": 0.95,
  "notes": "The classic Seattle skyline shot with Mt. Rainier behind it — free, tiny park on Queen Anne Hill. Go at dusk for the full effect. Bring a jacket.",
  "triage": "great",
  "is_seed": true,
  "visited_at": "2000-01-01T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## Output Instructions

- Return **only** the JSON array. No explanation before or after.
- Start your response with `[`
- End your response with `]`
- Valid JSON — no trailing commas, no comments
- All 60 objects in a single flat array
- IDs sequential from `seed_001` to `seed_060`
