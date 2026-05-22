import { getDb } from './db';

export function isActivityLiked(visitId: string): boolean {
  return !!getDb().getFirstSync('SELECT 1 FROM friend_activity_likes WHERE visit_id = ?', [visitId]);
}

export function likeActivity(visitId: string): void {
  getDb().runSync(
    'INSERT OR IGNORE INTO friend_activity_likes (visit_id) VALUES (?)',
    [visitId]
  );
}

export function unlikeActivity(visitId: string): void {
  getDb().runSync('DELETE FROM friend_activity_likes WHERE visit_id = ?', [visitId]);
}
