import type { AgeBand } from './primitives';
import type { EvaluationResult, InputSource } from './gameplay';
import type { MasteryState } from './learning';

export type SessionStatus = 'active' | 'complete' | 'abandoned';

export interface SessionSummary {
  id: string;
  childId: string;
  contentPackId: string;
  contentVersion: string;
  startedAtMs: number;
  endedAtMs: number | null;
  status: SessionStatus;
  attemptCount: number;
}

export interface ChildProfile {
  id: string;
  displayName: string;
  ageBand: AgeBand;
  avatarId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

/**
 * `recordAttempt` input. Extends plan §6.3 with fields the §7 schema requires
 * (activity type/version, input source, response time) so nothing is invented at write time.
 */
export interface RecordAttemptInput {
  attemptId: string;
  sessionId: string;
  childId: string;
  activityId: string;
  activityType: string;
  activityVersion: number;
  inputSource: InputSource;
  contentVersion: string;
  result: EvaluationResult;
  responseMs: number | null;
  completedAtMs: number;
}

export type RecordAttemptOutcome = 'recorded' | 'duplicate';

export interface ProgressRepository {
  createChild(input: { displayName: string; ageBand: AgeBand }): Promise<string>;
  listChildren(): Promise<ChildProfile[]>;
  startSession(childId: string, seed: number): Promise<string>;
  endSession(sessionId: string, status: Exclude<SessionStatus, 'active'>): Promise<void>;
  /** Writes the attempt, its evidence and mastery changes in one transaction. Idempotent on attemptId. */
  recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptOutcome>;
  getMastery(childId: string): Promise<MasteryState[]>;
  listRecentSessions(childId: string, limit: number): Promise<SessionSummary[]>;
  deleteChildData(childId: string): Promise<void>;
}
