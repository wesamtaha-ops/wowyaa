import { describe, expect, it } from 'vitest';
import type { ActivityItem } from '@huroofi/content-schema';
import {
  CapabilityRegistry,
  buildSessionQueue,
  createActivityRegistry,
  startActivityRun,
  type ActivityDefinition,
} from '../src';

interface CounterState {
  picks: string[];
}
// Minimal activity: needs an asset, and "choose" submits.
const pick: ActivityDefinition<{ answer: string; audio: string }, CounterState> = {
  type: 'pick',
  version: 1,
  supportedSources: ['touch'],
  requiredCapabilities: ['touchReady'],
  optionalCapabilities: [],
  validateConfig: (raw) => {
    const c = raw as { answer?: string; audio?: string };
    if (!c.answer || !c.audio) throw new Error('bad config');
    return { answer: c.answer, audio: c.audio };
  },
  createInitialState: () => ({ picks: [] }),
  reduce: (s, e) => ({ picks: [...s.picks, String((e.payload as { v: string }).v)] }),
  evaluate: (s, c) =>
    s.picks.length === 0
      ? null
      : {
          status: s.picks.at(-1) === c.answer ? 'correct' : 'incorrect',
          targetSkillIds: ['skill.x'],
          feedbackKey: 'k',
          errorCodes: [],
          hintsUsed: 0,
          scoreDelta: 0,
          provenance: 'deterministic',
        },
  submissionCount: (s) => s.picks.length,
  requiredAssetIds: (c) => [c.audio],
};

const item = (id: string, config: object, type = 'pick'): ActivityItem => ({
  activityId: id,
  type: type as ActivityItem['type'],
  version: 1,
  purpose: 'practice',
  targetSkillIds: ['skill.x'],
  config,
});

const registry = createActivityRegistry();
registry.register(pick);
const caps = new CapabilityRegistry();
caps.set('touchReady', true);

describe('buildSessionQueue', () => {
  const items = [
    item('a', { answer: '1', audio: 'audio.ok' }),
    item('b', { answer: '1', audio: 'audio.missing' }),
    item('c', { answer: '1' }),
    item('d', {}, 'trace_letter'),
    item('e', { answer: '2', audio: 'audio.ok' }),
  ];
  const ctx = {
    registry,
    capabilities: caps.snapshot(),
    hasAsset: (id: string) => id === 'audio.ok',
    sessionSeed: 5,
    maxItems: 10,
  };

  it('hides items it cannot run, with a reason', () => {
    const q = buildSessionQueue(items, ctx);
    expect(q.items.map((i) => i.activityId).sort()).toEqual(['a', 'e']);
    expect(q.hidden.map((h) => [h.activityId, h.reason])).toEqual([
      ['b', 'missing_asset'],
      ['c', 'invalid_config'],
      ['d', 'unregistered'],
    ]);
  });

  it('hides everything when a required capability is missing', () => {
    const q = buildSessionQueue(items, {
      ...ctx,
      capabilities: new CapabilityRegistry().snapshot(),
    });
    expect(q.items).toEqual([]);
    expect(q.hidden.filter((h) => h.reason === 'missing_capability')).toHaveLength(4);
  });

  it('is deterministic for a seed and respects the cap and type filter', () => {
    expect(buildSessionQueue(items, ctx).items).toEqual(buildSessionQueue(items, ctx).items);
    expect(buildSessionQueue(items, { ...ctx, maxItems: 1 }).items).toHaveLength(1);
    expect(buildSessionQueue(items, { ...ctx, types: ['other'] }).items).toEqual([]);
  });
});

describe('startActivityRun', () => {
  it('emits one record per submission with deterministic ids and response time', () => {
    let t = 1000;
    const run = startActivityRun(pick, item('a', { answer: '1', audio: 'audio.ok' }), {
      sessionId: 's1',
      sessionSeed: 1,
      now: () => (t += 500),
    });
    const r1 = run.dispatch({ v: '2' });
    const r2 = run.dispatch({ v: '1' });
    expect(r1).toMatchObject({
      attemptId: 's1:a:1',
      result: { status: 'incorrect' },
      responseMs: 500,
    });
    expect(r2).toMatchObject({
      attemptId: 's1:a:2',
      result: { status: 'correct' },
      responseMs: 500,
    });
    expect(run.evaluation?.status).toBe('correct');
  });

  it('returns null for events that do not submit or use an unsupported source', () => {
    const noSubmit: ActivityDefinition<{ answer: string; audio: string }, CounterState> = {
      ...pick,
      submissionCount: () => 0,
    };
    const run = startActivityRun(noSubmit, item('a', { answer: '1', audio: 'x' }), {
      sessionId: 's',
      sessionSeed: 1,
      now: () => 0,
    });
    expect(run.dispatch({ v: '1' })).toBeNull();
    expect(run.dispatch({ v: '1' }, 'handwriting')).toBeNull();
  });
});
