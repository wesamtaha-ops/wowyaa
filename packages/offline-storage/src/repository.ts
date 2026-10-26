import {
  AgeBandSchema,
  EvaluationResultSchema,
  type AgeBand,
  type ChildProfile,
  type MasteryState,
  type MasteryUpdater,
  type ProgressRepository,
  type RecordAttemptInput,
  type RecordAttemptOutcome,
  type SessionStatus,
  type SessionSummary,
} from '@huroofi/content-schema';
import type { SqlDriver, SqlExecutor } from './driver';

export interface RepositoryDeps {
  db: SqlDriver;
  mastery: MasteryUpdater;
  now: () => number;
  newId: () => string;
}

export class RepositoryError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'no_active_pack'
      | 'unknown_child'
      | 'unknown_session'
      | 'session_closed'
      | 'session_child_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

interface MasteryRow {
  child_id: string;
  skill_id: string;
  mastery: number;
  exposures: number;
  correct: number;
  incorrect: number;
  consecutive_correct: number;
  last_practiced_at_ms: number | null;
  next_review_at_ms: number | null;
  algorithm_version: string;
}

const toMastery = (r: MasteryRow): MasteryState => ({
  childId: r.child_id,
  skillId: r.skill_id,
  mastery: r.mastery,
  exposures: r.exposures,
  correct: r.correct,
  incorrect: r.incorrect,
  consecutiveCorrect: r.consecutive_correct,
  lastPracticedAtMs: r.last_practiced_at_ms,
  nextReviewAtMs: r.next_review_at_ms,
  algorithmVersion: r.algorithm_version,
});

const MAX_NAME_LENGTH = 40;

/**
 * SQLite-backed progress store. The only writer of learner state; activities never touch
 * it directly (plan §5). Raw ink/audio is never accepted here (plan §6.3).
 */
export class SqliteProgressRepository implements ProgressRepository {
  constructor(private readonly deps: RepositoryDeps) {}

  async createChild(input: { displayName: string; ageBand: AgeBand }): Promise<string> {
    const displayName = input.displayName.normalize('NFC').trim();
    if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
      throw new RepositoryError(
        'invalid_input',
        `displayName must be 1–${MAX_NAME_LENGTH} characters`,
      );
    }
    const ageBand = AgeBandSchema.parse(input.ageBand);
    const id = this.deps.newId();
    const now = this.deps.now();
    await this.deps.db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO child_profiles (id, display_name, age_band, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?)',
        [id, displayName, ageBand, now, now],
      );
      await tx.run('INSERT INTO parent_settings (child_id) VALUES (?)', [id]);
    });
    return id;
  }

  async listChildren(): Promise<ChildProfile[]> {
    const rows = await this.deps.db.all<{
      id: string;
      display_name: string;
      age_band: AgeBand;
      avatar_id: string;
      created_at_ms: number;
      updated_at_ms: number;
    }>('SELECT * FROM child_profiles ORDER BY created_at_ms, id');
    return rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      ageBand: r.age_band,
      avatarId: r.avatar_id,
      createdAtMs: r.created_at_ms,
      updatedAtMs: r.updated_at_ms,
    }));
  }

  /** Registers a bundled/verified pack and makes it the only active one. */
  async activateContentPack(pack: {
    packId: string;
    version: string;
    schemaVersion: number;
    checksumSha256: string;
  }): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(pack.checksumSha256)) {
      throw new RepositoryError('invalid_input', 'checksumSha256 must be lowercase hex SHA-256');
    }
    await this.deps.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO content_packs (pack_id, version, schema_version, checksum_sha256, installed_at_ms, is_active)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(pack_id, version) DO UPDATE SET checksum_sha256 = excluded.checksum_sha256,
           schema_version = excluded.schema_version`,
        [pack.packId, pack.version, pack.schemaVersion, pack.checksumSha256, this.deps.now()],
      );
      await tx.run(
        'UPDATE content_packs SET is_active = CASE WHEN pack_id = ? AND version = ? THEN 1 ELSE 0 END',
        [pack.packId, pack.version],
      );
    });
  }

  async getActiveContentPack(): Promise<{
    packId: string;
    version: string;
    checksumSha256: string;
  } | null> {
    const row = await this.deps.db.first<{
      pack_id: string;
      version: string;
      checksum_sha256: string;
    }>('SELECT pack_id, version, checksum_sha256 FROM content_packs WHERE is_active = 1');
    return row
      ? { packId: row.pack_id, version: row.version, checksumSha256: row.checksum_sha256 }
      : null;
  }

  async startSession(childId: string, seed: number): Promise<string> {
    if (!Number.isSafeInteger(seed))
      throw new RepositoryError('invalid_input', 'seed must be a safe integer');
    const id = this.deps.newId();
    await this.deps.db.transaction(async (tx) => {
      const pack = await tx.first<{ pack_id: string; version: string }>(
        'SELECT pack_id, version FROM content_packs WHERE is_active = 1',
      );
      if (!pack) throw new RepositoryError('no_active_pack', 'no active content pack installed');
      await this.requireChild(tx, childId);
      await tx.run(
        `INSERT INTO learning_sessions (id, child_id, content_pack_id, content_version, started_at_ms, random_seed, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [id, childId, pack.pack_id, pack.version, this.deps.now(), seed],
      );
    });
    return id;
  }

  async endSession(sessionId: string, status: Exclude<SessionStatus, 'active'>): Promise<void> {
    const { changes } = await this.deps.db.run(
      "UPDATE learning_sessions SET status = ?, ended_at_ms = ? WHERE id = ? AND status = 'active'",
      [status, this.deps.now(), sessionId],
    );
    if (changes === 0) {
      const exists = await this.deps.db.first('SELECT 1 FROM learning_sessions WHERE id = ?', [
        sessionId,
      ]);
      if (!exists) throw new RepositoryError('unknown_session', `unknown session ${sessionId}`);
    }
  }

  /**
   * Recovers from an app kill: sessions still `active` that started before `cutoffMs` are
   * marked abandoned. Their recorded attempts and mastery are kept.
   */
  async abandonStaleSessions(cutoffMs: number): Promise<number> {
    const { changes } = await this.deps.db.run(
      "UPDATE learning_sessions SET status = 'abandoned', ended_at_ms = ? WHERE status = 'active' AND started_at_ms < ?",
      [this.deps.now(), cutoffMs],
    );
    return changes;
  }

  async recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptOutcome> {
    const parsed = EvaluationResultSchema.safeParse(input.result);
    if (!parsed.success)
      throw new RepositoryError('invalid_input', `invalid result: ${parsed.error.message}`);
    const result = parsed.data;
    const skillIds = [...new Set(result.targetSkillIds)];

    return this.deps.db.transaction(async (tx) => {
      const session = await tx.first<{ child_id: string; status: SessionStatus }>(
        'SELECT child_id, status FROM learning_sessions WHERE id = ?',
        [input.sessionId],
      );
      if (!session)
        throw new RepositoryError('unknown_session', `unknown session ${input.sessionId}`);
      if (session.child_id !== input.childId) {
        throw new RepositoryError(
          'session_child_mismatch',
          'attempt child does not own the session',
        );
      }

      const inserted = await tx.run(
        `INSERT INTO activity_attempts (id, session_id, child_id, activity_id, activity_type, activity_version,
           input_source, outcome, hints_used, response_ms, error_codes_json, completed_at_ms, content_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [
          input.attemptId,
          input.sessionId,
          input.childId,
          input.activityId,
          input.activityType,
          input.activityVersion,
          input.inputSource,
          result.status,
          result.hintsUsed,
          input.responseMs,
          JSON.stringify(result.errorCodes),
          input.completedAtMs,
          input.contentVersion,
        ],
      );
      // Idempotency: a replayed submission must not double-count evidence (plan §6.3, §17.4).
      if (inserted.changes === 0) return 'duplicate';
      if (session.status !== 'active') {
        throw new RepositoryError(
          'session_closed',
          `session ${input.sessionId} is ${session.status}`,
        );
      }

      const now = this.deps.now();
      for (const skillId of skillIds) {
        await tx.run(
          'INSERT INTO skill_evidence (attempt_id, skill_id, outcome, hints_used) VALUES (?, ?, ?, ?)',
          [input.attemptId, skillId, result.status, result.hintsUsed],
        );
        const row = await tx.first<MasteryRow>(
          'SELECT * FROM skill_mastery WHERE child_id = ? AND skill_id = ?',
          [input.childId, skillId],
        );
        const before = row
          ? toMastery(row)
          : this.deps.mastery.initialState(input.childId, skillId);
        const after = this.deps.mastery.update(before, {
          attemptId: input.attemptId,
          childId: input.childId,
          skillId,
          outcome: result.status,
          hintsUsed: result.hintsUsed,
          responseMs: input.responseMs,
          completedAtMs: input.completedAtMs,
        });
        await tx.run(
          `INSERT INTO skill_mastery (child_id, skill_id, mastery, exposures, correct, incorrect, consecutive_correct,
             last_practiced_at_ms, next_review_at_ms, algorithm_version, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(child_id, skill_id) DO UPDATE SET
             mastery = excluded.mastery, exposures = excluded.exposures, correct = excluded.correct,
             incorrect = excluded.incorrect, consecutive_correct = excluded.consecutive_correct,
             last_practiced_at_ms = excluded.last_practiced_at_ms, next_review_at_ms = excluded.next_review_at_ms,
             algorithm_version = excluded.algorithm_version, updated_at_ms = excluded.updated_at_ms`,
          [
            after.childId,
            after.skillId,
            after.mastery,
            after.exposures,
            after.correct,
            after.incorrect,
            after.consecutiveCorrect,
            after.lastPracticedAtMs,
            after.nextReviewAtMs,
            after.algorithmVersion,
            now,
          ],
        );
      }
      return 'recorded';
    });
  }

  async getMastery(childId: string): Promise<MasteryState[]> {
    const rows = await this.deps.db.all<MasteryRow>(
      'SELECT * FROM skill_mastery WHERE child_id = ? ORDER BY skill_id',
      [childId],
    );
    return rows.map(toMastery);
  }

  async listRecentSessions(childId: string, limit: number): Promise<SessionSummary[]> {
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), 500));
    const rows = await this.deps.db.all<{
      id: string;
      child_id: string;
      content_pack_id: string;
      content_version: string;
      started_at_ms: number;
      ended_at_ms: number | null;
      status: SessionStatus;
      attempt_count: number;
    }>(
      `SELECT s.*, (SELECT COUNT(*) FROM activity_attempts a WHERE a.session_id = s.id) AS attempt_count
       FROM learning_sessions s WHERE s.child_id = ? ORDER BY s.started_at_ms DESC, s.id LIMIT ?`,
      [childId, safeLimit],
    );
    return rows.map((r) => ({
      id: r.id,
      childId: r.child_id,
      contentPackId: r.content_pack_id,
      contentVersion: r.content_version,
      startedAtMs: r.started_at_ms,
      endedAtMs: r.ended_at_ms,
      status: r.status,
      attemptCount: r.attempt_count,
    }));
  }

  /** Removes the profile and, via ON DELETE CASCADE, every row derived from it. */
  async deleteChildData(childId: string): Promise<void> {
    await this.deps.db.transaction(async (tx) => {
      await tx.run('DELETE FROM child_profiles WHERE id = ?', [childId]);
    });
  }

  async getDeviceSetting<T>(key: string): Promise<T | null> {
    const row = await this.deps.db.first<{ setting_value_json: string }>(
      'SELECT setting_value_json FROM device_settings WHERE setting_key = ?',
      [key],
    );
    return row ? (JSON.parse(row.setting_value_json) as T) : null;
  }

  async setDeviceSetting(key: string, value: unknown): Promise<void> {
    await this.deps.db.run(
      `INSERT INTO device_settings (setting_key, setting_value_json, updated_at_ms) VALUES (?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value_json = excluded.setting_value_json,
         updated_at_ms = excluded.updated_at_ms`,
      [key, JSON.stringify(value), this.deps.now()],
    );
  }

  private async requireChild(tx: SqlExecutor, childId: string): Promise<void> {
    const exists = await tx.first('SELECT 1 FROM child_profiles WHERE id = ?', [childId]);
    if (!exists) throw new RepositoryError('unknown_child', `unknown child ${childId}`);
  }
}
