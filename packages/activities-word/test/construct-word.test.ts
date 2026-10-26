import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@huroofi/content-schema';
import { ActivityConfigError, replayActivity } from '@huroofi/activity-sdk';
import { constructWord, type ConstructWordAction, type ConstructWordState } from '../src';

// قَمَر — qaf, mim, ra. Distractors include fa (same dot family as qaf) and za (same as ra).
const config = {
  wordId: 'word.qamar',
  answer: ['letter.qaf', 'letter.mim', 'letter.ra'],
  distractors: ['letter.fa', 'letter.zay'],
  targetSkillIds: ['decode.cvcvc_fatha'],
  dotFamilies: {
    'letter.qaf': 'fa_qaf',
    'letter.fa': 'fa_qaf',
    'letter.ra': 'ra_zay',
    'letter.zay': 'ra_zay',
  },
};

let n = 0;
const ev = (payload: ConstructWordAction): GameEvent => ({
  eventId: `e${n++}`,
  sessionId: 's1',
  activityId: 'act.construct.qamar',
  source: 'touch',
  kind: 'letter',
  payload,
  occurredAtMs: 1_700_000_000_000 + n,
});

const tileFor = (state: ConstructWordState, letterId: string) => {
  const tile = state.tiles.find((t) => t.letterId === letterId);
  if (!tile) throw new Error(`no tile for ${letterId}`);
  return tile.tileId;
};

function spell(seed: number, letters: string[], extra: ConstructWordAction[] = []) {
  const initial = constructWord.createInitialState(constructWord.validateConfig(config), seed);
  const events = [
    ...extra.map(ev),
    ...letters.map((l, i) => ev({ action: 'place', tileId: tileFor(initial, l), slotIndex: i })),
    ev({ action: 'submit' }),
  ];
  return replayActivity(constructWord, config, seed, events);
}

describe('construct_word', () => {
  it('shuffles reproducibly from the seed', () => {
    const cfg = constructWord.validateConfig(config);
    expect(constructWord.createInitialState(cfg, 123).tiles).toEqual(
      constructWord.createInitialState(cfg, 123).tiles,
    );
  });

  it('is always solvable and never pre-spells the answer, across 1000 seeds', () => {
    const cfg = constructWord.validateConfig(config);
    for (let seed = 0; seed < 1000; seed++) {
      const s = constructWord.createInitialState(cfg, seed);
      const tray = s.tiles.map((t) => t.letterId);
      for (const l of cfg.answer) expect(tray).toContain(l);
      expect(cfg.answer.every((l, i) => tray[i] === l)).toBe(false);
    }
  });

  it('returns null while in progress', () => {
    const cfg = constructWord.validateConfig(config);
    expect(constructWord.evaluate(constructWord.createInitialState(cfg, 1), cfg)).toBeNull();
  });

  it('evaluates the correct spelling deterministically', () => {
    const { evaluation } = spell(7, config.answer);
    expect(evaluation).toEqual({
      status: 'correct',
      targetSkillIds: ['decode.cvcvc_fatha'],
      feedbackKey: 'construct_word.correct',
      errorCodes: [],
      hintsUsed: 0,
      scoreDelta: 1,
      provenance: 'deterministic',
    });
  });

  it('diagnoses dot-family confusion on the first letter', () => {
    const { evaluation } = spell(7, ['letter.fa', 'letter.mim', 'letter.ra']);
    expect(evaluation?.status).toBe('incorrect');
    expect(evaluation?.errorCodes).toEqual(['wrong_first_letter', 'dot_family_confusion']);
    expect(evaluation?.feedbackKey).toBe('construct_word.try_again.wrong_first_letter');
    expect(evaluation?.scoreDelta).toBe(0);
  });

  it('diagnoses letter-order errors', () => {
    const { evaluation } = spell(7, ['letter.qaf', 'letter.ra', 'letter.mim']);
    expect(evaluation?.errorCodes).toEqual(['letter_order']);
  });

  it('diagnoses incomplete submissions', () => {
    const { evaluation } = spell(7, ['letter.qaf']);
    expect(evaluation?.errorCodes[0]).toBe('incomplete');
  });

  it('hinted success counts as correct with reduced score', () => {
    const { evaluation, state } = spell(7, config.answer, [{ action: 'hint' }]);
    expect(evaluation?.status).toBe('correct');
    expect(evaluation?.hintsUsed).toBe(1);
    expect(evaluation?.scoreDelta).toBe(0.5);
    expect(state.hintsUsed).toBe(1);
  });

  it('hint points at a tile for the first missing letter', () => {
    const cfg = constructWord.validateConfig(config);
    const s0 = constructWord.createInitialState(cfg, 3);
    const s1 = constructWord.reduce(s0, ev({ action: 'hint' }));
    expect(s1.hintedTileId).toBe(tileFor(s0, 'letter.qaf'));
  });

  it('supports undo and retry after an incorrect submission', () => {
    const cfg = constructWord.validateConfig(config);
    let s = constructWord.createInitialState(cfg, 11);
    s = constructWord.reduce(
      s,
      ev({ action: 'place', tileId: tileFor(s, 'letter.fa'), slotIndex: 0 }),
    );
    s = constructWord.reduce(
      s,
      ev({ action: 'place', tileId: tileFor(s, 'letter.mim'), slotIndex: 1 }),
    );
    s = constructWord.reduce(
      s,
      ev({ action: 'place', tileId: tileFor(s, 'letter.ra'), slotIndex: 2 }),
    );
    s = constructWord.reduce(s, ev({ action: 'submit' }));
    expect(constructWord.evaluate(s, cfg)?.status).toBe('incorrect');
    expect(s.submissionCount).toBe(1);

    s = constructWord.reduce(s, ev({ action: 'remove', slotIndex: 0 }));
    expect(s.status).toBe('in_progress');
    expect(constructWord.evaluate(s, cfg)).toBeNull();
    s = constructWord.reduce(s, ev({ action: 'undo' }));
    expect(s.slots[0]).toBe(tileFor(s, 'letter.fa'));
    s = constructWord.reduce(
      s,
      ev({ action: 'place', tileId: tileFor(s, 'letter.qaf'), slotIndex: 0 }),
    );
    s = constructWord.reduce(s, ev({ action: 'submit' }));
    expect(constructWord.evaluate(s, cfg)?.status).toBe('correct');
    expect(s.submissionCount).toBe(2);
  });

  it('moving a placed tile vacates its previous slot', () => {
    const cfg = constructWord.validateConfig(config);
    let s = constructWord.createInitialState(cfg, 5);
    const qaf = tileFor(s, 'letter.qaf');
    s = constructWord.reduce(s, ev({ action: 'place', tileId: qaf, slotIndex: 2 }));
    s = constructWord.reduce(s, ev({ action: 'place', tileId: qaf, slotIndex: 0 }));
    expect(s.slots).toEqual([qaf, null, null]);
  });

  it('ignores malformed payloads and unknown tiles instead of crashing', () => {
    const cfg = constructWord.validateConfig(config);
    const s0 = constructWord.createInitialState(cfg, 5);
    const bad = { ...ev({ action: 'undo' }), payload: { action: 'explode' } };
    expect(constructWord.reduce(s0, bad)).toBe(s0);
    expect(constructWord.reduce(s0, ev({ action: 'place', tileId: 'nope', slotIndex: 0 }))).toBe(
      s0,
    );
    expect(constructWord.reduce(s0, ev({ action: 'place', tileId: 't0', slotIndex: 9 }))).toBe(s0);
  });

  it('ignores edits after submission except retry actions', () => {
    const { state } = spell(7, config.answer);
    expect(constructWord.reduce(state, ev({ action: 'submit' }))).toBe(state);
    expect(constructWord.reduce(state, ev({ action: 'hint' }))).toBe(state);
  });

  it('rejects ambiguous distractors', () => {
    expect(() => constructWord.validateConfig({ ...config, distractors: ['letter.mim'] })).toThrow(
      ActivityConfigError,
    );
    expect(() =>
      constructWord.validateConfig({ ...config, distractors: ['letter.fa', 'letter.fa'] }),
    ).toThrow(/unique/);
  });

  it('rejects input sources it does not support', () => {
    expect(() =>
      replayActivity(constructWord, config, 1, [
        { ...ev({ action: 'submit' }), source: 'handwriting' },
      ]),
    ).toThrow(/does not accept/);
  });
});
