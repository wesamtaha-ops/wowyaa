import { describe, expect, it } from 'vitest';
import type { CurriculumPack, GameEvent } from '@huroofi/content-schema';
import { replayActivity } from '@huroofi/activity-sdk';
import {
  CONSTRUCT_WORD_TYPE,
  constructWord,
  type ConstructWordConfig,
} from '@huroofi/activities-word';
import { AR_FOUNDATIONS_V1_RAW, findCycles, validatePack, type ConfigValidators } from '../src';

const validators: ConfigValidators = new Map([
  [`${CONSTRUCT_WORD_TYPE}@1`, (raw: unknown) => constructWord.validateConfig(raw)],
]);
const clone = (): CurriculumPack => structuredClone(AR_FOUNDATIONS_V1_RAW) as CurriculumPack;
const codes = (issues: { code: string }[]) => [...new Set(issues.map((i) => i.code))].sort();

describe('ar-foundations-v1 draft pack', () => {
  const report = validatePack(AR_FOUNDATIONS_V1_RAW, {
    mode: 'draft',
    configValidators: validators,
  });

  it('has no structural errors in draft mode', () => {
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('covers the plan inventory: 28 letters, 12 sound and 12 tracing sets', () => {
    const pack = report.pack as CurriculumPack;
    expect(pack.letters).toHaveLength(28);
    expect(pack.confusionSets.filter((s) => s.kind === 'sound_discrimination')).toHaveLength(12);
    expect(pack.confusionSets.filter((s) => s.kind === 'tracing')).toHaveLength(12);
    const traced = new Set(
      pack.confusionSets.filter((s) => s.kind === 'tracing').flatMap((s) => s.letterIds),
    );
    expect(traced.size).toBe(28);
  });

  it('maps all three activity types to skills (M0 exit gate)', () => {
    const pack = report.pack as CurriculumPack;
    const types = new Set(pack.activities.map((a) => a.type));
    expect([...types].sort()).toEqual(['construct_word', 'match_sound_letter', 'trace_letter']);
  });

  it('surfaces editorial gaps as warnings, not silence', () => {
    expect(codes(report.warnings)).toEqual(
      expect.arrayContaining([
        'missing_assets',
        'unreviewed_skill',
        'unreviewed_word',
        'config_unvalidated',
      ]),
    );
  });

  it('cannot pass release validation while unreviewed', () => {
    const release = validatePack(AR_FOUNDATIONS_V1_RAW, {
      mode: 'release',
      configValidators: validators,
    });
    expect(release.ok).toBe(false);
    expect(codes(release.errors)).toEqual(
      expect.arrayContaining(['pack_not_reviewed', 'missing_assets', 'unreviewed_word']),
    );
  });

  it('solves every construct_word answer key across seeds (plan §8.1: 100% of answer keys)', () => {
    const items = (report.pack as CurriculumPack).activities.filter(
      (a) => a.type === CONSTRUCT_WORD_TYPE,
    );
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      for (const seed of [0, 1, 42, 2026, -7]) {
        const cfg = constructWord.validateConfig(item.config) as ConstructWordConfig;
        const s0 = constructWord.createInitialState(cfg, seed);
        const used = new Set<string>();
        const events: GameEvent[] = cfg.answer.map((letterId, slotIndex) => {
          const tile = s0.tiles.find((t) => t.letterId === letterId && !used.has(t.tileId));
          if (!tile) throw new Error(`${item.activityId}: unsolvable for seed ${seed}`);
          used.add(tile.tileId);
          return ev(item.activityId, { action: 'place', tileId: tile.tileId, slotIndex });
        });
        events.push(ev(item.activityId, { action: 'submit' }));
        const { evaluation } = replayActivity(constructWord, item.config, seed, events);
        expect(evaluation?.status, `${item.activityId} seed ${seed}`).toBe('correct');
      }
    }
  });
});

describe('validator rules', () => {
  it('rejects words that rely on untaught features', () => {
    const pack = clone();
    pack.activities.push({
      activityId: 'act.construct.shams.bad',
      type: 'construct_word',
      version: 1,
      purpose: 'practice',
      targetSkillIds: [
        'decode.cvcvc_fatha',
        'letter.shin.sound',
        'letter.mim.sound',
        'letter.sin.sound',
      ],
      config: {
        wordId: 'word.shams',
        answer: ['letter.shin', 'letter.mim', 'letter.sin'],
        distractors: [],
        targetSkillIds: [
          'decode.cvcvc_fatha',
          'letter.shin.sound',
          'letter.mim.sound',
          'letter.sin.sound',
        ],
        dotFamilies: {},
      },
    });
    const r = validatePack(pack, { mode: 'draft', configValidators: validators });
    expect(r.errors.map((e) => e.message)).toEqual([
      expect.stringMatching(/word\.shams uses sukun/),
    ]);
  });

  it('rejects letters whose sound is neither targeted nor prerequisite', () => {
    const pack = clone();
    const item = pack.activities.find((a) => a.activityId === 'act.construct.qamar');
    if (!item) throw new Error('fixture missing');
    item.targetSkillIds = ['decode.cvcvc_fatha'];
    (item.config as ConstructWordConfig).targetSkillIds = ['decode.cvcvc_fatha'];
    const r = validatePack(pack, { mode: 'draft', configValidators: validators });
    expect(codes(r.errors)).toEqual(['untaught_letter']);
  });

  it('detects prerequisite cycles', () => {
    const pack = clone();
    const fatha = pack.skills.find((s) => s.skillId === 'vowel.fatha');
    if (!fatha) throw new Error('fixture missing');
    fatha.prerequisites = ['decode.cvcvc_fatha'];
    expect(findCycles(pack.skills)).toEqual([['vowel.fatha', 'decode.cvcvc_fatha', 'vowel.fatha']]);
    expect(codes(validatePack(pack, { mode: 'draft' }).errors)).toContain('prerequisite_cycle');
  });

  it('rejects answer keys that drift from the word', () => {
    const pack = clone();
    const item = pack.activities.find((a) => a.activityId === 'act.construct.samak');
    (item?.config as ConstructWordConfig).answer = ['letter.sin', 'letter.mim', 'letter.qaf'];
    expect(
      codes(validatePack(pack, { mode: 'draft', configValidators: validators }).errors),
    ).toContain('answer_key_mismatch');
  });

  it('rejects inconsistent word spellings and non-NFC text', () => {
    const pack = clone();
    const w = pack.words.find((x) => x.wordId === 'word.qamar');
    if (!w) throw new Error('fixture missing');
    w.canonical = 'قمل';
    expect(codes(validatePack(pack, { mode: 'draft' }).errors)).toEqual(
      expect.arrayContaining(['canonical_mismatch', 'letters_mismatch']),
    );
    const nfd = clone();
    const t = nfd.words.find((x) => x.wordId === 'word.tuffah');
    if (!t) throw new Error('fixture missing');
    t.display = 'تُفَّاح'
      .normalize('NFD')
      .split('')
      .reverse()
      .join('')
      .split('')
      .reverse()
      .join('');
    t.display = t.display.replace('َّ', 'َّ');
    expect(codes(validatePack(nfd, { mode: 'draft' }).errors)).toContain('schema');
  });

  it('rejects match items whose answer is not offered', () => {
    const pack = clone();
    const item = pack.activities.find((a) => a.type === 'match_sound_letter');
    if (!item) throw new Error('fixture missing');
    (item.config as { answerLetterId: string }).answerLetterId = 'letter.mim';
    expect(codes(validatePack(pack, { mode: 'draft' }).errors)).toContain('answer_not_in_choices');
  });

  it('rejects dot-family sets that mix families', () => {
    const pack = clone();
    const set = pack.confusionSets.find((s) => s.rationale === 'dot_family');
    set?.letterIds.push('letter.mim');
    expect(codes(validatePack(pack, { mode: 'draft' }).errors)).toContain('dot_family_mismatch');
  });

  it('reports unresolved assets against a manifest', () => {
    const r = validatePack(AR_FOUNDATIONS_V1_RAW, {
      mode: 'draft',
      assets: { packId: 'ar-foundations-v1', contentVersion: '1.0.0', assets: [] },
    });
    expect(r.warnings.find((w) => w.code === 'missing_assets')?.message).toMatch(/do not resolve/);
  });
});

let n = 0;
function ev(activityId: string, payload: unknown): GameEvent {
  return {
    eventId: `e${n++}`,
    sessionId: 's',
    activityId,
    source: 'touch',
    kind: 'letter',
    payload,
    occurredAtMs: n,
  };
}
