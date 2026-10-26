import { describe, expect, it } from 'vitest';
import type { EvaluationStatus, SkillEvidence } from '@huroofi/content-schema';
import { MASTERY_CONFIG_V1, masteryUpdaterV1 as engine } from '../src';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 26);
const evidence = (outcome: EvaluationStatus, hintsUsed = 0, at = T0): SkillEvidence => ({
  attemptId: `a-${at}-${outcome}`,
  childId: 'c1',
  skillId: 'vowel.fatha',
  outcome,
  hintsUsed,
  responseMs: 1200,
  completedAtMs: at,
});

describe('mastery-v1', () => {
  const s0 = engine.initialState('c1', 'vowel.fatha');

  it('starts at the configured mastery', () => {
    expect(s0.mastery).toBe(0.25);
    expect(s0.algorithmVersion).toBe('mastery-v1');
  });

  it('rewards unaided correct work more than hinted work', () => {
    expect(engine.update(s0, evidence('correct')).mastery).toBe(0.33);
    expect(engine.update(s0, evidence('correct', 2)).mastery).toBe(0.29);
  });

  it('reduces mastery on incorrect and makes the skill due now', () => {
    const s = engine.update(s0, evidence('incorrect'));
    expect(s.mastery).toBe(0.2);
    expect(s.consecutiveCorrect).toBe(0);
    expect(s.nextReviewAtMs).toBe(T0);
  });

  it('never reduces mastery for indeterminate evidence', () => {
    const s = engine.update(s0, evidence('indeterminate'));
    expect(s.mastery).toBe(s0.mastery);
    expect(s.exposures).toBe(1);
    expect(s.correct + s.incorrect).toBe(0);
    expect(s.nextReviewAtMs).toBeNull();
  });

  it('schedules reviews at 1/3/7 days for successive successes', () => {
    let s = s0;
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      const at = T0 + i * DAY;
      s = engine.update(s, evidence('correct', 0, at));
      delays.push(((s.nextReviewAtMs ?? 0) - at) / DAY);
    }
    expect(delays).toEqual([1, 3, 7, 7]);
  });

  it('clamps to [0,1]', () => {
    let up = s0;
    let down = s0;
    for (let i = 0; i < 50; i++) {
      up = engine.update(up, evidence('correct'));
      down = engine.update(down, evidence('incorrect'));
    }
    expect(up.mastery).toBe(1);
    expect(down.mastery).toBe(0);
  });

  it('is deterministic for equal inputs and does not mutate state', () => {
    const frozen = Object.freeze({ ...s0 });
    expect(engine.update(frozen, evidence('correct'))).toEqual(
      engine.update(frozen, evidence('correct')),
    );
  });

  it('keeps lastPracticedAt monotonic with out-of-order evidence', () => {
    const late = engine.update(s0, evidence('correct', 0, T0 + DAY));
    expect(engine.update(late, evidence('correct', 0, T0)).lastPracticedAtMs).toBe(T0 + DAY);
  });

  it('refuses evidence for another child or skill', () => {
    expect(() => engine.update(s0, { ...evidence('correct'), childId: 'c2' })).toThrow();
  });

  it('exposes frozen config', () => {
    expect(Object.isFrozen(MASTERY_CONFIG_V1)).toBe(true);
  });
});
