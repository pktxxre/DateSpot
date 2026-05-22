import { getDb } from './db';
import { syncFutureSpotToCloud, deleteFutureSpotFromCloud } from './sync';

export interface FutureSpot {
  id: string;
  venue_name: string;
  lat: number;
  lng: number;
  notes?: string;
  created_at: string;
  occasion_type?: string | null;
  activity_type?: string | null;
}

export function getAllFutureSpots(): FutureSpot[] {
  return getDb().getAllSync<FutureSpot>(
    'SELECT * FROM future_spots ORDER BY created_at DESC'
  );
}

export function insertFutureSpot(spot: FutureSpot): void {
  getDb().runSync(
    'INSERT INTO future_spots (id, venue_name, lat, lng, notes, created_at, occasion_type, activity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [spot.id, spot.venue_name, spot.lat, spot.lng, spot.notes ?? null, spot.created_at, spot.occasion_type ?? null, spot.activity_type ?? null]
  );
  syncFutureSpotToCloud(spot.id);
}

export function deleteFutureSpot(id: string): void {
  getDb().runSync('DELETE FROM future_spots WHERE id = ?', [id]);
  deleteFutureSpotFromCloud(id);
}

export function deleteFutureSpotsByVenueName(venueName: string): void {
  const key = venueName.toLowerCase().trim();
  const rows = getDb().getAllSync<{ id: string }>(
    'SELECT id FROM future_spots WHERE LOWER(TRIM(venue_name)) = ?', [key]
  );
  for (const row of rows) {
    getDb().runSync('DELETE FROM future_spots WHERE id = ?', [row.id]);
    deleteFutureSpotFromCloud(row.id);
  }
}

export function updateFutureSpot(id: string, venue_name: string): void {
  getDb().runSync('UPDATE future_spots SET venue_name = ? WHERE id = ?', [venue_name, id]);
  syncFutureSpotToCloud(id);
}

export function getFutureSpotById(id: string): FutureSpot | null {
  return getDb().getFirstSync<FutureSpot>('SELECT * FROM future_spots WHERE id = ?', [id]) ?? null;
}
