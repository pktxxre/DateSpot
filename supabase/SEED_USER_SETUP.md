# DateSpot — Seed User & Seed Data Setup

This guide walks through setting up the Supabase backend, creating a seed user, and inserting the AI-generated seed spots.

---

## Step 1 — Run the Schema

1. Open the Supabase SQL Editor:
   https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/sql

2. Paste the contents of `supabase/schema.sql` and click **Run**.

   This creates:
   - `visits` table (with RLS policies)
   - `future_spots` table (with RLS policies)
   - `settings` table (public read)

3. Verify the tables appeared under **Table Editor** in the Supabase dashboard.

---

## Step 2 — Create the Seed User

The seed user is a special Supabase Auth account whose `visits` rows are the editorial "Top Date Spots" shown to all new users. Its `user_id` is what links all seed data rows.

### Create via Supabase Dashboard

1. Go to **Authentication → Users**:
   https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/auth/users

2. Click **Add user → Create new user**

3. Fill in:
   - **Email:** `seed@datespot.app`
   - **Password:** (set a strong password — you won't use this to log in, just to own the rows)
   - **Auto confirm user:** ✅ checked

4. Click **Create user**.

5. Copy the **User UID** shown in the users list — it looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. You'll need it in Step 3.

---

## Step 3 — Insert Seed Spots

Once you have the AI-generated seed JSON (see the Seed Data Spec in the design doc), insert it using one of these two methods.

### Method A — Supabase SQL Editor (easiest)

For each spot in your JSON, run an INSERT. Template:

```sql
insert into public.visits (
  id, user_id, venue_name, lat, lng, visited_at,
  rating, rank_order, notes, activity_type, price,
  triage, is_seed, created_at
) values (
  'seed_001',
  'PASTE_SEED_USER_UID_HERE',  -- the UID from Step 2
  'Pittock Mansion',
  45.5267,
  -122.7163,
  '2000-01-01T00:00:00Z',      -- sentinel date; never shown to users
  7.0,
  1.0,
  'Historic mansion with sweeping Portland views. Great for a scenic first date walk.',
  'view',
  1,
  'great',
  true,
  now()
);
```

**Activity type values** (must match exactly):
| Use this     | Meaning            |
|--------------|--------------------|
| `food`       | Restaurants, cafes |
| `drinks`     | Bars, cocktail spots |
| `outdoors`   | Hikes, parks, waterfronts |
| `view`       | Scenic overlooks, rooftops |
| `entertainment` | Museums, bowling, experiences |
| `other`      | Coffee shops, misc |

**Price values:**
| Value | Label |
|-------|-------|
| `0`   | Free  |
| `1`   | $     |
| `2`   | $$    |
| `3`   | $$$   |

**Triage values** (controls which rating band the spot appears in):
| Value   | Rating range |
|---------|-------------|
| `great` | 7.0 – 10.0  |
| `okay`  | 4.0 – 6.9   |
| `bad`   | 2.0 – 3.9   |

Use `great` for top-tier spots (rating 7.0+) and `okay` for solid spots (rating 5.0).

### Method B — Bulk insert from JSON

If you have the full seed JSON array, use the Supabase JavaScript client in a one-off script:

```javascript
// run with: node seed.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qlqcuuxhzdozjfboxeud.supabase.co',
  'sb_publishable__GRM0RXlTPJ7yWFOV4UAeA_9ddKu_Rr'
);

const SEED_USER_ID = 'PASTE_SEED_USER_UID_HERE';

const spots = [
  // paste your AI-generated JSON array here
  {
    id: 'seed_001',
    venue_name: 'Pittock Mansion',
    lat: 45.5267,
    lng: -122.7163,
    activity_type: 'view',
    price: 1,
    rating: 7.0,
    rank_order: 1.0,
    notes: 'Historic mansion with sweeping Portland views.',
    triage: 'great',
  },
  // ... more spots
];

async function insertSeeds() {
  const rows = spots.map((s) => ({
    ...s,
    user_id: SEED_USER_ID,
    visited_at: '2000-01-01T00:00:00Z',
    is_seed: true,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('visits').insert(rows);
  if (error) {
    console.error('Insert failed:', error.message);
  } else {
    console.log(`Inserted ${rows.length} seed spots.`);
  }
}

insertSeeds();
```

---

## Step 4 — Mark Seed Version

After all spots are inserted, run this to mark seeding complete (prevents re-seeding):

```sql
insert into public.settings (key, value)
values ('seed_version', '1')
on conflict (key) do update set value = '1';
```

---

## Step 5 — Verify

Run this query to confirm the seed spots are in:

```sql
select id, venue_name, activity_type, price, rating, triage
from public.visits
where is_seed = true
order by activity_type, rank_order desc;
```

You should see 50–70 rows grouped by category.

---

## Step 6 — Set up the Photos Bucket (if not already done)

1. Go to **Storage** in the Supabase dashboard:
   https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/storage/buckets

2. If the `photos` bucket doesn't exist, click **New bucket**:
   - Name: `photos`
   - Public bucket: ✅ checked

3. The app's `lib/storage.ts` uploads to this bucket automatically — no code changes needed.

---

## How the App Reads Seed Data

The app fetches seed spots using the anon key (no auth required), because the RLS policy
`"read seed spots"` allows public read of all rows where `is_seed = true`.

In `lib/visits.ts`, when you extend `getVisitsFiltered()` to support `isSeed`, the
Supabase query will look like:

```typescript
const { data } = await supabase
  .from('visits')
  .select('*')
  .eq('is_seed', true)
  .order('rank_order', { ascending: false });
```

Real user visits are fetched the same way, but filtered by `user_id = auth.uid()`.

---

## Summary

| Step | What you do |
|------|-------------|
| 1    | Run `schema.sql` in Supabase SQL Editor |
| 2    | Create `seed@datespot.app` user in Auth |
| 3    | Insert 50–70 seed spots with that user's UID |
| 4    | Run `INSERT INTO settings` to mark seed_version = 1 |
| 5    | Verify rows in Table Editor |
| 6    | Confirm `photos` bucket exists in Storage |
