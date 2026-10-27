import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import opentype from 'opentype.js';
import { TraceGuideSetSchema, type TraceGuideSet } from '@huroofi/content-schema';
import { buildGuide, GRID } from './guides';
import type { PathCommand } from './raster';

/**
 *   pnpm guides:build   regenerate trace-guides.json from the bundled OFL font
 *   pnpm guides:check   fail if trace-guides.json is stale (CI)
 */
const mode = process.argv[2] === 'build' ? 'build' : 'check';
const root = resolve(import.meta.dirname, '../../..');
const packDir = join(root, 'packages/curriculum/packs/ar-foundations-v1');
const fontPath = join(import.meta.dirname, '../fonts/NotoNaskhArabic-Regular.ttf');
const outPath = join(packDir, 'trace-guides.json');

const pack = JSON.parse(readFileSync(join(packDir, 'pack.json'), 'utf8')) as {
  packId: string;
  letters: Array<{ letterId: string; glyph: string }>;
};
const bytes = readFileSync(fontPath);
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));

const set: TraceGuideSet = TraceGuideSetSchema.parse({
  packId: pack.packId,
  grid: GRID,
  source: {
    font: 'Noto Naskh Arabic Regular',
    fontVersion: font.tables.name?.version?.en ?? 'unknown',
    license: 'SIL Open Font License 1.1 (tooling/glyph-guides/fonts/OFL.txt)',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
  guides: pack.letters.map((letter) => {
    // The cmap glyph is the isolated form; skipping text shaping keeps it that way.
    const path = font.charToGlyph(letter.glyph).getPath(0, 0, 1000);
    const bbox = path.getBoundingBox();
    return buildGuide(letter, { commands: path.commands as PathCommand[], bbox });
  }),
});

const content = `${JSON.stringify(set)}\n`;
const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
console.log(
  `glyph-guides (${mode}): ${set.guides.length} letters from ${set.source.font} ${set.source.fontVersion}`,
);
for (const g of set.guides) {
  console.log(
    `  ${g.letterId.padEnd(16)} skeleton=${String(g.skeleton.length).padStart(3)} marks=${g.marks.length}`,
  );
}
if (current !== content) {
  if (mode === 'build') {
    writeFileSync(outPath, content);
    console.log(`  wrote ${outPath.slice(root.length + 1)}`);
  } else {
    console.log('  STALE trace-guides.json (run pnpm guides:build)');
    process.exitCode = 1;
  }
}
