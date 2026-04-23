# DateSpot

Map-first date journal. Log where you've been, how it felt, and share your map.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in:
- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL editor:
   `supabase/migrations/20260422000001_initial_schema.sql`
3. Enable Apple and Google providers in Authentication → Providers

### 4. Install EAS CLI and configure

```bash
npm install -g eas-cli
eas login
eas init
```

Replace `YOUR_EAS_PROJECT_ID` in `app.json` with the ID from `eas init`.

### 5. Run the app

```bash
# Build the dev client once
eas build --profile development --platform ios

# Then start the dev server
npx expo start --dev-client
```

---

## Project Structure

```
app/
  _layout.tsx          # Root layout: auth check, QueryClient, Mapbox init
  (tabs)/
    _layout.tsx        # Tab bar (Map / Log / Profile)
    index.tsx          # Map tab — home screen
    log.tsx            # Log tab — 4-step log flow (Phase 2)
    profile.tsx        # Profile tab (Phase 5)
  auth/
    index.tsx          # Sign-in: Apple, Google, email/password
  +not-found.tsx
lib/
  supabase.ts          # Supabase client (AsyncStorage session)
  mapbox.ts            # Mapbox init (call once at app start)
constants/
  colors.ts            # Brand colors + ratingColor() helper
  types.ts             # TypeScript types matching the DB schema
supabase/
  migrations/          # SQL to run in Supabase dashboard
assets/
  images/              # App icon, adaptive icon, splash (add yours)
```

---

## Build Phases

See [PLAN.md](./PLAN.md) for the full phased build plan.

| Phase | What | Status |
|-------|------|--------|
| 0 | Scaffold — Expo + Supabase + auth + blank Mapbox map | ✅ This PR |
| 1 | Map home — colored pins, clustering, filter bar | pending |
| 2 | Log flow — 4-step sheet | pending |
| 3 | Pin detail + edit/delete | pending |
| 4 | "I'm on a date" nudge + log reminder | pending |
| 5 | Profile + share sheet | pending |
| 6 | Auth polish + first launch | pending |
| 7 | EAS Build + Submit | pending |
