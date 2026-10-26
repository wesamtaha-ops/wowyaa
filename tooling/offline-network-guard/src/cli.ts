import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { scanAppConfig, scanManifest, scanSource, type Finding } from './rules';

const root = resolve(import.meta.dirname, '../../..');
const SOURCE_DIRS = ['packages', 'apps/mobile/src', 'apps/mobile/index.ts'];
const SKIP = new Set(['node_modules', 'test', 'dist', '.turbo', 'android', 'ios']);

function* walk(path: string): Generator<string> {
  const st = statSync(path);
  if (st.isFile()) {
    if (/\.(ts|tsx|js|jsx)$/.test(path)) yield path;
    return;
  }
  for (const name of readdirSync(path)) {
    if (SKIP.has(name)) continue;
    yield* walk(join(path, name));
  }
}

const findings: Finding[] = [];
let files = 0;
for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(root, dir))) {
    files++;
    findings.push(...scanSource(relative(root, file), readFileSync(file, 'utf8')));
  }
}
const manifests = [
  'package.json',
  'apps/mobile/package.json',
  ...readdirSync(join(root, 'packages')).map((p) => `packages/${p}/package.json`),
];
for (const m of manifests)
  findings.push(...scanManifest(m, JSON.parse(readFileSync(join(root, m), 'utf8'))));
findings.push(
  ...scanAppConfig(
    'apps/mobile/app.json',
    JSON.parse(readFileSync(join(root, 'apps/mobile/app.json'), 'utf8')),
  ),
);

console.log(
  `offline-network-guard: scanned ${files} source files, ${manifests.length} manifests, app.json`,
);
for (const f of findings)
  console.log(`  ${f.rule} ${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);
console.log(
  findings.length === 0
    ? '  OK: no network calls, tracking SDKs or sensitive permissions'
    : `  FAILED: ${findings.length} finding(s)`,
);
process.exitCode = findings.length === 0 ? 0 : 1;
