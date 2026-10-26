import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed, nextInt, shuffle } from '../src';

describe('seeded randomness', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });

  it('stays in [0,1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle is a reproducible permutation and does not mutate input', () => {
    const input = ['ق', 'م', 'ر', 'س', 'ك'];
    const frozen = Object.freeze(input.slice());
    const s1 = shuffle(frozen, createRng(99));
    const s2 = shuffle(frozen, createRng(99));
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual([...input].sort());
    expect(frozen).toEqual(input);
  });

  it('nextInt rejects invalid bounds', () => {
    expect(() => nextInt(createRng(1), 0)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
  });

  it('deriveSeed is stable and salt-sensitive', () => {
    expect(deriveSeed(5, 'a')).toBe(deriveSeed(5, 'a'));
    expect(deriveSeed(5, 'a')).not.toBe(deriveSeed(5, 'b'));
  });
});
