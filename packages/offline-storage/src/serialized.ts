import type { SqlDriver, SqlExecutor, SqlValue } from './driver';

/**
 * Turns a single raw connection into a `SqlDriver` whose transactions are exclusive.
 * Every call goes through one queue, so an awaiting transaction can never interleave
 * with other statements on the same connection.
 *
 * We deliberately do not use expo-sqlite's `withExclusiveTransactionAsync`: it opens a
 * second connection per transaction, and connection-scoped pragmas such as
 * `foreign_keys = ON` (required for ON DELETE CASCADE) would not apply there.
 */
export function createSerializedDriver(conn: SqlExecutor, close: () => Promise<void>): SqlDriver {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    exec: (sql) => exclusive(() => conn.exec(sql)),
    run: (sql, params) => exclusive(() => conn.run(sql, params)),
    all: <T>(sql: string, params?: readonly SqlValue[]) =>
      exclusive(() => conn.all<T>(sql, params)),
    first: <T>(sql: string, params?: readonly SqlValue[]) =>
      exclusive(() => conn.first<T>(sql, params)),
    transaction: (fn) =>
      exclusive(async () => {
        await conn.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(conn);
          await conn.exec('COMMIT');
          return result;
        } catch (e) {
          try {
            await conn.exec('ROLLBACK');
          } catch {
            // SQLite may already have rolled back; keep the original error.
          }
          throw e;
        }
      }),
    close: () => exclusive(close),
  };
}
