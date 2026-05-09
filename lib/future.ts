import { getDb } from './db';

export interface FutureSpot {
  id: string;
  venue_name: string;
  lat: number;
  lng: number;
  notes?: string;
  created_at: string;
}

export function getAllFutureSpots(): FutureSpot[] {
  return getDb().getAllSync<FutureSpot>(
    'SELECT * FROM future_spots ORDER BY created_at DESC'
  );
}

export function insertFutureSpot(spot: FutureSpot): void {
  getDb().runSync(
    'INSERT INTO future_spots (id, venue_name, lat, lng, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [spot.id, spot.venue_name, spot.lat, spot.lng, spot.notes ?? null, spot.created_at]
  );
}

export function deleteFutureSpot(id: string): void {
  getDb().runSync('DELETE FROM future_spots WHERE id = ?', [id]);
}
