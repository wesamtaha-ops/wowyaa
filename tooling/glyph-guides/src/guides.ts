import type { TraceGuide, TraceMark } from '@huroofi/content-schema';
import {
  components,
  flatten,
  maskFrom,
  rasterize,
  thin,
  toHexRows,
  type PathCommand,
  type Point,
} from './raster';

export const GRID = 64;
/** Space kept around the glyph so tracing near the edge still lands on the canvas. */
const MARGIN = 0.12;
/** Components smaller than this share of the largest are treated as dots/marks, not body. */
const MARK_RATIO = 0.25;

export interface GlyphOutline {
  commands: PathCommand[];
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

/** Builds one guide from a glyph outline in font units (y down). */
export function buildGuide(
  letter: { letterId: string; glyph: string },
  outline: GlyphOutline,
): TraceGuide {
  const { x1, y1, x2, y2 } = outline.bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  if (!(w > 0 && h > 0)) throw new Error(`${letter.letterId}: empty glyph outline`);
  const scale = (1 - 2 * MARGIN) / Math.max(w, h);
  const ox = (1 - w * scale) / 2;
  const oy = (1 - h * scale) / 2;
  const map = (x: number, y: number): Point => [ox + (x - x1) * scale, oy + (y - y1) * scale];

  const contours = flatten(outline.commands, map);
  const mask = rasterize(contours, GRID);
  const parts = components(mask);
  const largest = parts[0]?.cells.length ?? 0;
  if (largest === 0) throw new Error(`${letter.letterId}: glyph rasterized to nothing`);

  const bodyCells = parts
    .filter((p) => p.cells.length >= largest * MARK_RATIO)
    .flatMap((p) => p.cells);
  const marks: TraceMark[] = parts
    .filter((p) => p.cells.length < largest * MARK_RATIO)
    .map((p) => {
      const cy = p.cells.reduce((s, [r]) => s + r + 0.5, 0) / p.cells.length;
      const cx = p.cells.reduce((s, [, c]) => s + c + 0.5, 0) / p.cells.length;
      const reach = Math.max(...p.cells.map(([r, c]) => Math.hypot(r + 0.5 - cy, c + 0.5 - cx)));
      return { cx: round(cx / GRID), cy: round(cy / GRID), r: round((reach + 0.75) / GRID) };
    })
    .sort((a, b) => a.cx - b.cx || a.cy - b.cy);

  const body = maskFrom(bodyCells, GRID);
  const skeleton: Array<[number, number]> = [];
  thin(body).forEach((row, r) =>
    row.forEach((on, c) => on && skeleton.push([round((c + 0.5) / GRID), round((r + 0.5) / GRID)])),
  );

  return {
    letterId: letter.letterId,
    glyph: letter.glyph,
    presentation: 'isolated',
    body: toHexRows(body),
    skeleton,
    marks,
    outlinePath: contours
      .map(
        (poly) =>
          `M${thinOut(poly)
            .map(([x, y]) => `${fmt(x)} ${fmt(y)}`)
            .join('L')}Z`,
      )
      .join(''),
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;
/** Display precision: 0.001 of the canvas is well under a pixel on a tablet. */
const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Drops outline points closer than ~half a display pixel to the previous kept point. */
function thinOut(poly: Point[]): Point[] {
  const kept: Point[] = [];
  for (const p of poly) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.004) kept.push(p);
  }
  return kept;
}
