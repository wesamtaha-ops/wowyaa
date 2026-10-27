import type { TraceGuide } from '@huroofi/content-schema';

/**
 * TraceGeometryEvaluator (plan §6.1, §8.3). Checks whether ink follows the letter, not
 * whether it is beautiful: centerline coverage, ink staying inside a generous corridor,
 * and dots checked separately. It never infers stroke order.
 *
 * All numbers below are hypotheses for young motor skills, to be recalibrated on consented
 * child samples (plan §15). Changing one requires a new `version`.
 */
export interface TraceGeometryConfig {
  version: string;
  /** Distance between resampled ink points (normalized units). */
  sampleSpacing: number;
  /** A centerline point counts as traced when ink passes within this distance. */
  coverRadius: number;
  /** Extra cells around the body that still count as "on the letter". */
  corridorCells: number;
  /** Extra distance around a dot that still counts as placing it. */
  markTolerance: number;
  /** Below this much ink the attempt is too short to judge. */
  minInkLength: number;
  correct: { minCoverage: number; maxOffPath: number };
  incorrect: { maxCoverage: number; minOffPath: number };
}

export const TRACE_GEOMETRY_V1: TraceGeometryConfig = Object.freeze({
  version: 'trace-geometry-v1',
  sampleSpacing: 0.01,
  coverRadius: 0.06,
  corridorCells: 4,
  markTolerance: 0.05,
  minInkLength: 0.15,
  correct: Object.freeze({ minCoverage: 0.75, maxOffPath: 0.25 }),
  incorrect: Object.freeze({ maxCoverage: 0.35, minOffPath: 0.5 }),
});

export interface InkPoint {
  x: number;
  y: number;
  tMs: number;
}
export type InkStroke = readonly InkPoint[];

export interface TraceMetrics {
  coverage: number;
  offPath: number;
  inkLength: number;
  marksPlaced: number;
  marksExpected: number;
}

export type GeometryVerdict = {
  status: 'correct' | 'incorrect' | 'indeterminate';
  errorCodes: string[];
  metrics: TraceMetrics;
};

/** Decoded once per guide; the hex body is cheap to keep but slow to test per point. */
export interface PreparedGuide {
  guide: TraceGuide;
  grid: number;
  corridor: boolean[][];
}

export function prepareGuide(
  guide: TraceGuide,
  config: TraceGeometryConfig = TRACE_GEOMETRY_V1,
): PreparedGuide {
  const grid = guide.body.length;
  const body = guide.body.map((row) =>
    [...row]
      .flatMap((h) => {
        const n = parseInt(h, 16);
        return [8, 4, 2, 1].map((bit) => (n & bit) !== 0);
      })
      .slice(0, grid),
  );
  const d = config.corridorCells;
  const corridor = body.map((row, r) =>
    row.map((_, c) => {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (dr * dr + dc * dc <= d * d && body[r + dr]?.[c + dc]) return true;
        }
      }
      return false;
    }),
  );
  return { guide, grid, corridor };
}

export function resample(strokes: readonly InkStroke[], spacing: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const stroke of strokes) {
    const first = stroke[0];
    if (!first) continue;
    out.push([first.x, first.y]);
    let carry = 0;
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1] as InkPoint;
      const b = stroke[i] as InkPoint;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      let t = spacing - carry;
      while (t <= len) {
        out.push([a.x + ((b.x - a.x) * t) / len, a.y + ((b.y - a.y) * t) / len]);
        t += spacing;
      }
      carry = len - (t - spacing);
    }
  }
  return out;
}

export function inkLength(strokes: readonly InkStroke[]): number {
  let total = 0;
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1] as InkPoint;
      const b = s[i] as InkPoint;
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return total;
}

export function evaluateGeometry(
  prepared: PreparedGuide,
  strokes: readonly InkStroke[],
  config: TraceGeometryConfig = TRACE_GEOMETRY_V1,
): GeometryVerdict {
  const { guide, grid, corridor } = prepared;
  const samples = resample(strokes, config.sampleSpacing);
  const length = inkLength(strokes);

  const near = (x: number, y: number, r: number) =>
    samples.some(([sx, sy]) => (sx - x) ** 2 + (sy - y) ** 2 <= r * r);
  const inMark = (x: number, y: number) =>
    guide.marks.some((m) => Math.hypot(x - m.cx, y - m.cy) <= m.r + config.markTolerance);
  const inCorridor = (x: number, y: number) => {
    const r = Math.min(grid - 1, Math.max(0, Math.floor(y * grid)));
    const c = Math.min(grid - 1, Math.max(0, Math.floor(x * grid)));
    return corridor[r]?.[c] === true || inMark(x, y);
  };

  const coverage =
    guide.skeleton.filter(([x, y]) => near(x, y, config.coverRadius)).length /
    guide.skeleton.length;
  const offPath =
    samples.length === 0
      ? 0
      : samples.filter(([x, y]) => !inCorridor(x, y)).length / samples.length;
  const marksPlaced = guide.marks.filter((m) =>
    near(m.cx, m.cy, m.r + config.markTolerance),
  ).length;
  const metrics: TraceMetrics = {
    coverage: round(coverage),
    offPath: round(offPath),
    inkLength: round(length),
    marksPlaced,
    marksExpected: guide.marks.length,
  };

  // Too little ink says nothing about what the child knows; never count it against them.
  if (length < config.minInkLength) {
    return { status: 'indeterminate', errorCodes: ['incomplete'], metrics };
  }
  const errorCodes: string[] = [];
  if (coverage < config.correct.minCoverage) errorCodes.push('low_coverage');
  if (offPath > config.correct.maxOffPath) errorCodes.push('off_path');
  if (marksPlaced < guide.marks.length) errorCodes.push('missing_dots');

  const clearlyWrong =
    coverage <= config.incorrect.maxCoverage || offPath >= config.incorrect.minOffPath;
  const bodyGood = coverage >= config.correct.minCoverage && offPath <= config.correct.maxOffPath;
  if (bodyGood && errorCodes.length === 0) return { status: 'correct', errorCodes, metrics };
  // A well-traced body without its dots is a different letter: that is real evidence.
  if (clearlyWrong || (bodyGood && errorCodes.includes('missing_dots'))) {
    return { status: 'incorrect', errorCodes, metrics };
  }
  return { status: 'indeterminate', errorCodes: ['borderline', ...errorCodes], metrics };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
