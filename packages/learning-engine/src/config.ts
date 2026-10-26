/**
 * Mastery parameters (plan §10). These are configurable research hypotheses awaiting
 * educator review, NOT validated learning-science constants. Changing any value requires
 * a new `algorithmVersion` so stored mastery stays explainable.
 */
export interface MasteryConfig {
  algorithmVersion: string;
  startingMastery: number;
  correctUnaidedDelta: number;
  correctHintedDelta: number;
  incorrectDelta: number;
  /** Review delay after the Nth consecutive success; the last entry repeats. */
  reviewIntervalsDays: readonly number[];
}

export const MASTERY_CONFIG_V1: MasteryConfig = Object.freeze({
  algorithmVersion: 'mastery-v1',
  startingMastery: 0.25,
  correctUnaidedDelta: 0.08,
  correctHintedDelta: 0.04,
  incorrectDelta: -0.05,
  reviewIntervalsDays: Object.freeze([1, 3, 7]),
});
