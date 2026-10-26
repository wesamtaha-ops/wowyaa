import { describe, expect, it } from 'vitest';
import {
  AssetEntrySchema,
  ContentIdSchema,
  EvaluationResultSchema,
  GameEventSchema,
  MasteryStateSchema,
  NfcTextSchema,
} from '../src';

describe('content-schema contracts', () => {
  it('accepts a canonical game event and rejects out-of-range confidence', () => {
    const event = {
      eventId: 'e1',
      sessionId: 's1',
      activityId: 'act.construct.qamar',
      source: 'touch',
      kind: 'letter',
      payload: { action: 'submit' },
      occurredAtMs: 1_790_000_000_000,
    };
    expect(GameEventSchema.parse(event)).toEqual(event);
    expect(GameEventSchema.safeParse({ ...event, confidence: 1.2 }).success).toBe(false);
    expect(GameEventSchema.safeParse({ ...event, source: 'camera' }).success).toBe(false);
    expect(GameEventSchema.safeParse({ ...event, occurredAtMs: 1.5 }).success).toBe(false);
  });

  it('supports the indeterminate outcome and requires target skills', () => {
    const result = {
      status: 'indeterminate',
      targetSkillIds: ['letter.ba.trace'],
      feedbackKey: 'trace.try_again',
      errorCodes: [],
      hintsUsed: 0,
      scoreDelta: 0,
      provenance: 'hybrid',
    };
    expect(EvaluationResultSchema.safeParse(result).success).toBe(true);
    expect(EvaluationResultSchema.safeParse({ ...result, targetSkillIds: [] }).success).toBe(false);
  });

  it('requires NFC text', () => {
    const nfc = 'تُفَّاح'.normalize('NFC');
    expect(NfcTextSchema.safeParse(nfc).success).toBe(true);
    expect(NfcTextSchema.safeParse(nfc.replace('َّ', 'َّ')).success).toBe(false);
  });

  it('constrains content ids to stable slugs', () => {
    expect(ContentIdSchema.safeParse('letter.ba.sound').success).toBe(true);
    expect(ContentIdSchema.safeParse('Letter Ba').success).toBe(false);
  });

  it('requires duration for audio assets and confines paths to the pack', () => {
    const asset = {
      assetId: 'audio.letter.ba.sound',
      locale: 'ar',
      contentVersion: '1.0.0',
      sha256: 'f'.repeat(64),
      mime: 'audio/mp4',
      sizeBytes: 1200,
      durationMs: 640,
      license: 'commissioned',
      credit: 'TBD voice talent',
      relativePath: 'audio/letters/ba.m4a',
    };
    expect(AssetEntrySchema.safeParse(asset).success).toBe(true);
    const { durationMs: _omit, ...noDuration } = asset;
    expect(AssetEntrySchema.safeParse(noDuration).success).toBe(false);
    expect(AssetEntrySchema.safeParse({ ...asset, relativePath: '../secrets' }).success).toBe(
      false,
    );
  });

  it('bounds mastery to 0..1', () => {
    const state = {
      childId: 'c',
      skillId: 'vowel.fatha',
      mastery: 0.25,
      exposures: 0,
      correct: 0,
      incorrect: 0,
      consecutiveCorrect: 0,
      lastPracticedAtMs: null,
      nextReviewAtMs: null,
      algorithmVersion: 'mastery-v1',
    };
    expect(MasteryStateSchema.safeParse(state).success).toBe(true);
    expect(MasteryStateSchema.safeParse({ ...state, mastery: 1.01 }).success).toBe(false);
  });
});
