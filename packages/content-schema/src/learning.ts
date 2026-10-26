import { z } from 'zod';
import { ContentIdSchema, EpochMsSchema } from './primitives';
import { EvaluationStatusSchema } from './gameplay';

export const MasteryStateSchema = z.object({
  childId: z.string().min(1),
  skillId: ContentIdSchema,
  mastery: z.number().min(0).max(1),
  exposures: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(),
  consecutiveCorrect: z.number().int().nonnegative(),
  lastPracticedAtMs: EpochMsSchema.nullable(),
  nextReviewAtMs: EpochMsSchema.nullable(),
  algorithmVersion: z.string().min(1),
});
export type MasteryState = z.infer<typeof MasteryStateSchema>;

export const SkillEvidenceSchema = z.object({
  attemptId: z.string().min(1),
  childId: z.string().min(1),
  skillId: ContentIdSchema,
  outcome: EvaluationStatusSchema,
  hintsUsed: z.number().int().nonnegative(),
  responseMs: z.number().int().nonnegative().nullable(),
  completedAtMs: EpochMsSchema,
});
export type SkillEvidence = z.infer<typeof SkillEvidenceSchema>;

export interface SelectNextContext {
  states: MasteryState[];
  eligibleActivityIds: string[];
  sessionSeed: number;
  nowMs: number;
}

export interface LearningEngine {
  readonly algorithmVersion: string;
  initialState(childId: string, skillId: string): MasteryState;
  update(state: MasteryState, evidence: SkillEvidence): MasteryState;
  selectNext(context: SelectNextContext): { activityId: string; reasonCodes: string[] };
}

/** The subset of the engine the storage layer needs to apply evidence atomically. */
export type MasteryUpdater = Pick<LearningEngine, 'initialState' | 'update'>;
