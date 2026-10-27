import type { TraceGuide } from '@huroofi/content-schema';
import type { InkPoint, InkStroke } from './geometry';

/**
 * Synthetic strokes for tests and E2E only. They follow the guide's own centerline, so they
 * prove the evaluator and answer keys are wired correctly; they are NOT child data and must
 * never be used to calibrate thresholds (plan §15).
 */
export function idealStrokes(
  guide: TraceGuide,
  options: { withMarks?: boolean } = {},
): InkStroke[] {
  const remaining = guide.skeleton.map(([x, y]) => [x, y] as [number, number]);
  const strokes: InkPoint[][] = [];
  let t = 0;
  let current: InkPoint[] = [];
  let at = remaining.shift();
  while (at) {
    current.push({ x: at[0], y: at[1], tMs: (t += 16) });
    let best = -1;
    let bestD = Infinity;
    remaining.forEach(([x, y], i) => {
      const d = Math.hypot(x - (at as [number, number])[0], y - (at as [number, number])[1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) break;
    // A jump to a far part of the letter starts a new stroke instead of drawing across it.
    if (bestD > 0.05) {
      strokes.push(current);
      current = [];
    }
    at = remaining.splice(best, 1)[0];
  }
  if (current.length) strokes.push(current);
  if (options.withMarks !== false) {
    for (const m of guide.marks) strokes.push([{ x: m.cx, y: m.cy, tMs: (t += 200) }]);
  }
  return strokes;
}

/** A zig-zag across the top of the canvas: lots of ink, almost none on any letter. */
export function scribble(): InkStroke[] {
  return [
    Array.from({ length: 40 }, (_, i) => ({
      x: i % 2 === 0 ? 0.02 : 0.98,
      y: 0.02 + i * 0.001,
      tMs: i * 16,
    })),
  ];
}
