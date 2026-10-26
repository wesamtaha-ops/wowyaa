import type {
  ActivityItem,
  EvaluationResult,
  GameEvent,
  InputSource,
} from '@huroofi/content-schema';
import { createRng, deriveSeed, shuffle } from '@huroofi/game-core';
import type { ActivityDefinition } from './activity';
import { checkAvailability, type CapabilitySnapshot } from './capabilities';
import type { ActivityRegistry } from './registry';

export type HiddenReason =
  'unregistered' | 'missing_capability' | 'missing_asset' | 'invalid_config';

export interface SessionQueue {
  items: ActivityItem[];
  hidden: Array<{ activityId: string; reason: HiddenReason; detail: string }>;
}

/**
 * Picks this session's activities. M2 rule: playable practice items, shuffled by the session
 * seed and capped. The mastery-driven scheduler (plan §10) replaces the ordering in M3; the
 * availability filtering stays.
 */
export function buildSessionQueue(
  items: readonly ActivityItem[],
  ctx: {
    registry: ActivityRegistry;
    capabilities: CapabilitySnapshot;
    hasAsset: (assetId: string) => boolean;
    sessionSeed: number;
    maxItems: number;
    types?: readonly string[];
  },
): SessionQueue {
  const playable: ActivityItem[] = [];
  const hidden: SessionQueue['hidden'] = [];
  for (const item of items) {
    if (ctx.types && !ctx.types.includes(item.type)) continue;
    if (!ctx.registry.has(item.type, item.version)) {
      hidden.push({
        activityId: item.activityId,
        reason: 'unregistered',
        detail: `${item.type}@${item.version}`,
      });
      continue;
    }
    const def = ctx.registry.resolve(item.type, item.version);
    const availability = checkAvailability(
      def.requiredCapabilities,
      def.optionalCapabilities,
      ctx.capabilities,
    );
    if (!availability.playable) {
      hidden.push({
        activityId: item.activityId,
        reason: 'missing_capability',
        detail: availability.missing.join(','),
      });
      continue;
    }
    let config: unknown;
    try {
      config = def.validateConfig(item.config);
    } catch (e) {
      hidden.push({
        activityId: item.activityId,
        reason: 'invalid_config',
        detail: (e as Error).message,
      });
      continue;
    }
    const missing = def.requiredAssetIds(config).filter((id) => !ctx.hasAsset(id));
    if (missing.length > 0) {
      hidden.push({
        activityId: item.activityId,
        reason: 'missing_asset',
        detail: missing.join(','),
      });
      continue;
    }
    playable.push(item);
  }
  const ordered = shuffle(playable, createRng(deriveSeed(ctx.sessionSeed, 'queue')));
  return { items: ordered.slice(0, Math.max(0, ctx.maxItems)), hidden };
}

export interface AttemptRecord {
  attemptId: string;
  activityId: string;
  activityType: string;
  activityVersion: number;
  inputSource: InputSource;
  result: EvaluationResult;
  responseMs: number | null;
  completedAtMs: number;
}

export interface ActivityRun<TState> {
  readonly state: TState;
  readonly evaluation: EvaluationResult | null;
  dispatch(payload: unknown, source?: InputSource): AttemptRecord | null;
}

/**
 * Drives one activity item. Each new submission yields exactly one AttemptRecord with a
 * deterministic id (`session:activity:n`), so a duplicate tap or a replay after an app kill
 * is absorbed by the repository's attemptId idempotency.
 */
export function startActivityRun<TConfig, TState>(
  def: ActivityDefinition<TConfig, TState>,
  item: ActivityItem,
  ctx: { sessionId: string; sessionSeed: number; now: () => number },
): ActivityRun<TState> {
  const config = def.validateConfig(item.config);
  let state = def.createInitialState(config, deriveSeed(ctx.sessionSeed, item.activityId));
  let evaluation: EvaluationResult | null = null;
  let eventSeq = 0;
  let shownAtMs = ctx.now();

  return {
    get state() {
      return state;
    },
    get evaluation() {
      return evaluation;
    },
    dispatch(payload, source = 'touch') {
      if (!def.supportedSources.includes(source)) return null;
      const before = def.submissionCount(state);
      const event: GameEvent = {
        eventId: `${ctx.sessionId}:${item.activityId}:e${eventSeq++}`,
        sessionId: ctx.sessionId,
        activityId: item.activityId,
        source,
        kind: 'letter',
        payload,
        occurredAtMs: ctx.now(),
      };
      state = def.reduce(state, event);
      evaluation = def.evaluate(state, config);
      const after = def.submissionCount(state);
      if (after === before || !evaluation) return null;
      const record: AttemptRecord = {
        attemptId: `${ctx.sessionId}:${item.activityId}:${after}`,
        activityId: item.activityId,
        activityType: def.type,
        activityVersion: def.version,
        inputSource: source,
        result: evaluation,
        responseMs: Math.max(0, event.occurredAtMs - shownAtMs),
        completedAtMs: event.occurredAtMs,
      };
      shownAtMs = event.occurredAtMs;
      return record;
    },
  };
}
