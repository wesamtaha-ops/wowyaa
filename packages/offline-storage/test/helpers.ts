import type { EvaluationResult } from '@huroofi/content-schema';
import { masteryUpdaterV1 } from '@huroofi/learning-engine';
import { migrate, SqliteProgressRepository, type SqlDriver } from '../src';
import { openNodeSqlite } from '../src/node-driver';

export const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);
export const CHECKSUM = 'a'.repeat(64);

export function deps(db: SqlDriver, start = T0) {
  let clock = start;
  let id = 0;
  return {
    db,
    mastery: masteryUpdaterV1,
    now: () => clock++,
    newId: () => `id-${String(++id).padStart(6, '0')}`,
  };
}

export async function freshRepo(path = ':memory:') {
  const db = openNodeSqlite(path);
  await migrate(db);
  const repo = new SqliteProgressRepository(deps(db));
  await repo.activateContentPack({
    packId: 'ar-foundations-v1',
    version: '1.0.0-draft.1',
    schemaVersion: 1,
    checksumSha256: CHECKSUM,
  });
  return { db, repo };
}

export const result = (over: Partial<EvaluationResult> = {}): EvaluationResult => ({
  status: 'correct',
  targetSkillIds: ['decode.cvcvc_fatha', 'letter.qaf.sound'],
  feedbackKey: 'construct_word.correct',
  errorCodes: [],
  hintsUsed: 0,
  scoreDelta: 1,
  provenance: 'deterministic',
  ...over,
});

export function attempt(
  childId: string,
  sessionId: string,
  attemptId: string,
  over: Partial<EvaluationResult> = {},
  at = T0,
) {
  return {
    attemptId,
    sessionId,
    childId,
    activityId: 'act.construct.qamar',
    activityType: 'construct_word',
    activityVersion: 1,
    inputSource: 'touch' as const,
    contentVersion: '1.0.0-draft.1',
    result: result(over),
    responseMs: 2300,
    completedAtMs: at,
  };
}
