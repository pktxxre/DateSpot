import * as SQLite from 'expo-sqlite';

const DB_NAME = 'datespot.db';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
  }
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS visits (
      id            TEXT PRIMARY KEY,
      venue_name    TEXT NOT NULL,
      lat           REAL NOT NULL,
      lng           REAL NOT NULL,
      visited_at    TEXT NOT NULL,
      rating        INTEGER NOT NULL DEFAULT 0,
      rank_order    REAL NOT NULL DEFAULT 0,
      notes         TEXT,
      activity_type TEXT NOT NULL DEFAULT 'other',
      price         INTEGER NOT NULL DEFAULT 2,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing installs that are missing the new columns
  const cols = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(visits)`
  ).map((r) => r.name);

  if (!cols.includes('activity_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'other'`);
  }
  if (!cols.includes('price')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN price INTEGER NOT NULL DEFAULT 2`);
  }
}
