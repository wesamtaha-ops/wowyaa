import * as SQLite from 'expo-sqlite';
import { createSerializedDriver, type SqlDriver, type SqlValue } from '@huroofi/offline-storage';

/** Opens the on-device database. One connection, serialized; see `createSerializedDriver`. */
export async function openExpoSqlite(name = 'huroofi.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  // WAL is verified per platform in the device suite (plan §7); fall back silently if refused.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const bind = (params: readonly SqlValue[] = []) => [...params];
  return createSerializedDriver(
    {
      exec: (sql) => db.execAsync(sql),
      run: async (sql, params) => ({ changes: (await db.runAsync(sql, bind(params))).changes }),
      all: <T>(sql: string, params?: readonly SqlValue[]) => db.getAllAsync<T>(sql, bind(params)),
      first: async <T>(sql: string, params?: readonly SqlValue[]) =>
        (await db.getFirstAsync<T>(sql, bind(params))) ?? null,
    },
    () => db.closeAsync(),
  );
}
