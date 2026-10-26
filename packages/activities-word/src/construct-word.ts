import { z } from 'zod';
import type { EvaluationResult, GameEvent } from '@huroofi/content-schema';
import { ContentIdSchema } from '@huroofi/content-schema';
import { ActivityConfigError, type ActivityDefinition } from '@huroofi/activity-sdk';
import { createRng, shuffle } from '@huroofi/game-core';

/**
 * Word Construction (plan §8.1), pure core. Comparison is over canonical letter ids in
 * logical order, never over shaped glyphs. UI ships in M2; this module is the rules engine.
 */

export const CONSTRUCT_WORD_TYPE = 'construct_word';
export const CONSTRUCT_WORD_VERSION = 1;

export const ConstructWordConfigSchema = z
  .object({
    wordId: ContentIdSchema,
    answer: z.array(ContentIdSchema).min(1).max(8),
    distractors: z.array(ContentIdSchema).max(6),
    targetSkillIds: z.array(ContentIdSchema).min(1),
    /** letterId → dot family, used for targeted hints on dot confusions. */
    dotFamilies: z.record(ContentIdSchema, ContentIdSchema),
  })
  .superRefine((c, ctx) => {
    const answerSet = new Set(c.answer);
    c.distractors.forEach((d, i) => {
      if (answerSet.has(d)) {
        ctx.addIssue({
          code: 'custom',
          path: ['distractors', i],
          message: `distractor ${d} duplicates an answer letter and makes slots ambiguous`,
        });
      }
    });
    if (new Set(c.distractors).size !== c.distractors.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['distractors'],
        message: 'distractors must be unique',
      });
    }
  });
export type ConstructWordConfig = z.infer<typeof ConstructWordConfigSchema>;

export interface Tile {
  tileId: string;
  letterId: string;
}

export type ConstructWordStatus = 'in_progress' | 'submitted';

export interface ConstructWordState {
  readonly answer: readonly string[];
  readonly tiles: readonly Tile[];
  readonly slots: readonly (string | null)[];
  readonly history: readonly (readonly (string | null)[])[];
  readonly status: ConstructWordStatus;
  readonly hintsUsed: number;
  readonly hintedTileId: string | null;
  /** Increments on every submit; combine with session+activity ids for an idempotent attempt id. */
  readonly submissionCount: number;
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('place'),
    tileId: z.string(),
    slotIndex: z.number().int().nonnegative(),
  }),
  z.object({ action: z.literal('remove'), slotIndex: z.number().int().nonnegative() }),
  z.object({ action: z.literal('undo') }),
  z.object({ action: z.literal('reset') }),
  z.object({ action: z.literal('hint') }),
  z.object({ action: z.literal('submit') }),
]);
export type ConstructWordAction = z.infer<typeof ActionSchema>;

function lettersInSlots(state: ConstructWordState): (string | null)[] {
  const byId = new Map(state.tiles.map((t) => [t.tileId, t.letterId]));
  return state.slots.map((id) => (id === null ? null : (byId.get(id) ?? null)));
}

function withSlots(state: ConstructWordState, slots: (string | null)[]): ConstructWordState {
  return { ...state, slots, history: [...state.history, state.slots], hintedTileId: null };
}

export const constructWord: ActivityDefinition<ConstructWordConfig, ConstructWordState> = {
  type: CONSTRUCT_WORD_TYPE,
  version: CONSTRUCT_WORD_VERSION,
  supportedSources: ['touch', 'physical_tile'],
  requiredCapabilities: ['touchReady'],
  optionalCapabilities: ['audioReady'],

  validateConfig(raw) {
    const parsed = ConstructWordConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ActivityConfigError(
        CONSTRUCT_WORD_TYPE,
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      );
    }
    return parsed.data;
  },

  createInitialState(config, seed) {
    const ordered: Tile[] = [...config.answer, ...config.distractors].map((letterId, i) => ({
      tileId: `t${i}`,
      letterId,
    }));
    let tiles = shuffle(ordered, createRng(seed));
    // A shuffle that leaves the answer already spelled in tray order gives the game away.
    const spellsAnswer = (ts: Tile[]) => config.answer.every((l, i) => ts[i]?.letterId === l);
    if (tiles.length > 1 && spellsAnswer(tiles)) tiles = [...tiles.slice(1), tiles[0] as Tile];
    return {
      answer: config.answer,
      tiles,
      slots: config.answer.map(() => null),
      history: [],
      status: 'in_progress',
      hintsUsed: 0,
      hintedTileId: null,
      submissionCount: 0,
    };
  },

  reduce(state, event: GameEvent) {
    const parsed = ActionSchema.safeParse(event.payload);
    if (!parsed.success) return state; // Unknown input is ignored, never crashes the game.
    const action = parsed.data;

    if (state.status === 'submitted') {
      // After feedback the child may retry; any edit reopens the board.
      if (action.action === 'reset')
        return reopen(
          state,
          state.slots.map(() => null),
        );
      if (action.action === 'remove' || action.action === 'undo') {
        return reduceEditing({ ...state, status: 'in_progress' }, action);
      }
      return state;
    }
    return reduceEditing(state, action);
  },

  evaluate(state, config): EvaluationResult | null {
    if (state.status !== 'submitted') return null;
    const placed = lettersInSlots(state);
    const errorCodes = diagnose(placed, config);
    const correct = errorCodes.length === 0;
    return {
      status: correct ? 'correct' : 'incorrect',
      targetSkillIds: config.targetSkillIds,
      feedbackKey: correct
        ? 'construct_word.correct'
        : `construct_word.try_again.${errorCodes[0] ?? 'generic'}`,
      errorCodes,
      hintsUsed: state.hintsUsed,
      scoreDelta: correct ? (state.hintsUsed > 0 ? 0.5 : 1) : 0,
      provenance: 'deterministic',
    };
  },
};

function reopen(state: ConstructWordState, slots: (string | null)[]): ConstructWordState {
  return { ...withSlots(state, slots), status: 'in_progress' };
}

function reduceEditing(state: ConstructWordState, action: ConstructWordAction): ConstructWordState {
  switch (action.action) {
    case 'place': {
      if (action.slotIndex >= state.slots.length) return state;
      if (!state.tiles.some((t) => t.tileId === action.tileId)) return state;
      // Moving a tile already on the board vacates its old slot.
      const slots = state.slots.map((id) => (id === action.tileId ? null : id));
      slots[action.slotIndex] = action.tileId;
      return withSlots(state, slots);
    }
    case 'remove': {
      if (state.slots[action.slotIndex] == null) return state;
      const slots = state.slots.slice();
      slots[action.slotIndex] = null;
      return withSlots(state, slots);
    }
    case 'undo': {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return { ...state, slots: prev, history: state.history.slice(0, -1), hintedTileId: null };
    }
    case 'reset':
      return withSlots(
        state,
        state.slots.map(() => null),
      );
    case 'hint': {
      const placed = lettersInSlots(state);
      const idx = state.answer.findIndex((l, i) => placed[i] !== l);
      if (idx < 0) return state;
      const used = new Set(state.slots.filter((s): s is string => s !== null));
      const tile =
        state.tiles.find((t) => t.letterId === state.answer[idx] && !used.has(t.tileId)) ??
        state.tiles.find((t) => t.letterId === state.answer[idx]);
      return { ...state, hintsUsed: state.hintsUsed + 1, hintedTileId: tile?.tileId ?? null };
    }
    case 'submit':
      return { ...state, status: 'submitted', submissionCount: state.submissionCount + 1 };
  }
}

/** Ordered error codes; the first one drives the feedback prompt. */
function diagnose(placed: (string | null)[], config: ConstructWordConfig): string[] {
  const codes: string[] = [];
  const { answer, dotFamilies } = config;
  if (placed.some((p) => p === null)) codes.push('incomplete');
  if (placed[0] !== null && placed[0] !== answer[0]) codes.push('wrong_first_letter');
  const sameFamily = answer.some((expected, i) => {
    const got = placed[i];
    if (!got || got === expected) return false;
    const fam = dotFamilies[expected];
    return fam !== undefined && dotFamilies[got] === fam;
  });
  if (sameFamily) codes.push('dot_family_confusion');
  const filled = placed.filter((p): p is string => p !== null);
  const sameLetters =
    filled.length === answer.length && [...filled].sort().join() === [...answer].sort().join();
  if (sameLetters && filled.some((l, i) => l !== answer[i])) codes.push('letter_order');
  if (codes.length === 0 && placed.some((p, i) => p !== answer[i])) codes.push('wrong_letter');
  return codes;
}
