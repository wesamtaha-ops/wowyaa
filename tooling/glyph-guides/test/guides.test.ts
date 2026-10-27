import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TraceGuideSetSchema } from '@huroofi/content-schema';
import { buildGuide, GRID } from '../src/guides';
import { components, rasterize, thin, toHexRows, type PathCommand } from '../src/raster';

const rect = (x1: number, y1: number, x2: number, y2: number): PathCommand[] => [
  { type: 'M', x: x1, y: y1 },
  { type: 'L', x: x2, y: y1 },
  { type: 'L', x: x2, y: y2 },
  { type: 'L', x: x1, y: y2 },
  { type: 'Z' },
];

describe('raster', () => {
  it('fills polygons and splits connected components', () => {
    const mask = rasterize(
      [
        [
          [0.1, 0.1],
          [0.5, 0.1],
          [0.5, 0.5],
          [0.1, 0.5],
        ],
        [
          [0.7, 0.7],
          [0.8, 0.7],
          [0.8, 0.8],
          [0.7, 0.8],
        ],
      ],
      20,
    );
    const parts = components(mask);
    expect(parts.map((p) => p.cells.length)).toEqual([64, 4]);
  });

  it('thins a thick bar to a one-cell line', () => {
    const mask = rasterize(
      [
        [
          [0.1, 0.4],
          [0.9, 0.4],
          [0.9, 0.6],
          [0.1, 0.6],
        ],
      ],
      20,
    );
    const line = thin(mask);
    const rowsUsed = new Set(line.flatMap((row, r) => (row.some(Boolean) ? [r] : [])));
    expect(rowsUsed.size).toBeLessThanOrEqual(2);
    expect(line.flat().filter(Boolean).length).toBeGreaterThan(8);
  });

  it('encodes rows as hex with the leftmost cell as the high bit', () => {
    expect(toHexRows([[true, false, false, false, false, false, false, true]])).toEqual(['81']);
  });
});

describe('buildGuide', () => {
  it('keeps the big shape as body and small separate shapes as marks', () => {
    const guide = buildGuide(
      { letterId: 'letter.test', glyph: 'x' },
      {
        commands: [...rect(0, 0, 1000, 300), ...rect(450, 600, 550, 700)],
        bbox: { x1: 0, y1: 0, x2: 1000, y2: 700 },
      },
    );
    expect(guide.marks).toHaveLength(1);
    expect(guide.marks[0]?.cx).toBeCloseTo(0.5, 1);
    expect(guide.body).toHaveLength(GRID);
    expect(guide.skeleton.length).toBeGreaterThan(10);
  });
});

describe('bundled trace-guides.json', () => {
  const raw = JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        '../../../packages/curriculum/packs/ar-foundations-v1/trace-guides.json',
      ),
      'utf8',
    ),
  );
  const set = TraceGuideSetSchema.parse(raw);
  const marks = Object.fromEntries(set.guides.map((g) => [g.letterId, g.marks.length]));

  it('covers all 28 letters from the OFL font', () => {
    expect(set.guides).toHaveLength(28);
    expect(set.source.license).toMatch(/Open Font License/);
  });

  it('finds the dots of dotted letters and none on undotted ones', () => {
    // Dots that touch at 64x64 merge into one mark (e.g. two of shin's three dots).
    expect(marks).toMatchObject({
      'letter.alif': 0,
      'letter.ba': 1,
      'letter.ta': 2,
      'letter.tha': 3,
      'letter.hha': 0,
      'letter.kha': 1,
      'letter.sin': 0,
      'letter.qaf': 2,
      'letter.ya': 2,
    });
  });
});
