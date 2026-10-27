import { describe, expect, it } from 'vitest';
import type { ActivityItem, AgeBand, CurriculumPack, MasteryState } from '@huroofi/content-schema';
import { AR_FOUNDATIONS_V1_RAW } from '@huroofi/curriculum';
import { MASTERY_CONFIG_V1, schedulerV1 as scheduler, type SchedulerInput } from '../src';

const PACK = AR_FOUNDATIONS_V1_RAW as CurriculumPack;
const NOW = Date.UTC(2026, 9, 27);
const DAY = 86_400_000;
const ofType = (...types: string[]) => PACK.activities.filter((a) => types.includes(a.type));

const state = (skillId: string, patch: Partial<MasteryState> = {}): MasteryState => ({
  childId: 'c',
  skillId,
  mastery: MASTERY_CONFIG_V1.startingMastery,
  exposures: 0,
  correct: 0,
  incorrect: 0,
  consecutiveCorrect: 0,
  lastPracticedAtMs: null,
  nextReviewAtMs: null,
  algorithmVersion: MASTERY_CONFIG_V1.algorithmVersion,
  ...patch,
});
const mastered = (skillId: string, nextReviewAtMs = NOW + 3 * DAY) =>
  state(skillId, {
    mastery: 0.85,
    exposures: 5,
    correct: 5,
    consecutiveCorrect: 5,
    lastPracticedAtMs: NOW - DAY,
    nextReviewAtMs,
  });
const missed = (skillId: string, misses = 2) =>
  state(skillId, {
    mastery: 0.15,
    exposures: misses,
    incorrect: misses,
    lastPracticedAtMs: NOW - 1000,
    nextReviewAtMs: NOW - 1000,
  });

const input = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  skills: PACK.skills,
  activities: ofType('construct_word', 'trace_letter', 'match_sound_letter'),
  states: [],
  ageBand: '4-6' as AgeBand,
  sessionSeed: 42,
  nowMs: NOW,
  length: 5,
  ...over,
});
const ids = (items: { activityId: string }[]) => items.map((i) => i.activityId);
const typeOf = (id: string) => PACK.activities.find((a) => a.activityId === id)?.type;

describe('scheduler-v1', () => {
  it('is deterministic for equal state and seed, across a "restart"', () => {
    const a = scheduler.plan(input());
    const b = scheduler.plan(structuredClone(input()));
    expect(a).toEqual(b);
    expect(ids(scheduler.plan(input({ sessionSeed: 43 })).items)).not.toEqual(ids(a.items));
  });

  it('does not depend on the order activities are listed in', () => {
    const shuffled = input({ activities: [...input().activities].reverse() });
    expect(scheduler.plan(shuffled).items).toEqual(scheduler.plan(input()).items);
  });

  it('never repeats an activity and explains every pick', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = scheduler.plan(input({ sessionSeed: seed, length: 12 }));
      expect(new Set(ids(plan.items)).size).toBe(plan.items.length);
      for (const p of plan.items) {
        expect(p.reasonCodes[0]).toMatch(
          /^(review_due|remediation|weak_skill|new_skill|mastered)$/,
        );
        expect(p.reasonCodes).toContainEqual(expect.stringMatching(/^skill:/));
      }
    }
  });

  it('excludes out-of-age-band and locked activities, with reasons', () => {
    const young = scheduler.plan(input({ ageBand: '4-6', length: 99 }));
    expect(young.excluded).toContainEqual({
      activityId: 'act.construct.bab',
      reasonCodes: ['age_band:4-6'],
    });
    const older = scheduler.plan(input({ ageBand: '7-9', length: 99 }));
    expect(older.excluded).toContainEqual({
      activityId: 'act.construct.bab',
      reasonCodes: ['needs:decode.cvcvc_fatha'],
    });
    expect(ids(older.items)).not.toContain('act.construct.bab');

    const unlocked = scheduler.plan(
      input({ ageBand: '7-9', length: 99, states: [mastered('decode.cvcvc_fatha')] }),
    );
    expect(ids(unlocked.items)).toContain('act.construct.bab');
  });

  it('treats prerequisites with no playable activity as met (identify skills, vowels)', () => {
    const views = scheduler.skillViews(input());
    expect(views.get('letter.ba.trace')?.status).toBe('new_skill');
    expect(views.get('decode.cvcvc_fatha')?.status).toBe('new_skill');
  });

  it('puts an overdue review first, every time', () => {
    const states = ofType('trace_letter')
      .flatMap((a) => a.targetSkillIds)
      .map((id) => (id === 'letter.ba.trace' ? mastered(id, NOW - DAY) : mastered(id)));
    for (let seed = 0; seed < 30; seed++) {
      const plan = scheduler.plan(
        input({ activities: ofType('trace_letter'), states, sessionSeed: seed }),
      );
      expect(plan.items[0]?.reasonCodes.slice(0, 2)).toEqual([
        'review_due',
        'skill:letter.ba.trace',
      ]);
    }
  });

  it('queues remediation after repeated misses, including the remediation skills', () => {
    const views = scheduler.skillViews(input({ states: [missed('letter.ba.trace')] }));
    expect(views.get('letter.ba.trace')?.status).toBe('remediation');
    const plan = scheduler.plan(
      input({ activities: ofType('trace_letter'), states: [missed('letter.ba.trace')] }),
    );
    expect(ids(plan.items)).toContain('act.trace.ba-ta-tha.ba');
  });

  it('mixes types: no more than two of a kind in a row while another kind is available', () => {
    for (let seed = 0; seed < 100; seed++) {
      const plan = scheduler.plan(input({ sessionSeed: seed, length: 10 }));
      const types = ids(plan.items).map(typeOf);
      for (let i = 2; i < types.length; i++) {
        expect(types[i] === types[i - 1] && types[i] === types[i - 2], `seed ${seed}`).toBe(false);
      }
    }
  });

  it('never starves a weak skill over 100 sessions', () => {
    const traces = ofType('trace_letter');
    // Half the letters mastered, half weak: every weak one must still come up.
    const states = traces.flatMap((a, i) =>
      a.targetSkillIds.map((id) =>
        i % 2 === 0
          ? mastered(id)
          : state(id, {
              mastery: 0.4,
              exposures: 3,
              correct: 2,
              incorrect: 1,
              consecutiveCorrect: 1,
              lastPracticedAtMs: NOW - DAY,
              nextReviewAtMs: NOW + DAY,
            }),
      ),
    );
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      ids(scheduler.plan(input({ activities: traces, states, sessionSeed: seed })).items).forEach(
        (id) => seen.add(id),
      );
    }
    for (const [i, a] of traces.entries()) if (i % 2 === 1) expect(seen).toContain(a.activityId);
  });

  it('selectNext returns a single explained pick, or null when nothing is eligible', () => {
    const pick = scheduler.selectNext(input());
    expect(pick?.reasonCodes.length).toBeGreaterThan(0);
    expect(scheduler.selectNext(input({ activities: [] as ActivityItem[] }))).toBeNull();
  });
});
