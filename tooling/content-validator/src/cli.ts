/**
 * Curriculum quality gate for CI (plan §3.3, §15). Exit code 1 on any error.
 *   pnpm validate:content                 # draft mode (engineering)
 *   pnpm --filter @huroofi/content-validator validate:release
 */
import {
  CONSTRUCT_WORD_TYPE,
  CONSTRUCT_WORD_VERSION,
  constructWord,
} from '@huroofi/activities-word';
import { AR_FOUNDATIONS_V1_RAW, validatePack, type ValidationMode } from '@huroofi/curriculum';

const modeArg = process.argv.indexOf('--mode');
const mode: ValidationMode =
  modeArg > 0 && process.argv[modeArg + 1] === 'release' ? 'release' : 'draft';

const report = validatePack(AR_FOUNDATIONS_V1_RAW, {
  mode,
  configValidators: new Map([
    [
      `${CONSTRUCT_WORD_TYPE}@${CONSTRUCT_WORD_VERSION}`,
      (raw: unknown) => constructWord.validateConfig(raw),
    ],
  ]),
});

const summarize = (issues: { code: string }[]) =>
  Object.entries(
    issues.reduce<Record<string, number>>(
      (acc, i) => ({ ...acc, [i.code]: (acc[i.code] ?? 0) + 1 }),
      {},
    ),
  )
    .map(([code, n]) => `${code}×${n}`)
    .join(', ') || 'none';

const pack = report.pack;
console.log(
  `content-validator (${mode}) ${pack ? `${pack.packId}@${pack.version}` : '<unparseable>'}`,
);
if (pack) {
  console.log(
    `  letters=${pack.letters.length} skills=${pack.skills.length} words=${pack.words.length} ` +
      `sets=${pack.confusionSets.length} activities=${pack.activities.length}`,
  );
}
console.log(`  errors:   ${report.errors.length} (${summarize(report.errors)})`);
console.log(`  warnings: ${report.warnings.length} (${summarize(report.warnings)})`);
for (const e of report.errors.slice(0, 50))
  console.log(`  ERROR ${e.code} ${e.path}: ${e.message}`);
process.exitCode = report.ok ? 0 : 1;
