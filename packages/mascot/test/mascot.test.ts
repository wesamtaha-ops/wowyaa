import { describe, expect, it } from 'vitest';
import type { EvaluationResult } from '@huroofi/content-schema';
import { mascotStates } from '@huroofi/design-system';
import { mascotMotionFor, mascotStateFor } from '../src';

const result = (status: EvaluationResult['status']): EvaluationResult => ({
  status,
  targetSkillIds: ['skill.x'],
  feedbackKey: 'k',
  errorCodes: [],
  hintsUsed: 0,
  scoreDelta: 0,
  provenance: 'deterministic',
});

describe('mascot', () => {
  it('celebrates correct answers and corrects gently, then encourages', () => {
    expect(mascotStateFor({ kind: 'evaluated', result: result('correct'), wrongStreak: 0 })).toBe(
      'celebratory',
    );
    expect(mascotStateFor({ kind: 'evaluated', result: result('incorrect'), wrongStreak: 1 })).toBe(
      'gently_correcting',
    );
    expect(mascotStateFor({ kind: 'evaluated', result: result('incorrect'), wrongStreak: 2 })).toBe(
      'encouraging',
    );
    expect(
      mascotStateFor({ kind: 'evaluated', result: result('indeterminate'), wrongStreak: 0 }),
    ).toBe('thinking');
    expect(mascotStateFor({ kind: 'prompt' })).toBe('asking');
    expect(mascotStateFor({ kind: 'hint' })).toBe('thinking');
  });

  it('never moves with reduced motion', () => {
    for (const state of mascotStates) {
      expect(mascotMotionFor(state, true)).toEqual({ kind: 'none' });
    }
    expect(mascotMotionFor('celebratory', false)).toMatchObject({ kind: 'bounce' });
    expect(mascotMotionFor('neutral', false)).toEqual({ kind: 'none' });
  });
});
