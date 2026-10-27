import {
  CapabilityRegistry,
  buildSessionQueue,
  startActivityRun,
  type ActivityDefinition,
  type ActivityRun,
  type AttemptRecord,
  type SessionQueue,
} from '@huroofi/activity-sdk';
import type { ActivityItem, InputSource, RecordAttemptOutcome } from '@huroofi/content-schema';
import { schedulerV1, type SessionPlan } from '@huroofi/learning-engine';
import type { BootedApp } from '../bootstrap';

export interface CurrentActivity {
  item: ActivityItem;
  def: ActivityDefinition<unknown, unknown>;
  run: ActivityRun<unknown>;
  /** Position in the queue, from 0. */
  index: number;
  total: number;
  /** Why the scheduler picked this item (plan §17 item 7). */
  reasonCodes: string[];
}

export interface PlaySession {
  readonly sessionId: string;
  readonly hidden: SessionQueue['hidden'];
  readonly excluded: SessionPlan['excluded'];
  current(): CurrentActivity | null;
  /**
   * Applies one input. A new submission is persisted before this resolves, and a repeated
   * tap that doesn't change the submission count records nothing.
   */
  dispatch(
    payload: unknown,
    source?: InputSource,
  ): Promise<{ record: AttemptRecord; outcome: RecordAttemptOutcome } | null>;
  /** Moves to the next item; false when the queue is finished. */
  next(): boolean;
  finish(status: 'complete' | 'abandoned'): Promise<void>;
}

export const SESSION_LENGTH = 5;

/**
 * Glue between the activity runtime, the scheduler and local storage for one child's play
 * session. Availability (capabilities, bundled audio) filters first; scheduler-v1 then
 * orders what's left from the child's stored mastery (plan §10).
 */
export async function startPlaySession(
  app: BootedApp,
  opts: {
    childId: string;
    seed: number;
    now: () => number;
    maxItems?: number;
    /** Restrict to some activity types (tests, focused practice). */
    types?: readonly string[];
  },
): Promise<PlaySession> {
  const caps = new CapabilityRegistry();
  caps.set('touchReady', true);
  caps.set('audioReady', true);
  caps.set('geometryTraceReady', true);
  // digitalInkReady stays false until the native spike passes (docs/m3/proposal.md).
  const available = buildSessionQueue(app.pack.activities, {
    registry: app.registry,
    capabilities: caps.snapshot(),
    hasAsset: (id) => app.audioCatalog.has(id),
    sessionSeed: opts.seed,
    maxItems: Number.MAX_SAFE_INTEGER,
    ...(opts.types && { types: opts.types }),
  });
  const child = (await app.repo.listChildren()).find((c) => c.id === opts.childId);
  if (!child) throw new Error(`unknown child ${opts.childId}`);
  const plan = schedulerV1.plan({
    skills: app.pack.skills,
    activities: available.items,
    states: await app.repo.getMastery(opts.childId),
    ageBand: child.ageBand,
    sessionSeed: opts.seed,
    nowMs: opts.now(),
    length: opts.maxItems ?? SESSION_LENGTH,
  });
  const byId = new Map(available.items.map((i) => [i.activityId, i]));
  const queue = {
    items: plan.items.flatMap((p) => byId.get(p.activityId) ?? []),
    reasons: new Map(plan.items.map((p) => [p.activityId, p.reasonCodes])),
    hidden: available.hidden,
  };
  const sessionId = await app.repo.startSession(opts.childId, opts.seed);

  let index = 0;
  let active: CurrentActivity | null = null;
  const open = (): CurrentActivity | null => {
    const item = queue.items[index];
    if (!item) return null;
    const def = app.registry.resolve(item.type, item.version) as ActivityDefinition<
      unknown,
      unknown
    >;
    const run = startActivityRun(def, item, {
      sessionId,
      sessionSeed: opts.seed,
      now: opts.now,
    });
    return {
      item,
      def,
      run,
      index,
      total: queue.items.length,
      reasonCodes: queue.reasons.get(item.activityId) ?? [],
    };
  };
  active = open();

  // Writes are chained so attempts land in submission order even under fast taps.
  let writes: Promise<unknown> = Promise.resolve();

  return {
    sessionId,
    hidden: queue.hidden,
    excluded: plan.excluded,
    current: () => active,
    dispatch(payload, source) {
      const record = active?.run.dispatch(payload, source);
      if (!record) return Promise.resolve(null);
      const write = writes.then(() =>
        app.repo.recordAttempt({
          ...record,
          sessionId,
          childId: opts.childId,
          contentVersion: app.pack.version,
        }),
      );
      writes = write.catch(() => undefined);
      return write.then((outcome) => ({ record, outcome }));
    },
    next() {
      index += 1;
      active = open();
      return active !== null;
    },
    async finish(status) {
      await writes;
      await app.repo.endSession(sessionId, status);
    },
  };
}
