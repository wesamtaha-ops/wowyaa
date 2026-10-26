import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, durationFor, motion, touchTargets } from '../src';

describe('design tokens', () => {
  it('meets WCAG AA contrast for text and primary actions', () => {
    expect(contrastRatio(colors.textPrimary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSecondary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.retry, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.success, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('enforces plan touch-target minimums', () => {
    expect(touchTargets.minimum).toBeGreaterThanOrEqual(48);
    expect(touchTargets.preReader).toBeGreaterThanOrEqual(64);
  });

  it('has no shaming error-red token', () => {
    expect(Object.keys(colors)).not.toContain('error');
    expect(Object.keys(colors)).not.toContain('danger');
  });

  it('reduced motion removes travel for every duration', () => {
    for (const key of Object.keys(motion.durationMs) as (keyof typeof motion.durationMs)[]) {
      expect(durationFor(motion.durationMs, motion.reducedDurationMs, key, true)).toBe(0);
    }
  });

  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(() => contrastRatio('red', '#fff')).toThrow();
  });
});
