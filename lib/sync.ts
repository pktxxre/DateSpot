import { supabase } from './supabase';
import { getDb } from './db';
import { recomputeRatings } from './visits';
import { recomputeStackRatings } from './stacks';
import type { UserProfile } from './profile';

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export async function syncVisitToCloud(visitId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  const row = db.getFirstSync<any>('SELECT * FROM visits WHERE id = ?', [visitId]);
  if (!row) return;
  const { error } = await supabase.from('visits').upsert({
    id: row.id,
    user_id: userId,
    venue_name: row.venue_name,
    lat: row.lat,
    lng: row.lng,
    visited_at: row.visited_at,
    rating: row.rating,
    rank_order: row.rank_order,
    notes: row.notes,
    activity_type: row.activity_type,
    occasion_type: row.occasion_type ?? 'romantic',
    price: row.price,
    triage: row.triage,
    date_type: row.date_type,
    photos: row.photos ?? '[]',
    address: row.address,
    canonical_place_id: row.canonical_place_id,
    canonical_name: row.canonical_name,
    canonical_lat: row.canonical_lat,
    canonical_lng: row.canonical_lng,
    resolution_status: row.resolution_status ?? 'pending',
    is_seed: false,
    created_at: row.created_at,
  });
  if (error) console.warn('[sync] visit upsert:', error.message);
}

export async function deleteVisitFromCloud(visitId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('visits').delete().eq('id', visitId);
  if (error) console.warn('[sync] visit delete:', error.message);
}

// ─── Future Spots ─────────────────────────────────────────────────────────────

export async function syncFutureSpotToCloud(spotId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  const row = db.getFirstSync<any>('SELECT * FROM future_spots WHERE id = ?', [spotId]);
  if (!row) return;
  const { error } = await supabase.from('future_spots').upsert({
    id: row.id,
    user_id: userId,
    venue_name: row.venue_name,
    lat: row.lat,
    lng: row.lng,
    notes: row.notes,
    created_at: row.created_at,
    canonical_place_id: row.canonical_place_id ?? null,
    canonical_name: row.canonical_name ?? null,
    canonical_lat: row.canonical_lat ?? null,
    canonical_lng: row.canonical_lng ?? null,
    resolution_status: row.resolution_status ?? 'pending',
    address: row.address ?? null,
    activity_type: row.activity_type ?? null,
    occasion_type: row.occasion_type ?? null,
  });
  if (error) console.warn('[sync] future_spot upsert:', error.message);
}

export async function deleteFutureSpotFromCloud(spotId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('future_spots').delete().eq('id', spotId);
  if (error) console.warn('[sync] future_spot delete:', error.message);
}

// ─── Stacks ───────────────────────────────────────────────────────────────────

export async function syncStackToCloud(stackId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const db = getDb();
  const stack = db.getFirstSync<any>('SELECT * FROM stacks WHERE id = ?', [stackId]);
  if (!stack) return;
  const visitRows = db.getAllSync<{ visit_id: string; position: number }>(
    'SELECT visit_id, position FROM stack_visits WHERE stack_id = ? ORDER BY position ASC',
    [stackId]
  );

  const { error: stackError } = await supabase.from('stacks').upsert({
    id: stack.id,
    user_id: userId,
    name: stack.name,
    rating: stack.rating,
    rank_order: stack.rank_order,
    tier: stack.tier ?? null,
    tier_note: stack.tier_note ?? null,
    cover_photo: stack.cover_photo ?? null,
    created_at: stack.created_at,
  });
  if (stackError) { console.warn('[sync] stack upsert:', stackError.message); return; }

  // Replace stack_visits: delete then re-insert
  await supabase.from('stack_visits').delete().eq('stack_id', stackId);
  if (visitRows.length > 0) {
    const { error: svError } = await supabase.from('stack_visits').insert(
      visitRows.map(r => ({ stack_id: stackId, visit_id: r.visit_id, position: r.position }))
    );
    if (svError) console.warn('[sync] stack_visits insert:', svError.message);
  }
}

export async function deleteStackFromCloud(stackId: string): Promise<void> {
  if (!supabase) return;
  // stack_visits cascade-delete via FK
  const { error } = await supabase.from('stacks').delete().eq('id', stackId);
  if (error) console.warn('[sync] stack delete:', error.message);
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    username: profile.username,
    handle: profile.handle,
    bio: profile.bio,
    profile_photo_uri: profile.profilePhotoUri,
    avatar_emoticon: profile.avatarEmoticon,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    city_lat: profile.cityLat,
    city_lng: profile.cityLng,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('[sync] profile upsert:', error.message);
}

// ─── Restore on Login ─────────────────────────────────────────────────────────

export async function restoreFromCloud(userId: string): Promise<void> {
  if (!supabase) return;
  const db = getDb();

  // Only restore if the user has no local data yet
  const existing = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM visits WHERE is_seed = 0'
  );
  if ((existing?.n ?? 0) > 0) return;

  // Restore profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('[sync] restore profile:', profileError.message);
  } else if (profileData) {
    const { saveProfile } = await import('./profile');
    await saveProfile({
      username: profileData.username ?? '',
      handle: profileData.handle ?? '',
      bio: profileData.bio ?? '',
      profilePhotoUri: profileData.profile_photo_uri ?? null,
      avatarEmoticon: profileData.avatar_emoticon ?? '',
      email: profileData.email ?? '',
      phone: profileData.phone ?? '',
      city: profileData.city ?? '',
      cityLat: profileData.city_lat ?? null,
      cityLng: profileData.city_lng ?? null,
    });
  }

  const [visitsRes, futureRes, stacksRes] = await Promise.all([
    supabase.from('visits').select('*').eq('user_id', userId).eq('is_seed', false),
    supabase.from('future_spots').select('*').eq('user_id', userId),
    supabase.from('stacks').select('*').eq('user_id', userId),
  ]);

  if (visitsRes.error) console.warn('[sync] restore visits:', visitsRes.error.message);
  if (futureRes.error) console.warn('[sync] restore future_spots:', futureRes.error.message);
  if (stacksRes.error) console.warn('[sync] restore stacks:', stacksRes.error.message);

  const stackIds = (stacksRes.data ?? []).map((s: any) => s.id);
  let stackVisits: any[] = [];
  if (stackIds.length > 0) {
    const { data, error } = await supabase
      .from('stack_visits')
      .select('*')
      .in('stack_id', stackIds);
    if (error) console.warn('[sync] restore stack_visits:', error.message);
    else stackVisits = data ?? [];
  }

  db.withTransactionSync(() => {
    for (const v of visitsRes.data ?? []) {
      db.runSync(
        `INSERT OR IGNORE INTO visits (
          id, venue_name, lat, lng, address, visited_at, rating, rank_order, notes,
          activity_type, occasion_type, price, triage, date_type, photos,
          canonical_place_id, canonical_name, canonical_lat, canonical_lng,
          resolution_status, is_seed, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          v.id, v.venue_name, v.lat, v.lng, v.address ?? null,
          v.visited_at, v.rating ?? 0, v.rank_order ?? 0, v.notes ?? null,
          v.activity_type, v.occasion_type ?? 'romantic', v.price, v.triage,
          v.date_type ?? null, v.photos ?? '[]',
          v.canonical_place_id ?? null, v.canonical_name ?? null,
          v.canonical_lat ?? null, v.canonical_lng ?? null,
          v.resolution_status ?? 'pending', 0, v.created_at,
        ]
      );
    }

    for (const s of futureRes.data ?? []) {
      db.runSync(
        `INSERT OR IGNORE INTO future_spots (
          id, venue_name, lat, lng, notes, created_at,
          canonical_place_id, canonical_name, canonical_lat, canonical_lng, resolution_status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.id, s.venue_name, s.lat, s.lng, s.notes ?? null, s.created_at,
          s.canonical_place_id ?? null, s.canonical_name ?? null,
          s.canonical_lat ?? null, s.canonical_lng ?? null,
          s.resolution_status ?? 'pending',
        ]
      );
    }

    for (const s of stacksRes.data ?? []) {
      db.runSync(
        `INSERT OR IGNORE INTO stacks (id, name, rating, rank_order, created_at, tier, tier_note, cover_photo)
         VALUES (?,?,?,?,?,?,?,?)`,
        [s.id, s.name, s.rating ?? 0, s.rank_order ?? 0, s.created_at,
         s.tier ?? null, s.tier_note ?? null, s.cover_photo ?? null]
      );
    }

    for (const sv of stackVisits) {
      db.runSync(
        `INSERT OR IGNORE INTO stack_visits (stack_id, visit_id, position) VALUES (?,?,?)`,
        [sv.stack_id, sv.visit_id, sv.position]
      );
    }
  });

  recomputeRatings();
  recomputeStackRatings();
}
