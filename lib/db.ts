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
      price         INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS future_spots (
      id         TEXT PRIMARY KEY,
      venue_name TEXT NOT NULL,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stacks (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      rating     REAL NOT NULL DEFAULT 0,
      rank_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stack_visits (
      stack_id   TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
      visit_id   TEXT NOT NULL REFERENCES visits(id),
      position   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (stack_id, visit_id)
    );

    CREATE TABLE IF NOT EXISTS friend_activity_likes (
      visit_id TEXT PRIMARY KEY
    );
  `);

  // Migrate stacks table
  const stackCols = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(stacks)`
  ).map((r) => r.name);

  if (!stackCols.includes('tier')) {
    db.runSync(`ALTER TABLE stacks ADD COLUMN tier TEXT`);
  }
  if (!stackCols.includes('tier_note')) {
    db.runSync(`ALTER TABLE stacks ADD COLUMN tier_note TEXT`);
  }
  if (!stackCols.includes('cover_photo')) {
    db.runSync(`ALTER TABLE stacks ADD COLUMN cover_photo TEXT`);
  }

  // Migrate existing installs that are missing columns (wrapped in a transaction so a
  // mid-migration crash doesn't leave the schema partially applied)
  db.withTransactionSync(() => {
  const cols = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(visits)`
  ).map((r) => r.name);

  if (!cols.includes('activity_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'other'`);
  }
  if (!cols.includes('price')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN price INTEGER NOT NULL DEFAULT 2`);
  }
  if (!cols.includes('photos')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN photos TEXT`);
  }
  if (!cols.includes('triage')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN triage TEXT NOT NULL DEFAULT 'okay'`);
  }
  if (!cols.includes('date_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN date_type TEXT`);
  }
  if (!cols.includes('is_seed')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN is_seed INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.includes('canonical_place_id')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_place_id TEXT`);
  }
  if (!cols.includes('canonical_name')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_name TEXT`);
  }
  if (!cols.includes('canonical_lat')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_lat REAL`);
  }
  if (!cols.includes('canonical_lng')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN canonical_lng REAL`);
  }
  if (!cols.includes('resolution_status')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN resolution_status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!cols.includes('address')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN address TEXT`);
  }

  // Add occasion_type column (Romantic / Friend / Solo ranking dimension)
  if (!cols.includes('occasion_type')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN occasion_type TEXT`);
    // Rescue any visits whose activity_type was previously overwritten with an occasion value
    db.runSync(`UPDATE visits SET occasion_type = activity_type WHERE activity_type IN ('romantic', 'friend', 'solo')`);
    db.runSync(`UPDATE visits SET activity_type = 'other' WHERE activity_type IN ('romantic', 'friend', 'solo')`);
    // Default remaining visits to 'romantic'
    db.runSync(`UPDATE visits SET occasion_type = 'romantic' WHERE occasion_type IS NULL`);
  }
  if (!cols.includes('occasion_label')) {
    db.runSync(`ALTER TABLE visits ADD COLUMN occasion_label TEXT`);
  }

  // Rename legacy 'drinks' activity_type → 'bars' (idempotent)
  db.runSync(`UPDATE visits SET activity_type = 'bars' WHERE activity_type = 'drinks'`);

  // Migrate future_spots canonical columns
  const futureColNames = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(future_spots)`
  ).map((r) => r.name);

  if (!futureColNames.includes('canonical_place_id')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_place_id TEXT`);
  }
  if (!futureColNames.includes('canonical_name')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_name TEXT`);
  }
  if (!futureColNames.includes('canonical_lat')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_lat REAL`);
  }
  if (!futureColNames.includes('canonical_lng')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN canonical_lng REAL`);
  }
  if (!futureColNames.includes('resolution_status')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN resolution_status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!futureColNames.includes('occasion_type')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN occasion_type TEXT`);
  }
  if (!futureColNames.includes('activity_type')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN activity_type TEXT`);
  }
  if (!futureColNames.includes('address')) {
    db.runSync(`ALTER TABLE future_spots ADD COLUMN address TEXT`);
  }
  }); // end withTransactionSync

  // Repair broken stack_visits schema: SQLite 3.26+ rewrites FK references on rename,
  // so stack_visits may still point at visits_pre_nullable_price(id) if this migration
  // ran without legacy_alter_table. Recreate stack_visits with the correct reference.
  const stackVisitsFkTarget = db.getAllSync<{ table: string }>(
    `PRAGMA foreign_key_list(stack_visits)`
  ).find(r => r.table === 'visits_pre_nullable_price');
  if (stackVisitsFkTarget) {
    db.runSync(`PRAGMA foreign_keys = OFF`);
    db.runSync(`PRAGMA legacy_alter_table = ON`);
    db.runSync(`ALTER TABLE stack_visits RENAME TO stack_visits_fk_broken`);
    db.runSync(`CREATE TABLE stack_visits (
      stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
      visit_id TEXT NOT NULL REFERENCES visits(id),
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (stack_id, visit_id)
    )`);
    db.runSync(`INSERT INTO stack_visits SELECT * FROM stack_visits_fk_broken`);
    db.runSync(`DROP TABLE stack_visits_fk_broken`);
    db.runSync(`PRAGMA legacy_alter_table = OFF`);
    db.runSync(`PRAGMA foreign_keys = ON`);
  }

  // Migrate existing installs: make price column nullable (SQLite requires table recreation)
  const priceColInfo = db.getAllSync<any>(`PRAGMA table_info(visits)`)
    .find((c: any) => c.name === 'price');
  if (priceColInfo?.notnull === 1) {
    db.runSync(`PRAGMA foreign_keys = OFF`);
    // Prevent SQLite 3.26+ from rewriting foreign key references in stack_visits
    // when we rename visits. Without this, stack_visits ends up referencing
    // visits_pre_nullable_price(id) which no longer exists after the migration,
    // causing "no such table" errors on every subsequent delete.
    db.runSync(`PRAGMA legacy_alter_table = ON`);
    db.runSync(`ALTER TABLE visits RENAME TO visits_pre_nullable_price`);
    db.runSync(`CREATE TABLE visits (
      id TEXT PRIMARY KEY,
      venue_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      visited_at TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 0,
      rank_order REAL NOT NULL DEFAULT 0,
      notes TEXT,
      activity_type TEXT NOT NULL DEFAULT 'other',
      price INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      photos TEXT,
      triage TEXT NOT NULL DEFAULT 'okay',
      date_type TEXT,
      is_seed INTEGER NOT NULL DEFAULT 0,
      canonical_place_id TEXT,
      canonical_name TEXT,
      canonical_lat REAL,
      canonical_lng REAL,
      resolution_status TEXT NOT NULL DEFAULT 'pending',
      address TEXT,
      occasion_type TEXT,
      occasion_label TEXT
    )`);
    db.runSync(`INSERT INTO visits SELECT
      id, venue_name, lat, lng, visited_at, rating, rank_order, notes,
      activity_type, price, created_at, photos, triage, date_type, is_seed,
      canonical_place_id, canonical_name, canonical_lat, canonical_lng,
      resolution_status, address, occasion_type, occasion_label
    FROM visits_pre_nullable_price`);
    db.runSync(`DROP TABLE visits_pre_nullable_price`);
    db.runSync(`PRAGMA legacy_alter_table = OFF`);
    db.runSync(`PRAGMA foreign_keys = ON`);
  }
}

export async function clearUserData(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    DELETE FROM stack_visits;
    DELETE FROM stacks;
    DELETE FROM visits;
    DELETE FROM future_spots;
  `);
}
