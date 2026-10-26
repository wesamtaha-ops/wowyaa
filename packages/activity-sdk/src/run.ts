import type { EvaluationResult, GameEvent } from '@huroofi/content-schema';
import type { ActivityDefinition } from './activity';

/**
 * Replays an event log through an activity. Used by tests and by session recovery after an
 * app kill: the same config + seed + events always yields the same state and evaluation.
 */
export function replayActivity<TConfig, TState>(
  def: ActivityDefinition<TConfig, TState>,
  rawConfig: unknown,
  seed: number,
  events: readonly GameEvent[],
): { state: TState; evaluation: EvaluationResult | null } {
  const config = def.validateConfig(rawConfig);
  let state = def.createInitialState(config, seed);
  for (const event of events) {
    if (!def.supportedSources.includes(event.source)) {
      throw new Error(`${def.type} does not accept input source ${event.source}`);
    }
    state = def.reduce(state, event);
  }
  return { state, evaluation: def.evaluate(state, config) };
}
