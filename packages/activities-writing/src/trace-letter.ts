import { z } from 'zod';
import type { RecognitionOutcome } from '@huroofi/ai-gateway';
import type { EvaluationResult, GameEvent, TraceGuideSet } from '@huroofi/content-schema';
import { ContentIdSchema } from '@huroofi/content-schema';
import { ActivityConfigError, type ActivityDefinition } from '@huroofi/activity-sdk';
import {
  evaluateGeometry,
  prepareGuide,
  TRACE_GEOMETRY_V1,
  type GeometryVerdict,
  type InkStroke,
  type PreparedGuide,
  type TraceGeometryConfig,
} from './geometry';

/**
 * Letter Tracing (plan §8.3), pure core. Geometry decides; an optional on-device recognizer
 * can only corroborate. Strokes live in state for the current attempt and are never part of
 * the evaluation result, so they are not persisted (plan §6.3).
 */

export const TRACE_LETTER_TYPE = 'trace_letter';
export const TRACE_LETTER_VERSION = 1;

export const TraceLetterConfigSchema = z.object({
  letterId: ContentIdSchema,
  presentation: z.enum(['isolated', 'initial', 'medial', 'final']),
  confusionSetId: ContentIdSchema.optional(),
});
export type TraceLetterConfig = z.infer<typeof TraceLetterConfigSchema>;

export interface TraceLetterState {
  readonly letterId: string;
  readonly strokes: readonly InkStroke[];
  readonly status: 'in_progress' | 'submitted';
  readonly hintsUsed: number;
  readonly submissionCount: number;
  readonly verdict: GeometryVerdict | null;
  readonly recognition: RecognitionOutcome | null;
}

const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  tMs: z.number().finite(),
});
const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stroke'), points: z.array(PointSchema).min(1).max(2000) }),
  z.object({ action: z.literal('undo_stroke') }),
  z.object({ action: z.literal('clear') }),
  /** Shows the start point and demo; counted so hinted success weighs less. */
  z.object({ action: z.literal('hint') }),
  z.object({
    action: z.literal('submit'),
    /** Supplied by the shell when a recognizer ran; absent means geometry-only. */
    recognition: z
      .custom<RecognitionOutcome>((v) => typeof v === 'object' && v !== null)
      .optional(),
  }),
]);
export type TraceLetterAction = z.infer<typeof ActionSchema>;

const MAX_STROKES = 12;
const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function createTraceLetter(
  guides: TraceGuideSet,
  geometry: TraceGeometryConfig = TRACE_GEOMETRY_V1,
): ActivityDefinition<TraceLetterConfig, TraceLetterState> {
  const prepared = new Map<string, PreparedGuide>();
  const guideFor = (letterId: string) => {
    let p = prepared.get(letterId);
    if (!p) {
      const guide = guides.guides.find((g) => g.letterId === letterId);
      if (!guide) return null;
      p = prepareGuide(guide, geometry);
      prepared.set(letterId, p);
    }
    return p;
  };

  return {
    type: TRACE_LETTER_TYPE,
    version: TRACE_LETTER_VERSION,
    supportedSources: ['touch', 'handwriting'],
    requiredCapabilities: ['touchReady', 'geometryTraceReady'],
    optionalCapabilities: ['digitalInkReady'],

    validateConfig(raw) {
      const parsed = TraceLetterConfigSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ActivityConfigError(
          TRACE_LETTER_TYPE,
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        );
      }
      const guide = guides.guides.find((g) => g.letterId === parsed.data.letterId);
      if (!guide) {
        throw new ActivityConfigError(TRACE_LETTER_TYPE, [
          `letterId: no trace guide for ${parsed.data.letterId}`,
        ]);
      }
      if (guide.presentation !== parsed.data.presentation) {
        throw new ActivityConfigError(TRACE_LETTER_TYPE, [
          `presentation: guide for ${parsed.data.letterId} is ${guide.presentation}`,
        ]);
      }
      return parsed.data;
    },

    createInitialState(config) {
      return {
        letterId: config.letterId,
        strokes: [],
        status: 'in_progress',
        hintsUsed: 0,
        submissionCount: 0,
        verdict: null,
        recognition: null,
      };
    },

    reduce(state, event: GameEvent) {
      const parsed = ActionSchema.safeParse(event.payload);
      if (!parsed.success) return state;
      const action = parsed.data;
      // After a correct trace the board is done; after any other result the child keeps going.
      if (state.status === 'submitted' && state.verdict?.status === 'correct') return state;
      const editing = { ...state, status: 'in_progress' as const };
      switch (action.action) {
        case 'stroke': {
          if (state.strokes.length >= MAX_STROKES) return state;
          const points = action.points.map((p) => ({ x: clamp(p.x), y: clamp(p.y), tMs: p.tMs }));
          return { ...editing, strokes: [...state.strokes, points], verdict: null };
        }
        case 'undo_stroke':
          return { ...editing, strokes: state.strokes.slice(0, -1), verdict: null };
        case 'clear':
          return { ...editing, strokes: [], verdict: null };
        case 'hint':
          return { ...state, hintsUsed: state.hintsUsed + 1 };
        case 'submit': {
          if (state.status === 'submitted' || state.strokes.length === 0) return state;
          const guide = guideFor(state.letterId);
          if (!guide) return state;
          return {
            ...state,
            status: 'submitted',
            submissionCount: state.submissionCount + 1,
            verdict: evaluateGeometry(guide, state.strokes, geometry),
            recognition: action.recognition ?? null,
          };
        }
      }
    },

    submissionCount: (state) => state.submissionCount,
    // Guides are bundled pack data checked in validateConfig, not media assets.
    requiredAssetIds: () => [],

    evaluate(state, config): EvaluationResult | null {
      if (state.status !== 'submitted' || !state.verdict) return null;
      const glyph = guides.guides.find((g) => g.letterId === config.letterId)?.glyph ?? '';
      const { status, errorCodes, provenance } = combine(state.verdict, state.recognition, glyph);
      return {
        status,
        targetSkillIds: [`${config.letterId}.trace`],
        feedbackKey:
          status === 'correct'
            ? 'trace_letter.correct'
            : status === 'indeterminate'
              ? 'trace_letter.keep_going'
              : `trace_letter.try_again.${errorCodes[0] ?? 'generic'}`,
        errorCodes:
          status === 'incorrect' && config.confusionSetId
            ? [...errorCodes, `confusion.${config.confusionSetId}`]
            : errorCodes,
        hintsUsed: state.hintsUsed,
        scoreDelta: status === 'correct' ? (state.hintsUsed > 0 ? 0.5 : 1) : 0,
        provenance,
      };
    },
  };
}

/**
 * Geometry is the authority. A recognizer that agrees upgrades provenance; one that
 * disagrees turns any verdict into `indeterminate` (gentle retry, mastery unchanged).
 */
function combine(
  verdict: GeometryVerdict,
  recognition: RecognitionOutcome | null,
  glyph: string,
): {
  status: EvaluationResult['status'];
  errorCodes: string[];
  provenance: EvaluationResult['provenance'];
} {
  if (!recognition || recognition.status !== 'recognized') {
    return { status: verdict.status, errorCodes: verdict.errorCodes, provenance: 'deterministic' };
  }
  const agrees = recognition.candidates[0]?.text === glyph;
  if (agrees && verdict.status === 'correct') {
    return { status: 'correct', errorCodes: [], provenance: 'hybrid' };
  }
  if (!agrees && verdict.status !== 'correct') {
    return { status: verdict.status, errorCodes: verdict.errorCodes, provenance: 'hybrid' };
  }
  return {
    status: 'indeterminate',
    errorCodes: ['recognizer_disagrees', ...verdict.errorCodes],
    provenance: 'hybrid',
  };
}
