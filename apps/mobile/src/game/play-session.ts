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
import type { BootedApp } from '../bootstrap';

export interface CurrentActivity {
  item: ActivityItem;
  def: ActivityDefinition<unknown, unknown>;
  run: ActivityRun<unknown>;
  /** Position in the queue, from 0. */
  index: number;
  total: number;
}

export interface PlaySession {
  readonly sessionId: string;
  readonly hidden: SessionQueue['hidden'];
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
 * Glue between the activity runtime and local storage for one child's play session.
 * Ordering is the M2 rule from buildSessionQueue; mastery-driven scheduling lands in M3.
 */
export async function startPlaySession(
  app: BootedApp,
  opts: { childId: string; seed: number; now: () => number; maxItems?: number },
): Promise<PlaySession> {
  const caps = new CapabilityRegistry();
  caps.set('touchReady', true);
  caps.set('audioReady', true);
  const queue = buildSessionQueue(app.pack.activities, {
    registry: app.registry,
    capabilities: caps.snapshot(),
    hasAsset: (id) => app.audioCatalog.has(id),
    sessionSeed: opts.seed,
    maxItems: opts.maxItems ?? SESSION_LENGTH,
  });
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
    return { item, def, run, index, total: queue.items.length };
  };
  active = open();

  // Writes are chained so attempts land in submission order even under fast taps.
  let writes: Promise<unknown> = Promise.resolve();

  return {
    sessionId,
    hidden: queue.hidden,
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
