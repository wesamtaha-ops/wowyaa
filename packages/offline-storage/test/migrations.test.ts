import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MIGRATIONS,
  migrate,
  MigrationError,
  SqliteProgressRepository,
  type Migration,
} from '../src';
import { openNodeSqlite } from '../src/node-driver';
import { attempt, CHECKSUM, deps } from './helpers';

const dirs: string[] = [];
const tempDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'huroofi-db-'));
  dirs.push(dir);
  return join(dir, 'huroofi.db');
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const tables = async (db: ReturnType<typeof openNodeSqlite>) =>
  (
    await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
  ).map((r) => r.name);

describe('migrations', () => {
  it('fresh install creates the full P0 schema with foreign keys on', async () => {
    const db = openNodeSqlite();
    expect(await migrate(db)).toEqual({ from: 0, to: 1, applied: [1] });
    expect(await tables(db)).toEqual([
      'activity_attempts',
      'child_profiles',
      'content_packs',
      'device_settings',
      'learning_sessions',
      'parent_settings',
      'schema_migrations',
      'skill_evidence',
      'skill_mastery',
    ]);
    expect(await db.first<{ foreign_keys: number }>('PRAGMA foreign_keys')).toEqual({
      foreign_keys: 1,
    });
  });

  it('is a no-op when already current', async () => {
    const db = openNodeSqlite();
    await migrate(db);
    expect(await migrate(db)).toEqual({ from: 1, to: 1, applied: [] });
  });

  it('upgrades N→N+1 preserving existing learner data', async () => {
    const path = tempDb();
    const v1 = openNodeSqlite(path);
    await migrate(v1);
    const repo1 = new SqliteProgressRepository(deps(v1));
    await repo1.activateContentPack({
      packId: 'p',
      version: '1.0.0',
      schemaVersion: 1,
      checksumSha256: CHECKSUM,
    });
    const child = await repo1.createChild({ displayName: 'ليلى', ageBand: '4-6' });
    const session = await repo1.startSession(child, 1);
    await repo1.recordAttempt(attempt(child, session, 'att-1'));
    await v1.close();

    const v2: Migration = {
      version: 2,
      name: 'add_child_locale',
      up: "ALTER TABLE child_profiles ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'ar';",
    };
    const db = openNodeSqlite(path);
    expect(await migrate(db, [...MIGRATIONS, v2])).toEqual({ from: 1, to: 2, applied: [2] });
    const repo2 = new SqliteProgressRepository(deps(db));
    expect((await repo2.listChildren())[0]?.displayName).toBe('ليلى');
    expect(await repo2.getMastery(child)).toHaveLength(2);
    expect(await db.first('SELECT preferred_locale FROM child_profiles')).toEqual({
      preferred_locale: 'ar',
    });
    await db.close();
  });

  it('rolls back an aborted upgrade completely and stays on the previous version', async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const broken: Migration = {
      version: 2,
      name: 'broken',
      up: 'CREATE TABLE half_done (x INTEGER); INSERT INTO no_such_table VALUES (1);',
    };
    await expect(migrate(db, [...MIGRATIONS, broken])).rejects.toBeInstanceOf(MigrationError);
    expect(await tables(db)).not.toContain('half_done');
    expect(await db.first('SELECT MAX(version) AS v FROM schema_migrations')).toEqual({ v: 1 });
  });

  it('refuses to run an older build against a newer database', async () => {
    const db = openNodeSqlite();
    await migrate(db);
    await db.run('INSERT INTO schema_migrations VALUES (99, 0)');
    await expect(migrate(db)).rejects.toThrow(/refusing to downgrade/);
  });

  it('rejects non-contiguous migration lists', async () => {
    await expect(migrate(openNodeSqlite(), [{ version: 2, name: 'x', up: '' }])).rejects.toThrow(
      /contiguous/,
    );
  });
});
