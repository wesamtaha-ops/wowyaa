import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlValue } from './driver';
import { createSerializedDriver } from './serialized';

/** node:sqlite driver for tests and tooling (Node ≥ 22.13). Same semantics as the app driver. */
export function openNodeSqlite(path = ':memory:'): SqlDriver {
  const db = new DatabaseSync(path);
  return createSerializedDriver(
    {
      exec: async (sql) => {
        db.exec(sql);
      },
      run: async (sql, params = []) => ({
        changes: Number(db.prepare(sql).run(...(params as SqlValue[])).changes),
      }),
      all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
        db.prepare(sql).all(...(params as SqlValue[])) as T[],
      first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
        (db.prepare(sql).get(...(params as SqlValue[])) as T | undefined) ?? null,
    },
    async () => db.close(),
  );
}
