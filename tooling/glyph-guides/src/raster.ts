/**
 * Turns glyph outlines into tracing guides: a filled bitmap, connected components (body vs
 * dots), and a centerline from Zhang–Suen thinning. Pure geometry, no font or file access,
 * so it can be tested with hand-made shapes.
 */

export type Point = [number, number];
/** Closed polygons in normalized space (0..1, y down). */
export type Contours = Point[][];

export type PathCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

const CURVE_STEPS = 12;

/** Flattens path commands into polygons, mapping coordinates through `map`. */
export function flatten(
  commands: readonly PathCommand[],
  map: (x: number, y: number) => Point,
): Contours {
  const contours: Contours = [];
  let current: Point[] = [];
  let pen: [number, number] = [0, 0];
  const close = () => {
    if (current.length > 2) contours.push(current);
    current = [];
  };
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        close();
        pen = [c.x, c.y];
        current.push(map(c.x, c.y));
        break;
      case 'L':
        pen = [c.x, c.y];
        current.push(map(c.x, c.y));
        break;
      case 'Q':
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          current.push(
            map(
              u * u * pen[0] + 2 * u * t * c.x1 + t * t * c.x,
              u * u * pen[1] + 2 * u * t * c.y1 + t * t * c.y,
            ),
          );
        }
        pen = [c.x, c.y];
        break;
      case 'C':
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          current.push(
            map(
              u * u * u * pen[0] + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
              u * u * u * pen[1] + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
            ),
          );
        }
        pen = [c.x, c.y];
        break;
      case 'Z':
        close();
        break;
    }
  }
  close();
  return contours;
}

/** Nonzero-winding fill sampled at cell centers. */
export function rasterize(contours: Contours, grid: number): boolean[][] {
  const out: boolean[][] = [];
  for (let row = 0; row < grid; row++) {
    const y = (row + 0.5) / grid;
    const line: boolean[] = [];
    for (let col = 0; col < grid; col++) {
      const x = (col + 0.5) / grid;
      let winding = 0;
      for (const poly of contours) {
        for (let i = 0; i < poly.length; i++) {
          const [x0, y0] = poly[i] as Point;
          const [x1, y1] = poly[(i + 1) % poly.length] as Point;
          if (y0 <= y) {
            if (y1 > y && cross(x0, y0, x1, y1, x, y) > 0) winding++;
          } else if (y1 <= y && cross(x0, y0, x1, y1, x, y) < 0) winding--;
        }
      }
      line.push(winding !== 0);
    }
    out.push(line);
  }
  return out;
}

const cross = (x0: number, y0: number, x1: number, y1: number, x: number, y: number) =>
  (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);

export interface Component {
  cells: Array<[number, number]>; // [row, col]
}

/** 8-connected components, largest first. */
export function components(mask: boolean[][]): Component[] {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const seen = mask.map((r) => r.map(() => false));
  const found: Component[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r]?.[c] || seen[r]?.[c]) continue;
      const cells: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[r, c]];
      (seen[r] as boolean[])[c] = true;
      while (stack.length) {
        const [cr, cc] = stack.pop() as [number, number];
        cells.push([cr, cc]);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            if (!mask[nr]?.[nc] || seen[nr]?.[nc]) continue;
            (seen[nr] as boolean[])[nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      found.push({ cells });
    }
  }
  return found.sort((a, b) => b.cells.length - a.cells.length);
}

/** Zhang–Suen thinning; returns a new mask one cell wide. */
export function thin(mask: boolean[][]): boolean[][] {
  const m = mask.map((r) => r.map((v) => (v ? 1 : 0)));
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const at = (r: number, c: number) =>
    r < 0 || c < 0 || r >= rows || c >= cols ? 0 : (m[r]?.[c] ?? 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const remove: Array<[number, number]> = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!at(r, c)) continue;
          const p = [
            at(r - 1, c),
            at(r - 1, c + 1),
            at(r, c + 1),
            at(r + 1, c + 1),
            at(r + 1, c),
            at(r + 1, c - 1),
            at(r, c - 1),
            at(r - 1, c - 1),
          ] as const;
          const b = p.reduce<number>((s, v) => s + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let i = 0; i < 8; i++) if (p[i] === 0 && p[(i + 1) % 8] === 1) a++;
          if (a !== 1) continue;
          const [p2, , p4, , p6, , p8] = p;
          if (
            step === 0
              ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0
              : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0
          )
            continue;
          remove.push([r, c]);
        }
      }
      for (const [r, c] of remove) (m[r] as number[])[c] = 0;
      if (remove.length) changed = true;
    }
  }
  return m.map((r) => r.map((v) => v === 1));
}

export function toHexRows(mask: boolean[][]): string[] {
  return mask.map((row) => {
    let hex = '';
    for (let i = 0; i < row.length; i += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (row[i + b] ? 1 : 0);
      hex += nibble.toString(16);
    }
    return hex;
  });
}

export function maskFrom(cells: ReadonlyArray<[number, number]>, grid: number): boolean[][] {
  const m = Array.from({ length: grid }, () => Array.from({ length: grid }, () => false));
  for (const [r, c] of cells) (m[r] as boolean[])[c] = true;
  return m;
}
