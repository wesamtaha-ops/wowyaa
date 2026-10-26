/**
 * Minimal async SQL surface the repository needs. Implemented by an expo-sqlite adapter in
 * the app and by a node:sqlite adapter for tests/tooling, so persistence logic is tested
 * against real SQLite rather than mocks.
 */
export type SqlValue = string | number | null;

export interface SqlExecutor {
  /** Executes one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
}

export interface SqlDriver extends SqlExecutor {
  /**
   * Runs `fn` inside an exclusive transaction. Commits when it resolves, rolls back when it
   * throws. No other statement may interleave on this connection while it runs.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
