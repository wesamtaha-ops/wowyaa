import type { SqlDriver } from './driver';

export interface Migration {
  version: number;
  name: string;
  /** Executed inside a transaction together with the schema_migrations insert. */
  up: string;
}

/**
 * Append-only. Never edit a shipped migration; add a new version instead (plan §7: avoid
 * schema reset after upgrades). `schema_migrations` itself is bootstrapped by the runner.
 */
export const MIGRATIONS: readonly Migration[] = Object.freeze([
  {
    version: 1,
    name: 'initial_p0_schema',
    up: `
CREATE TABLE child_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK(age_band IN ('4-6','7-9')),
  avatar_id TEXT NOT NULL DEFAULT 'faseeh_default',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE TABLE content_packs (
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  installed_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  PRIMARY KEY(pack_id, version)
);
CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  content_pack_id TEXT NOT NULL,
  content_version TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  random_seed INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','complete','abandoned'))
);
CREATE INDEX idx_sessions_child_started ON learning_sessions(child_id, started_at_ms DESC);
CREATE TABLE activity_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_version INTEGER NOT NULL,
  input_source TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('correct','incorrect','indeterminate')),
  hints_used INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER,
  error_codes_json TEXT NOT NULL DEFAULT '[]',
  completed_at_ms INTEGER NOT NULL,
  content_version TEXT NOT NULL
);
CREATE INDEX idx_attempts_child_time ON activity_attempts(child_id, completed_at_ms DESC);
CREATE INDEX idx_attempts_session ON activity_attempts(session_id);
CREATE TABLE skill_mastery (
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  mastery REAL NOT NULL CHECK(mastery >= 0 AND mastery <= 1),
  exposures INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  last_practiced_at_ms INTEGER,
  next_review_at_ms INTEGER,
  algorithm_version TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(child_id, skill_id)
);
CREATE TABLE skill_evidence (
  attempt_id TEXT NOT NULL REFERENCES activity_attempts(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  hints_used INTEGER NOT NULL,
  PRIMARY KEY(attempt_id, skill_id)
);
CREATE TABLE parent_settings (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  daily_play_limit_min INTEGER NOT NULL DEFAULT 20,
  audio_enabled INTEGER NOT NULL DEFAULT 1,
  reduced_motion INTEGER NOT NULL DEFAULT 0,
  optional_data_collection INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE device_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);`,
  },
]);

export class MigrationError extends Error {
  constructor(
    message: string,
    readonly version: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
}

/**
 * Applies pending migrations, each in its own transaction. A failing migration rolls back
 * completely and leaves the database at the previous version.
 */
export async function migrate(
  db: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
  now: () => number = Date.now,
): Promise<MigrationResult> {
  assertOrdered(migrations);
  // Must run outside a transaction: SQLite ignores this pragma inside one.
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at_ms INTEGER NOT NULL);',
  );
  const row = await db.first<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_migrations',
  );
  const from = row?.v ?? 0;
  const latest = migrations[migrations.length - 1]?.version ?? 0;
  if (from > latest) {
    throw new MigrationError(
      `database is at schema v${from} but this build only knows v${latest}; refusing to downgrade`,
      from,
    );
  }
  const applied: number[] = [];
  for (const m of migrations) {
    if (m.version <= from) continue;
    try {
      await db.transaction(async (tx) => {
        await tx.exec(m.up);
        await tx.run('INSERT INTO schema_migrations (version, applied_at_ms) VALUES (?, ?)', [
          m.version,
          now(),
        ]);
      });
    } catch (e) {
      throw new MigrationError(
        `migration v${m.version} (${m.name}) failed and was rolled back`,
        m.version,
        e,
      );
    }
    applied.push(m.version);
  }
  return { from, to: applied[applied.length - 1] ?? from, applied };
}

function assertOrdered(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1)
      throw new Error(`migrations must be contiguous from 1; got v${m.version} at index ${i}`);
  });
}
