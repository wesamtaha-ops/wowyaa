import { bootstrap } from '../src/bootstrap';
import { startPlaySession } from '../src/game/play-session';
import { count, PACK, testDeps } from './helpers/harness';

jest.mock('expo-sqlite', () => ({}));

async function setup() {
  const t = testDeps();
  const app = await bootstrap(t.deps);
  const childId = await app.repo.createChild({ displayName: 'x', ageBand: '4-6' });
  return { t, app, childId };
}

describe('startPlaySession', () => {
  it('hides sound items without recordings and explains why', async () => {
    const { app, childId } = await setup();
    const session = await startPlaySession(app, { childId, seed: 7, now: () => 0, maxItems: 99 });
    const matchCount = PACK.activities.filter((a) => a.type === 'match_sound_letter').length;
    expect(session.hidden.filter((h) => h.reason === 'missing_asset')).toHaveLength(matchCount);
    expect(session.current()?.item.type).not.toBe('match_sound_letter');
  });

  it('records concurrent duplicate submits exactly once', async () => {
    const { t, app, childId } = await setup();
    const session = await startPlaySession(app, {
      childId,
      seed: 7,
      now: () => 0,
      types: ['construct_word'],
    });
    const answer = (session.current()?.item.config as { answer: string[] }).answer;
    const state = () =>
      session.current()?.run.state as { tiles: { tileId: string; letterId: string }[] };
    const used = new Set<string>();
    for (const [slotIndex, letterId] of answer.entries()) {
      const tile = state().tiles.find((x) => x.letterId === letterId && !used.has(x.tileId));
      if (!tile) throw new Error(`no tile for ${letterId}`);
      used.add(tile.tileId);
      await session.dispatch({ action: 'place', tileId: tile.tileId, slotIndex });
    }
    const results = await Promise.all([
      session.dispatch({ action: 'submit' }),
      session.dispatch({ action: 'submit' }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[0]?.outcome).toBe('recorded');
    await session.finish('complete');
    expect(await count(t.db(), 'SELECT count(*) AS n FROM activity_attempts')).toBe(1);
  });

  it('replaying a stored attempt id after a crash is absorbed as a duplicate', async () => {
    const { app, childId } = await setup();
    const a = await startPlaySession(app, { childId, seed: 3, now: () => 0 });
    const res = await a.dispatch({ action: 'submit' });
    if (!res) throw new Error('expected a recorded submission');
    expect(res.outcome).toBe('recorded');
    const again = await app.repo.recordAttempt({
      ...res.record,
      sessionId: a.sessionId,
      childId,
      contentVersion: app.pack.version,
    });
    expect(again).toBe('duplicate');
  });

  it('plans sessions from stored mastery: every pick is explained, misses come back first', async () => {
    const { app, childId } = await setup();
    const first = await startPlaySession(app, {
      childId,
      seed: 11,
      now: () => 1_000,
      types: ['trace_letter'],
    });
    const missed = first.current();
    if (!missed) throw new Error('empty session');
    expect(missed.reasonCodes[0]).toBe('new_skill');
    // Two clear misses on the same item.
    for (let i = 0; i < 2; i++) {
      await first.dispatch({
        action: 'stroke',
        points: [
          { x: 0.01, y: 0.01, tMs: 0 },
          { x: 0.99, y: 0.02, tMs: 1 },
          { x: 0.01, y: 0.03, tMs: 2 },
          { x: 0.99, y: 0.04, tMs: 3 },
        ],
      });
      const res = await first.dispatch({ action: 'submit' });
      expect(res?.record.result.status).toBe('incorrect');
      await first.dispatch({ action: 'clear' });
    }
    await first.finish('complete');

    const next = await startPlaySession(app, {
      childId,
      seed: 99,
      now: () => 2_000,
      types: ['trace_letter'],
    });
    expect(next.current()?.item.activityId).toBe(missed.item.activityId);
    expect(next.current()?.reasonCodes.slice(0, 2)).toEqual([
      'remediation',
      `skill:${missed.item.targetSkillIds[0]}`,
    ]);
  });
});
