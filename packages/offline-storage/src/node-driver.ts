import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlExecutor, SqlValue } from './driver';

/**
 * node:sqlite driver for tests and tooling (Node ≥ 22.13). Statements are serialized through
 * a lock so an awaiting transaction cannot interleave with other callers, matching the
 * exclusivity of expo-sqlite's `withExclusiveTransactionAsync`.
 */
export function openNodeSqlite(path = ':memory:'): SqlDriver {
  const db = new DatabaseSync(path);
  let lock: Promise<unknown> = Promise.resolve();

  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const next = lock.then(fn, fn);
    lock = next.catch(() => undefined);
    return next;
  };

  const direct: SqlExecutor = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      const r = db.prepare(sql).run(...(params as SqlValue[]));
      return { changes: Number(r.changes) };
    },
    all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      db.prepare(sql).all(...(params as SqlValue[])) as T[],
    first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      (db.prepare(sql).get(...(params as SqlValue[])) as T | undefined) ?? null,
  };

  return {
    exec: (sql) => exclusive(() => direct.exec(sql)),
    run: (sql, params) => exclusive(() => direct.run(sql, params)),
    all: <T>(sql: string, params?: readonly SqlValue[]) =>
      exclusive(() => direct.all<T>(sql, params)),
    first: <T>(sql: string, params?: readonly SqlValue[]) =>
      exclusive(() => direct.first<T>(sql, params)),
    transaction: (fn) =>
      exclusive(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(direct);
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      }),
    close: () => exclusive(() => db.close()),
  };
}
