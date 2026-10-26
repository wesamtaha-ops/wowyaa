import type { EvaluationResult, GameEvent, InputSource } from '@huroofi/content-schema';
import type { Capability } from './capabilities';

/**
 * Activity plug-in contract (plan §6). Definitions are pure: no I/O, no clocks, no
 * Math.random. All randomness comes from the seed passed to `createInitialState`.
 */
export interface ActivityDefinition<TConfig = unknown, TState = unknown> {
  readonly type: string;
  readonly version: number;
  readonly supportedSources: readonly InputSource[];
  readonly requiredCapabilities: readonly Capability[];
  readonly optionalCapabilities: readonly Capability[];
  /** Throws `ActivityConfigError` for invalid content. */
  validateConfig(raw: unknown): TConfig;
  createInitialState(config: TConfig, seed: number): TState;
  reduce(state: TState, event: GameEvent): TState;
  /** Returns null while the activity is still in progress. */
  evaluate(state: TState, config: TConfig): EvaluationResult | null;
  /**
   * How many times the child has submitted. Each increment is one attempt; the session
   * derives a deterministic attempt id from it so a replayed submission records once.
   */
  submissionCount(state: TState): number;
  /** Bundled assets the activity cannot run without (e.g. the prompt sound). */
  requiredAssetIds(config: TConfig): string[];
}

export class ActivityConfigError extends Error {
  constructor(
    readonly activityType: string,
    readonly issues: string[],
  ) {
    super(`Invalid ${activityType} config: ${issues.join('; ')}`);
    this.name = 'ActivityConfigError';
  }
}
