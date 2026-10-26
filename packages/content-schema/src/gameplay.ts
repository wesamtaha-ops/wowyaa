import { z } from 'zod';
import { ContentIdSchema, EpochMsSchema } from './primitives';

export const InputSourceSchema = z.enum(['touch', 'audio_choice', 'handwriting', 'physical_tile']);
export type InputSource = z.infer<typeof InputSourceSchema>;

export const EvaluationStatusSchema = z.enum(['correct', 'incorrect', 'indeterminate']);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;

export const GameEventKindSchema = z.enum(['letter', 'word', 'stroke_set', 'tile_sequence']);
export type GameEventKind = z.infer<typeof GameEventKindSchema>;

/**
 * Canonical multimodal input (plan §6). Touch, audio choice, handwriting and future
 * physical tiles all reduce to this shape so activities never care about the device.
 */
export const GameEventSchema = z.object({
  eventId: z.string().min(1),
  sessionId: z.string().min(1),
  activityId: ContentIdSchema,
  source: InputSourceSchema,
  kind: GameEventKindSchema,
  payload: z.unknown(),
  occurredAtMs: EpochMsSchema,
  confidence: z.number().min(0).max(1).optional(),
});
export type GameEvent = z.infer<typeof GameEventSchema>;

export const EvaluationProvenanceSchema = z.enum(['deterministic', 'mlkit', 'hybrid']);

export const EvaluationResultSchema = z.object({
  status: EvaluationStatusSchema,
  targetSkillIds: z.array(ContentIdSchema).min(1),
  feedbackKey: z.string().min(1),
  errorCodes: z.array(z.string().min(1)),
  hintsUsed: z.number().int().nonnegative(),
  scoreDelta: z.number(),
  provenance: EvaluationProvenanceSchema,
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
