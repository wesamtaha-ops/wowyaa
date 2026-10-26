import { z } from 'zod';
import type { EvaluationResult, GameEvent } from '@huroofi/content-schema';
import { ContentIdSchema } from '@huroofi/content-schema';
import { ActivityConfigError, type ActivityDefinition } from '@huroofi/activity-sdk';
import { createRng, shuffle } from '@huroofi/game-core';

/**
 * Sound-to-Letter (plan §8.2), pure core. The child hears a bundled recording and picks
 * the letter. Replaying the sound is always free; only the elimination hint costs.
 */

export const MATCH_SOUND_LETTER_TYPE = 'match_sound_letter';
export const MATCH_SOUND_LETTER_VERSION = 1;

export const MatchSoundLetterConfigSchema = z
  .object({
    promptAudioRef: ContentIdSchema,
    answerLetterId: ContentIdSchema,
    choiceLetterIds: z.array(ContentIdSchema).min(2).max(4),
    confusionSetId: ContentIdSchema.optional(),
  })
  .superRefine((c, ctx) => {
    if (new Set(c.choiceLetterIds).size !== c.choiceLetterIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['choiceLetterIds'],
        message: 'choices must be unique',
      });
    }
    if (!c.choiceLetterIds.includes(c.answerLetterId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['answerLetterId'],
        message: 'answer must be one of the choices',
      });
    }
  });
export type MatchSoundLetterConfig = z.infer<typeof MatchSoundLetterConfigSchema>;

export interface MatchSoundLetterState {
  readonly answerLetterId: string;
  /** Display order, fixed by the seed. */
  readonly choices: readonly string[];
  readonly eliminated: readonly string[];
  readonly selected: string | null;
  readonly status: 'in_progress' | 'submitted';
  readonly replays: number;
  readonly hintsUsed: number;
  readonly submissionCount: number;
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('replay') }),
  z.object({ action: z.literal('hint') }),
  z.object({ action: z.literal('choose'), letterId: z.string() }),
]);
export type MatchSoundLetterAction = z.infer<typeof ActionSchema>;

export const matchSoundLetter: ActivityDefinition<MatchSoundLetterConfig, MatchSoundLetterState> = {
  type: MATCH_SOUND_LETTER_TYPE,
  version: MATCH_SOUND_LETTER_VERSION,
  supportedSources: ['touch', 'audio_choice', 'physical_tile'],
  requiredCapabilities: ['touchReady', 'audioReady'],
  optionalCapabilities: [],

  validateConfig(raw) {
    const parsed = MatchSoundLetterConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ActivityConfigError(
        MATCH_SOUND_LETTER_TYPE,
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      );
    }
    return parsed.data;
  },

  createInitialState(config, seed) {
    return {
      answerLetterId: config.answerLetterId,
      choices: shuffle(config.choiceLetterIds, createRng(seed)),
      eliminated: [],
      selected: null,
      status: 'in_progress',
      replays: 0,
      hintsUsed: 0,
      submissionCount: 0,
    };
  },

  reduce(state, event: GameEvent) {
    const parsed = ActionSchema.safeParse(event.payload);
    if (!parsed.success) return state;
    const action = parsed.data;
    switch (action.action) {
      case 'replay':
        return { ...state, replays: state.replays + 1 };
      case 'hint': {
        if (state.status === 'submitted' && state.selected === state.answerLetterId) return state;
        const remaining = state.choices.filter((c) => !state.eliminated.includes(c));
        // Always leave at least two options so the child still makes a real choice.
        if (remaining.length <= 2) return state;
        const wrong = remaining.find((c) => c !== state.answerLetterId);
        if (!wrong) return state;
        return {
          ...state,
          eliminated: [...state.eliminated, wrong],
          hintsUsed: state.hintsUsed + 1,
        };
      }
      case 'choose': {
        if (!state.choices.includes(action.letterId)) return state;
        if (state.eliminated.includes(action.letterId)) return state;
        // A correct answer is final; after a wrong one the child may try again.
        if (state.status === 'submitted' && state.selected === state.answerLetterId) return state;
        return {
          ...state,
          selected: action.letterId,
          status: 'submitted',
          submissionCount: state.submissionCount + 1,
        };
      }
    }
  },

  submissionCount: (state) => state.submissionCount,
  // The sound is the question: without it the item must be hidden (plan §8.2).
  requiredAssetIds: (config) => [config.promptAudioRef],

  evaluate(state, config): EvaluationResult | null {
    if (state.status !== 'submitted' || state.selected === null) return null;
    const correct = state.selected === state.answerLetterId;
    const errorCodes = correct
      ? []
      : ['wrong_letter', ...(config.confusionSetId ? [`confusion.${config.confusionSetId}`] : [])];
    return {
      status: correct ? 'correct' : 'incorrect',
      targetSkillIds: [`${config.answerLetterId}.sound`],
      feedbackKey: correct ? 'match_sound_letter.correct' : 'match_sound_letter.try_again',
      errorCodes,
      hintsUsed: state.hintsUsed,
      scoreDelta: correct ? (state.hintsUsed > 0 ? 0.5 : 1) : 0,
      provenance: 'deterministic',
    };
  },
};
