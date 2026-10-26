import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildManifest, renderAudioSourcesModule, renderManifestJson } from './pipeline';

/**
 *   pnpm assets:build   regenerate the manifest and the app's audio source map
 *   pnpm assets:check   fail if either is stale or any asset is invalid (CI)
 */
const mode = process.argv[2] === 'build' ? 'build' : 'check';
const root = resolve(import.meta.dirname, '../../..');
const packDir = join(root, 'packages/curriculum/packs/ar-foundations-v1');
const pack = JSON.parse(readFileSync(join(packDir, 'pack.json'), 'utf8')) as {
  packId: string;
  version: string;
  locale: string;
};

const { manifest, errors } = buildManifest(join(packDir, 'assets'), {
  packId: pack.packId,
  contentVersion: pack.version,
  locale: pack.locale,
});

const outputs = [
  { path: join(packDir, 'asset-manifest.json'), content: renderManifestJson(manifest) },
  {
    path: join(root, 'apps/mobile/src/audio/asset-sources.generated.ts'),
    content: renderAudioSourcesModule(
      manifest,
      '../../../../packages/curriculum/packs/ar-foundations-v1/assets',
    ),
  },
];

console.log(
  `asset-pipeline (${mode}) ${pack.packId}@${pack.version}: ${manifest.assets.length} assets`,
);
for (const e of errors) console.log(`  ERROR ${e}`);

let stale = 0;
for (const out of outputs) {
  const current = existsSync(out.path) ? readFileSync(out.path, 'utf8') : null;
  if (current === out.content) continue;
  if (mode === 'build') {
    writeFileSync(out.path, out.content);
    console.log(`  wrote ${out.path.slice(root.length + 1)}`);
  } else {
    stale++;
    console.log(`  STALE ${out.path.slice(root.length + 1)} (run pnpm assets:build)`);
  }
}
process.exitCode = errors.length > 0 || stale > 0 ? 1 : 0;
