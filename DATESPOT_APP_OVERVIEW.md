# DateSpot — Complete App Overview

> Everything an AI (or human) needs to understand this app without reading a single line of code.

---

## What Is DateSpot?

DateSpot is a **map-first date journal** for the actively-dating single person. The core premise: you've been on a lot of dates, you can't remember where you went or whether it was good, and you're about to repeat a mistake. DateSpot solves that by turning every date spot into a personal map pin — colored by how good it was, backed by your journal notes, and ranked against every other place you've been.

The app is also a **discovery tool** for people who need a place to take someone. It shows top-rated spots in a city, organized by category (food, bars, views, etc.), sourced from the community's aggregated visit data.

**Target user:** Actively dating singles who want to:
- Never repeat a bad spot
- Track vibes and quality across different dates and people
- Discover genuinely good experiential places
- Share their curated "map of their dating life" with a potential match

**Core loop:** Log a spot → it lands on your map → share your map

---

## Platform & Tech Stack

| Layer | Choice | Details |
|-------|--------|---------|
| Framework | Expo (React Native + TypeScript) | iOS-first, Android capable |
| Navigation | expo-router (file-based, tab layout) | Tab bar + stack modals |
| Maps | react-native-maps | Apple Maps on iOS, no external token |
| Database | expo-sqlite (SQLite) | Local device storage, no cloud backend |
| Backend (optional) | Supabase | Used for photo uploads, canonical place resolution, community top spots |
| Photos | expo-image-picker | Up to 3 photos per spot, uploaded to Supabase Storage |
| Auth | Supabase Auth (or local mock) | Email/password, magic link, Apple Sign-In |
| Fonts | InstrumentSerif-Regular | Used for headings throughout |
| Icons | @expo/vector-icons (Ionicons) | All iconography |

---

## Visual Design System

### Color palette

The app uses a **warm, earthy palette** that feels analog and personal — not a cold tech product.

```
T.bg         = #FCFAF5   (warm off-white background)
T.card       = #FFFFFF   (card surfaces)
T.inputBg    = #F5F1ED   (input fields, chips)
T.border     = #EDE8E0   (hairline dividers)
T.primary    = #1C1410   (dark warm-black text)
T.muted      = #9E8F7F   (secondary/label text)
T.placeholder = #C4B9AD  (placeholder text)
T.accent     = #E76F51   (coral/terracotta — primary brand color)
T.accentTint = #FEF0EB   (light coral tint for selected states)
T.danger     = #E74C3C   (destructive actions)
```

### Rating colors (semantic)
- Green `#34c759` — rating ≥ 6.8 (great)
- Amber `#ff9500` — rating ≥ 3.3 (okay)
- Red `#ff3b30` — below 3.3 (bad)

Rating color is used everywhere: map pins, score pills, accent bars on list rows, tier badges.

### Hero colors (per venue category)
Each activity type has a rich earthy color used as the hero background on spot detail screens:
- Food → `#C4604A` (warm terracotta)
- Bars → `#C49A4A` (amber gold)
- Cafes → `#A07850` (warm brown)
- Outdoors → `#6A8F6A` (forest green)
- Indoors → `#7A8CAA` (slate blue)
- Scenic/View → `#6A8FA0` (teal)
- Entertainment → `#8B7BB0` (soft purple)
- Shopping → `#C47890` (dusty rose)
- Other → `#8B7255` (warm taupe)

### Typography
- **Headings/titles:** `InstrumentSerif-Regular` — gives the app a personal, editorial feel
- **Body/UI:** System font, various weights (500, 600, 700, 800)
- **Labels:** All-caps, letter-spacing 1.2–1.5, size 10–12

### Layout patterns
- Rounded cards: `borderRadius: 16–24`
- Hairline dividers: `StyleSheet.hairlineWidth`
- Rating shown as bordered pill (color-coded outline, no fill)
- Colored left bar on list rows (4px wide, full row height, rating color)
- Section labels: all-caps, muted, small tracking
- Floating header buttons on detail screens: semi-transparent white circles over hero

---

## Navigation Structure

```
Tab Bar (bottom)
├── Discover (index)      — home feed: top spots, stacks, recent dates
├── Map                   — full-screen map of your visits + saved spots
├── Add (+)               — navigates to map + opens log sheet
├── Lists                 — your ranked spots + date nights (stacks)
└── Profile               — your profile, stats, settings
```

**Stack screens (modal overlays):**
- `/spot/[id]` — spot detail (works for both personal visits and seed/discovery spots)
- `/stack/[id]` — date night stack detail
- `/spots` — full category browse (see all top spots)
- `/tier/[tier]` — all stacks in a given tier (S/A/B/C/F)
- `/future/[id]` — saved (wishlist) spot detail
- `/onboarding` — first-launch onboarding
- `/auth/index`, `/auth/login`, `/auth/signup` — auth screens
- `/settings` — app settings
- `/edit-profile` — edit name, bio, city, photo
- `/friends` — friends list

---

## Tab 1: Discover (Home)

**File:** `app/(tabs)/index.tsx`

This is the home feed. Think of it as a curated magazine of date spots for your city.

### Header
- City name displayed in all-caps above the "Discover" title
- Profile avatar in the top-right (taps through to Profile tab)

### Search bar
- Full-width rounded search field below the header
- Searches across venue names and notes in the spot pool
- Search results show as a card list with rating pills; clears when you tap the X

### Friend Referral Unlock Card
A gamified card that shows how many friends you've invited (placeholder count: 1) and what features unlock at each threshold:
- 1 friend → Friends tab
- 2 friends → Top spots
- 3 friends → Filter top spots
- 4 friends → Filter saved & been-to
- 5 friends → Friends activity
- 6 friends → Date calendar

The card has a progress bar (pills, coral filled vs. light empty), horizontally scrollable unlock chips showing lock/checkmark icons, and a coral "Invite your Friends" button.

### Top Date Spots Section
- Section title: "Top date spots" + "Your next date spot is waiting" subtitle
- "See all →" links to `/spots`

### Category Cards (horizontal scroll)
A snap-scrolling horizontal list of category cards. Each card:
- **Hero section:** tall colored rectangle (activity-type color) with the category name and "Top N in your area" text
- **Spot rows:** ranked 1–N list of top spots in that category, each with rank number, name, price, and color-coded rating pill
- Tapping a spot navigates to `/spot/[id]`

Data source: if the community has logged enough spots in this city, uses real aggregated `top_spots` data from Supabase. Falls back to curated `seed_spots` (pre-loaded JSON for cities like New York).

Categories: Food, Bars, Cafes, Outdoors, Indoors, Scenic, Entertainment, Shopping, Other.

### Your Stacks Section (conditional)
Only shown if you have at least one stack. Horizontal scroll of compact stack cards:
- Stack name (serif font), date, spot count badge
- Journey line: "First Spot → Last Spot"
- Quality badge (colored dot with tier)
- Taps to `/stack/[id]`

### Recent Dates Section
- Title: "Recent dates", "See all →" link
- Shows your 5 most recent personal visits
- Each row: colored left bar (rating color), venue name, meta (category · price · date), score pill
- Empty state: "Tap [+circle] to log your first date spot" inline instruction

---

## Tab 2: Map

**File:** `app/(tabs)/map.tsx`

The map is the emotional core of the app. Every date you've logged becomes a pin. Over time it becomes a personal geography of your dating life.

### Map behavior
- Full-screen Apple Maps (react-native-maps)
- Shows user location
- All visited spots = colored pins based on rating (green/amber/red)
- Saved ("want to go") spots = bookmark pins (indigo/purple)
- Tap any pin → opens bottom sheet with spot summary
- Tap the map itself → dismisses any open sheet

### Log Flow (opened from the + tab or the FAB)
The `+` tab button navigates to Map and immediately opens a multi-step log sheet. This is the primary entry point for logging a new visit.

**Step 1 — Location**
- "Use my location" (GPS via expo-location)
- "Search" — text search over seed spots + past visits
- "Drop a pin" — tap on map to place
- Selected location shown as a preview pin

**Step 2 — Spot Details**
- Venue name (text input, auto-filled if from search)
- Activity type: chip select — Food, Bars, Cafes, Outdoors, Indoors, Scenic, Entertainment, Shopping, Other
- Occasion type: chip select — Romantic, Friend, Solo
- Price: chip select — Free, $, $$, $$$
- Triage bucket: "bad", "okay", or "great" (sets the rating band)

**Step 3 — Journal**
- Date of visit (custom date picker — Month/Day/Year dropdowns)
- Notes: multiline freeform text
- Photos: up to 3, picked from library, uploaded to Supabase Storage

**Step 4 — Rating (Comparison Engine)**
This is the most sophisticated part of the app. Instead of asking "rate this 1–10" (which is meaningless without context), the app asks **pairwise comparison questions**:

> "Which was better: [This spot] vs [Another spot you've been to]?"

The system uses **binary search** over your existing visits (sorted by `rank_order`), narrowing down the insertion position in at most 7 comparisons. Options: "This one", "That one", "Too hard to compare."

If you have no existing visits, it shows a simple triage picker (Great / Okay / Bad) with an explanatory note.

After insertion, `recomputeRatings()` runs over all your visits and redistributes ratings within each triage bucket:
- "great" → 7.0–10.0
- "okay" → 4.0–6.7
- "bad" → 1.0–3.2

The math is proportional distribution based on `rank_order` position within the bucket. A single visit in a bucket gets the max score for that bucket.

### Saved Spots (wishlist)
A separate layer on the map (toggled by a control) showing spots you've saved from Discovery. These are stored in a `future_spots` table and shown with a distinct bookmark-style pin.

---

## Tab 3: Lists

**File:** `app/(tabs)/lists.tsx`

Your personal ranked history. Two sub-tabs: **Spots** and **Date Nights**.

### Spots Tab

Your complete log of personal visits, ranked and filterable.

**Header:** "X SPOTS LOGGED" label, "Your list" serif title, profile avatar

**Filters (horizontal scroll chips):**
- All, Romantic, Friend, Solo

**Sort toggle:** Best (by rating) ↔ Recent (by created_at)

**Search bar:** Free-text search across venue names and notes

**Each spot row:**
- Colored left bar (rating color)
- Rank number (in Best mode) or nothing (in selection mode, replaced by checkbox)
- Venue name (serif) + score pill
- Meta line: Category · Price · Date
- Notes preview (first 70 chars, italic, in a warm brown color)
- Long-press → enters selection mode

**Selection mode:**
- All spots get a circular checkbox
- A floating bottom bar appears: "Stack these (N)" button (disabled until 2+ selected)
- Tap "Stack these" → opens the Create Stack modal

**Empty state:**
- "No dates logged yet" + hint to tap the + button
- Per-filter: "No Romantic spots yet" + "Clear filter" link

### Date Nights Tab (Stacks)

A visual tier board — think S/A/B/C/F ranking, like a Letterboxd for your date nights.

**Tiers:**
| Tier | Meaning | Color |
|------|---------|-------|
| S | Legendary nights | Gold/warm yellow |
| A | Great nights | Green-teal |
| B | Solid nights | Blue |
| C | Mediocre nights | Gray-purple |
| F | Bad nights | Red-pink |

**Tier row layout:**
- Big tier letter badge (colored, with a subtle wash behind)
- Stack count below badge
- Hairline divider
- Photo thumbnails from stacks in that tier (30×30 rounded squares)
- Chevron to open tier detail

Tapping a tier row navigates to `/tier/[tier]` which shows all stacks in that tier as full cards.

**Toolbar:** "N stacks" count + "New Stack" button (orange-bordered pill, opens spot selection flow)

**Creating a Stack:**
1. Tap "New Stack" → switches to Spots tab in selection mode
2. Select 2+ spots by tapping (or long-press first)
3. Tap "Stack these" floating button
4. Modal Step 1: Give the stack a name (e.g. "Saturday Night Out")
5. Modal Step 2: Tap a tier (S/A/B/C/F) — this is the tier placement
6. Optional note: "Why this tier?"
7. Confirm → **fly animation**: a scaled-up card pops up in the center of screen, then flies/shrinks toward the selected tier row. The tier row bounces when the card lands.

**Empty state:**
- Layers icon + "No stacks yet" + explanation + "Try it" button

---

## Tab 4: Profile

**File:** `app/(tabs)/profile.tsx`

Clean profile screen. Currently minimal — functions as a stats hub and settings gateway.

**Hero section:**
- Avatar (96×96 circle with shadow, shows Ionicons person icon as placeholder)
- Username in serif font
- Bio text (if set)

**Stats row:**
- Logs (count of all personal visits)
- Friends (taps to `/friends`)
- Following

**Action buttons:**
- "Edit Profile" (outlined coral) → `/edit-profile`
- "Share Profile" (card-surface background) → native Share sheet

**Recent Activity:**
- Last 3 logged visits shown as rows
- "No activity yet. Start logging spots!" empty state

**Settings gear:** Top-right, taps to `/settings`

---

## Spot Detail Screen

**File:** `app/spot/[id].tsx`

Works for both personal visits AND discovery seed spots. The ID determines which mode renders.

### Personal Visit Detail

**Floating header (absolute positioned over hero):**
- Back button (white circle, semi-transparent)
- Share button → native Share with formatted rating message
- Edit button → opens Edit Modal
- Delete button → confirmation alert

**Hero (colored background = activity type color):**
- Category + price in small all-caps text
- Venue name (large serif)
- Date visited

**White card (rounded corners, overlapping hero):**
- "Rank again" button (comparison re-run)
- "Make a Stack" button
- Rating badge (bordered circle, color-coded)
- "NOTES FROM THE NIGHT" section (if notes exist)
- "WHERE IT IS" — non-interactive mini MapView showing the pin with rating label, "View on map" hint overlay
- "PHOTOS" — grid of photo thumbnails (full-width divided by 3)

**Edit Modal (page sheet):**
- Name text input
- Date picker (custom Month/Day/Year dropdown tabs with animated expand)
- Photos (grid with add button, long-press to remove)
- Category chips
- Occasion type buttons (Romantic / Friend / Solo)
- Price buttons (Free / $ / $$ / $$$)
- Notes multiline input

**Rank Again Modal (floating card over dim overlay):**
- Pairwise comparison flow (same as log flow Step 4)
- "Too hard to compare" → places at midpoint
- Shows opponent's current rating as a colored pill

### Seed/Discovery Spot Detail

**Floating header:**
- Back button
- "+" button → schedules log with this location pre-filled, navigates to map
- Bookmark button → toggles save to future/wishlist list

**Saved banner (animated):** Slides down from above when you bookmark, shows "Saved! Check it out on your map." then slides away after 1.5s.

**Hero:** Same colored structure as personal visit.

**White card:**
- "Editor's Pick" badge (coral star) if this spot is in the top 10 by rating across the city
- Rating badge (shows average of all community logs, tap to expand "Avg. of all logs" caption)
- "WHY IT'S A GREAT DATE" (seed notes)
- Non-interactive mini map
- Address text
- "PHOTOS" — photos from all users who logged this venue (queried from Supabase)
- "WHAT YOUR FRIENDS THINK" — placeholder section, shows "None of your friends have logged this spot yet" + "Add friends" button

---

## Stack Detail Screen

**File:** `app/stack/[id].tsx`

Shows a named collection of spots from the same date night.

**Header:** Back, Edit (pencil), Delete (trash)

**Hero:**
- Stack name (large serif)
- "N spots" badge + "X.X avg" rating badge (color-coded)
- Journey line: "First Spot → Last Spot" (italic)

**Spots section:**
- Ranked list of all spots in the stack
- Each row: index number, colored rating dot, venue name + category/date meta, score pill
- Tapping navigates to that spot's detail

**Photos section (if any exist):**
- Horizontal scroll strip of 96×96 photos

**Modals available:**
- Edit Stack: rename + remove individual spots (minimum 2 required)
- Rank Stack: pairwise comparison of this stack against other stacks (ranks date nights relative to each other)

---

## Data Model

All data lives locally in SQLite on the device. Supabase is used for:
- Photo storage (Supabase Storage)
- Canonical place resolution (Edge Function: `resolve-place`)
- Community top spots (if enough local users have logged in the same city)

### visits
```
id                 uuid PK
venue_name         text
lat                float
lng                float
address            text | null
visited_at         date (YYYY-MM-DD)
rating             float (1.0–10.0, recomputed)
rank_order         float (0.0–1.0, source of truth for ordering)
notes              text | null
activity_type      enum (food|bars|cafes|outdoors|indoors|view|entertainment|shopping|other)
occasion_type      enum (romantic|friend|solo)
price              int (0=Free, 1=$, 2=$$, 3=$$$)
triage             enum (bad|okay|great) — sets the rating band
date_type          enum (first|casual|special|friend|solo|so|secret) | null
photos             JSON array of URL strings
resolution_status  enum (pending|resolved|failed) — canonical place resolution state
canonical_place_id text | null
canonical_name     text | null
canonical_lat      float | null
canonical_lng      float | null
is_seed            int (0 or 1)
created_at         timestamp
```

### stacks
```
id          uuid PK
name        text
tier        enum (S|A|B|C|F)
note        text | null
rank_order  float
rating      float (avg of member visits, recomputed)
created_at  timestamp
```

### stack_visits (junction)
```
stack_id   uuid FK stacks
visit_id   uuid FK visits
sort_order int
```

### future_spots (wishlist)
```
id          uuid PK
venue_name  text
lat         float
lng         float
created_at  timestamp
```

---

## Rating System

### Why it works this way

Absolute number ratings ("7/10") are meaningless without context. What makes DateSpot's rating system different:

1. You **compare two specific places** you've actually been to. This anchors the rating in real memory.
2. The binary search approach means you only need **at most 7 comparisons** to place any new spot in its exact position among all your previous visits.
3. Ratings are **recomputed** every time you log or re-rank. They're not what you typed — they're your current relative ranking expressed as a number.

### Rating bands (triage system)

Before comparing, you give a spot a rough triage:
- **Great** → will end up rated 7.0–10.0
- **Okay** → will end up rated 4.0–6.7
- **Bad** → will end up rated 1.0–3.2

This means comparisons only happen *within* a band. You never compare a great spot against a bad spot — that would be pointless. Ratings are relative within their quality bucket.

### Recomputation math (`recomputeRatings`)

Runs after every insert, delete, or re-rank. For each [triage × occasion_type] group:

```
n = total spots in this group
For spot at position i (0-indexed, sorted by rank_order):
  if n == 1:
    rating = max_for_triage
  else if n <= 10:
    step = (max - min) * 10 / (9 * n)
    rating = max(min, max - (n - 1 - i) * step)
  else:
    pct = i / (n - 1)
    rating = min + pct * (max - min)
```

The result: every spot gets a rating proportional to its position in the sorted order. Add a new "great" spot, and all other "great" romantic spots shift down slightly. Your relative ordering is preserved.

### Comparison engine (`lib/ranking.ts`)

State machine: `idle → comparing[lo, hi, mid, count] → done`

```
startComparison(others, filterFn) → ComparisonState
advance(state, 'better' | 'worse') → ComparisonState | null (null = done)
resolveRankOrder(finalState, others) → float
resolveAtMid(state, others) → float  (for "too hard to compare")
```

Binary search: `mid = Math.floor((lo + hi) / 2)`. If the new spot is better than mid, move `hi = mid`. If worse, move `lo = mid + 1`. Terminates in ≤7 rounds.

---

## Canonical Place Resolution

When you log a spot, the app fires a background call to a Supabase Edge Function (`resolve-place`) with your venue name, lat/lng, city, and activity type. The function canonicalizes the place (standardizes the name and coordinates against a reference dataset) and writes back `canonical_place_id`, `canonical_name`, `canonical_lat`, `canonical_lng` to your local visit row.

This is what enables community aggregation: if 10 different users log "The Met" with slightly different spellings, they all get resolved to the same `canonical_place_id`, and that place's visit count/average rating can be computed for the top spots feed.

`resolution_status`: `pending` → processing, `resolved` → canonical found, `failed` → no match (still usable locally, just not aggregatable).

---

## Seed Spots

Seed spots are a JSON database of curated places per city (currently New York). They're pre-loaded so new users see a full Discover feed from day one, before any real community data exists.

Seed spots have the same shape as regular visit rows but with `is_seed = 1`. They appear in discovery but not in your personal lists or map.

When a city reaches a threshold of real user-contributed data, the top spots feed switches from seeds to real aggregated data (via the `getTopSpots` function which checks `top_spots` view from Supabase).

---

## Key Interactions & Micro-animations

### Stack fly animation
When you create a new stack from the Lists screen:
1. A large tile (110×110, rounded, showing the stack's cover photo or tier badge) pops up from the center of the screen with a spring animation
2. After 400ms it flies toward the correct tier row — using the tier row's approximate Y position to calculate `translateY` delta, and `translateX = -(width * 0.32)` to move left toward the tier badge
3. Simultaneously scales down to 0 and fades out
4. When it "lands", the tier row bounces with a spring animation (scale 1 → 1.06 → 1)

This makes creating a stack feel satisfying and spatial — you see your night "filing" itself into the right tier.

### Saved banner (seed spots)
When bookmarking a seed spot: a pill notification slides down from above the hero area ("Saved! Check it out on your map.") with spring entrance, auto-dismisses after 1.5s with a fade exit.

### Rating badge expansion (seed spots)
The rating badge on a seed spot detail is tappable — it toggles a "Avg. of all logs" caption below it.

### Date picker dropdowns (edit flow)
The Month/Day/Year date picker uses `LayoutAnimation` for smooth height transitions when opening/closing each field. The dropdown is absolutely positioned relative to the row, uses a `ScrollView` with scroll-to-selected behavior, and has a bottom fade gradient to hint that there are more options.

---

## Empty & Error States

| Screen | Empty state |
|--------|-------------|
| Discover: recent dates | "Tap [+ circle] to log your first date spot" inline |
| Discover: search | "No spots match" + "Clear search" link |
| Lists: spots | "No dates logged yet" + same + hint |
| Lists: spots (filtered) | "No Romantic spots yet" + "Clear filter" |
| Lists: date nights | Layers icon + explanation + "Try it" CTA |
| Spot detail: photos | Camera icon + "No photos yet" |
| Spot detail: friend opinions | People icon + "None of your friends have logged this spot yet" + "Add friends" button |
| Map | FAB centered on map |
| Profile: activity | "No activity yet. Start logging spots!" |

---

## Social / Friends System (in progress)

The app has a friends layer being built. Current state:

- **Friends tab** (`app/(tabs)/friends.tsx`): Visible but gated behind friend invite unlock system
- **Friends list screen** (`app/friends.tsx`): Accessible from Profile stats row
- **Spot detail - friend opinions**: Placeholder shown when viewing a seed spot — will show friends' ratings of that venue
- **Invite referral card** (Discover home): Gamified unlock system — each friend unlocked enables a new feature tier

The social unlock system is a growth mechanic: features are progressively unlocked as you invite more friends, from basic social visibility up to a "date calendar" at 6 friends.

---

## Profile & Settings

### Edit Profile (`app/edit-profile.tsx`)
Fields: display name, username, bio, city, profile photo (from camera roll, uploaded to Supabase Storage)

### Settings (`app/settings.tsx`)
Expected to include: notification preferences, privacy settings, account management (delete account flow), sign out.

---

## Auth Flow

**Files:** `app/auth/index.tsx`, `app/auth/login.tsx`, `app/auth/signup.tsx`, `app/onboarding.tsx`

- Auth state managed by Supabase Auth
- New users go through onboarding after sign-up
- Persistent auth session via Supabase AsyncStorage adapter
- `.env.local` required (see CLAUDE.md): `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Without valid keys, the app shows "Configuration Error" on any data action

---

## Vibe & Design Philosophy

DateSpot is intentionally **not** a Yelp or a Google Maps. It's a personal journal that happens to look beautiful on a map. The design choices reflect that:

- **Warm, analog palette** — feels like a physical notebook, not a tech product
- **Serif headings** (InstrumentSerif) — editorial, personal, not startup-y
- **No star ratings** — numbers only, color-coded, relative
- **Pairwise comparison** — forces you to actually think, creates more meaningful ratings
- **"Notes from the night"** section title — positions the app as memory-keeping, not reviewing
- **Date type options** (First Date, Casual, Special, With S/O, Secret) — acknowledges the emotional reality of dating
- **Tier system for stacks** — makes your date nights feel like achievements to rank and remember
- **"Editor's Pick"** badge — adds curation authority to top spots without fake reviews
- **"What your friends think"** section — social proof rooted in people you actually trust

The app treats your dating life as something worth documenting — not to optimize it, but to remember it.

---

## Current Branch Status (as of May 2026)

Branch: `pktxxre/p1-core-loop-polish`

**Recently merged:**
- S/A/B/C/F tier rating system for stacks
- Shimmer skeleton loading, compare polish, stack card cleanup
- Log resume prompt, pin label collision fix, search locality fix
- P0 bug fixes (tier entry navigation, etc.)

**Modified files (uncommitted):**
- `app/(tabs)/index.tsx` — home screen
- `app/(tabs)/lists.tsx` — lists/stacks
- `app/(tabs)/map.tsx` — map + log flow
- `app/(tabs)/profile.tsx` — profile
- `app/spot/[id].tsx` — spot detail
- `app/spots.tsx` — all spots browse
- `app/stack/[id].tsx` — stack detail
- `lib/db.ts` — SQLite schema/init
- `lib/visits.ts` — visit data layer
- `supabase/seed_user_2_evan_lin.sql` — seed data

---

## What Makes This App Special

1. **Map as memory** — your personal map of your dating life is emotionally resonant in a way no list is
2. **Comparison rating** — the only rating system that gives you contextually meaningful scores
3. **Stacks = date nights** — treating a date as a journey (bar → dinner → rooftop) rather than a single place is true to how people actually date
4. **Tier board** — gamifies your date history in a way that's fun to look back on
5. **City-level top spots** — crowdsourced from people who've actually been on dates there, not Yelp reviewers
6. **Social unlock** — growth built into the core UX, not bolted on as an afterthought
7. **Privacy-forward** — "with whom" data is optional and never aggregated; occasion types let you keep dates categorized without oversharing
