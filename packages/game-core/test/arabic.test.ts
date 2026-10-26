import { describe, expect, it } from 'vitest';
import { detectWordFeatures, segmentGraphemes, stripDiacritics } from '../src';

describe('Arabic text helpers', () => {
  it('strips diacritics for comparison only', () => {
    expect(stripDiacritics('قَمَر')).toBe('قمر');
    expect(stripDiacritics('تُفَّاح')).toBe('تفاح');
  });

  it('segments base letters with their marks in logical order', () => {
    expect(segmentGraphemes('قَمَر')).toEqual([
      { base: 'ق', marks: ['َ'] },
      { base: 'م', marks: ['َ'] },
      { base: 'ر', marks: [] },
    ]);
  });

  it.each([
    ['قَمَر', []],
    ['سَمَك', []],
    ['أَسَد', ['hamza']],
    ['بَاب', ['long_vowel']],
    ['كِتَاب', ['long_vowel']],
    ['تُفَّاح', ['long_vowel', 'shadda']],
    ['شَمْس', ['sukun']],
    ['بَيْت', ['diphthong', 'sukun']],
  ])('detects features of %s', (word, expected) => {
    expect([...detectWordFeatures(word)].sort()).toEqual([...expected].sort());
  });
});
