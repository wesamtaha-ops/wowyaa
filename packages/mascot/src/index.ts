import type { EvaluationResult } from '@huroofi/content-schema';
import { motion, type MascotState } from '@huroofi/design-system';

/**
 * Faseeh's behaviour (plan §4, §8), independent of art. The app renders whatever visuals
 * exist for a state; this module decides which state and how it may move.
 */

export type MascotCue =
  | { kind: 'idle' }
  | { kind: 'prompt' }
  | { kind: 'hint' }
  | { kind: 'evaluated'; result: EvaluationResult; wrongStreak: number }
  | { kind: 'session_complete' };

export function mascotStateFor(cue: MascotCue): MascotState {
  switch (cue.kind) {
    case 'idle':
      return 'neutral';
    case 'prompt':
      return 'asking';
    case 'hint':
      return 'thinking';
    case 'session_complete':
      return 'celebratory';
    case 'evaluated':
      if (cue.result.status === 'correct') return 'celebratory';
      if (cue.result.status === 'indeterminate') return 'thinking';
      // Repeated misses switch from correcting to cheering the child on (no shaming).
      return cue.wrongStreak >= 2 ? 'encouraging' : 'gently_correcting';
  }
}

export type MascotMotion =
  { kind: 'none' } | { kind: 'bounce' | 'nod' | 'tilt'; durationMs: number; repeat: number };

const MOVES: Record<MascotState, Exclude<MascotMotion, { kind: 'none' }> | null> = {
  neutral: null,
  asking: { kind: 'tilt', durationMs: motion.durationMs.normal, repeat: 1 },
  thinking: { kind: 'tilt', durationMs: motion.durationMs.normal, repeat: 1 },
  celebratory: { kind: 'bounce', durationMs: motion.durationMs.celebratory, repeat: 2 },
  encouraging: { kind: 'nod', durationMs: motion.durationMs.normal, repeat: 2 },
  gently_correcting: { kind: 'nod', durationMs: motion.durationMs.normal, repeat: 1 },
};

/** With reduced motion the state still changes (pose, label) but nothing travels. */
export function mascotMotionFor(state: MascotState, reduceMotion: boolean): MascotMotion {
  const move = MOVES[state];
  return reduceMotion || !move ? { kind: 'none' } : move;
}
