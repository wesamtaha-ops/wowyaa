import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildManifest, renderAudioSourcesModule } from '../src/pipeline';

const PACK = { packId: 'ar-foundations-v1', contentVersion: '1.0.0-draft.1', locale: 'ar' };
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function fixture(files: Record<string, string | object>) {
  const dir = mkdtempSync(join(tmpdir(), 'huroofi-assets-'));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

const meta = (assetId: string, extra: object = {}) => ({
  assetId,
  license: 'test fixture',
  credit: 'test',
  ...extra,
});

describe('asset pipeline', () => {
  it('builds a sorted manifest with checksums and sizes', () => {
    const dir = fixture({
      'audio/letters/ba.m4a': 'BA-BYTES',
      'audio/letters/ba.m4a.meta.json': meta('audio.letter.ba.sound', {
        durationMs: 640,
        transcript: 'بَ',
      }),
      'images/qamar.svg': '<svg/>',
      'images/qamar.svg.meta.json': meta('image.word.qamar'),
      'README.md': 'ignored',
    });
    const { manifest, errors } = buildManifest(dir, PACK);
    expect(errors).toEqual([]);
    expect(manifest.assets.map((a) => a.assetId)).toEqual([
      'audio.letter.ba.sound',
      'image.word.qamar',
    ]);
    expect(manifest.assets[0]).toMatchObject({
      sha256: createHash('sha256').update('BA-BYTES').digest('hex'),
      sizeBytes: 8,
      mime: 'audio/mp4',
      durationMs: 640,
      relativePath: 'audio/letters/ba.m4a',
    });
  });

  it('rejects assets without provenance or duration', () => {
    const dir = fixture({
      'a.m4a': 'x',
      'b.m4a': 'x',
      'b.m4a.meta.json': meta('audio.b'),
      'c.m4a': 'x',
      'c.m4a.meta.json': { assetId: 'audio.c', durationMs: 10, credit: 'x' },
      'orphan.mp3.meta.json': meta('audio.orphan', { durationMs: 1 }),
      'notes.txt': 'x',
    });
    const { errors, manifest } = buildManifest(dir, PACK);
    expect(manifest.assets).toEqual([]);
    expect(errors).toEqual([
      expect.stringMatching(/^a\.m4a: missing \.meta\.json/),
      expect.stringMatching(/^b\.m4a: .*durationMs/),
      expect.stringMatching(/^c\.m4a\.meta\.json: license/),
      expect.stringMatching(/^notes\.txt: unsupported/),
      expect.stringMatching(/^orphan\.mp3\.meta\.json: sidecar has no matching asset/),
    ]);
  });

  it('rejects duplicate asset ids', () => {
    const dir = fixture({
      'x.m4a': '1',
      'x.m4a.meta.json': meta('audio.dup', { durationMs: 5 }),
      'y.m4a': '2',
      'y.m4a.meta.json': meta('audio.dup', { durationMs: 5 }),
    });
    expect(buildManifest(dir, PACK).errors).toEqual([
      'duplicate assetId audio.dup in x.m4a and y.m4a',
    ]);
  });

  it('checksums change when bytes change (drift detection)', () => {
    const a = buildManifest(
      fixture({ 'x.m4a': '1', 'x.m4a.meta.json': meta('audio.x', { durationMs: 5 }) }),
      PACK,
    );
    const b = buildManifest(
      fixture({ 'x.m4a': '2', 'x.m4a.meta.json': meta('audio.x', { durationMs: 5 }) }),
      PACK,
    );
    expect(a.manifest.assets[0]?.sha256).not.toBe(b.manifest.assets[0]?.sha256);
  });

  it('renders static requires for audio only', () => {
    const dir = fixture({
      'audio/ba.m4a': 'x',
      'audio/ba.m4a.meta.json': meta('audio.letter.ba.sound', { durationMs: 5 }),
      'img.png': 'x',
      'img.png.meta.json': meta('image.x'),
    });
    const module = renderAudioSourcesModule(buildManifest(dir, PACK).manifest, '../assets');
    expect(module).toContain('"audio.letter.ba.sound": require("../assets/audio/ba.m4a"),');
    expect(module).not.toContain('image.x');
  });
});
