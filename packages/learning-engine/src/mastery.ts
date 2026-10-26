import type { MasteryState, MasteryUpdater, SkillEvidence } from '@huroofi/content-schema';
import { MASTERY_CONFIG_V1, type MasteryConfig } from './config';

const DAY_MS = 86_400_000;
/** Round to avoid floating-point drift accumulating across thousands of attempts. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function createMasteryUpdater(config: MasteryConfig = MASTERY_CONFIG_V1): MasteryUpdater {
  return {
    initialState(childId, skillId) {
      return {
        childId,
        skillId,
        mastery: config.startingMastery,
        exposures: 0,
        correct: 0,
        incorrect: 0,
        consecutiveCorrect: 0,
        lastPracticedAtMs: null,
        nextReviewAtMs: null,
        algorithmVersion: config.algorithmVersion,
      };
    },

    update(state: MasteryState, evidence: SkillEvidence): MasteryState {
      if (state.childId !== evidence.childId || state.skillId !== evidence.skillId) {
        throw new Error(
          `evidence for ${evidence.childId}/${evidence.skillId} applied to ${state.childId}/${state.skillId}`,
        );
      }
      const lastPracticedAtMs = Math.max(state.lastPracticedAtMs ?? 0, evidence.completedAtMs);
      const base = {
        ...state,
        exposures: state.exposures + 1,
        lastPracticedAtMs,
        algorithmVersion: config.algorithmVersion,
      };

      switch (evidence.outcome) {
        // Uncertain AI output must never cost the child mastery (plan §1.2).
        case 'indeterminate':
          return base;
        case 'correct': {
          const delta =
            evidence.hintsUsed > 0 ? config.correctHintedDelta : config.correctUnaidedDelta;
          const streak = state.consecutiveCorrect + 1;
          const intervals = config.reviewIntervalsDays;
          const days = intervals[Math.min(streak, intervals.length) - 1] ?? 1;
          return {
            ...base,
            mastery: round(clamp01(state.mastery + delta)),
            correct: state.correct + 1,
            consecutiveCorrect: streak,
            nextReviewAtMs: evidence.completedAtMs + days * DAY_MS,
          };
        }
        case 'incorrect':
          return {
            ...base,
            mastery: round(clamp01(state.mastery + config.incorrectDelta)),
            incorrect: state.incorrect + 1,
            consecutiveCorrect: 0,
            // Due again immediately; the scheduler (M3) decides when to surface it.
            nextReviewAtMs: evidence.completedAtMs,
          };
      }
    },
  };
}

export const masteryUpdaterV1 = createMasteryUpdater();
