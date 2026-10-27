/**
 * Scheduler parameters (plan §10). Like the mastery deltas, these are research hypotheses
 * for the educator to review, not validated constants. Any change needs a new version so a
 * stored session plan stays explainable.
 */
export interface SchedulerConfig {
  version: string;
  /** Base weights per reason; a pick's weight is the strongest reason among its skills. */
  weights: {
    reviewDue: number;
    remediation: number;
    weak: number;
    newSkill: number;
    confidence: number;
  };
  /** Assessment items are for checking, not drilling: their weight is scaled down. */
  assessmentFactor: number;
  /** Share of the session reserved for due reviews and remediation, drawn first. */
  priorityShare: number;
  /** Max picks in a row of the same activity type while another type is available. */
  maxSameTypeRun: number;
  /** Floor so every unlocked activity keeps some chance (no starvation). */
  minWeight: number;
}

export const SCHEDULER_CONFIG_V1: SchedulerConfig = Object.freeze({
  version: 'scheduler-v1',
  weights: Object.freeze({
    reviewDue: 4,
    remediation: 3,
    weak: 2.5,
    newSkill: 2,
    confidence: 0.5,
  }),
  assessmentFactor: 0.5,
  priorityShare: 0.6,
  maxSameTypeRun: 2,
  minWeight: 0.1,
});
