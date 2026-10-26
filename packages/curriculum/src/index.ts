import type { CurriculumPack } from '@huroofi/content-schema';
import arFoundationsV1Json from '../packs/ar-foundations-v1/pack.json';

export * from './validate';

/**
 * Bundled seed pack. Typed loosely here on purpose: callers must run it through
 * `validatePack` (or `CurriculumPackSchema`) before trusting it.
 */
export const AR_FOUNDATIONS_V1_RAW: unknown = arFoundationsV1Json;
export type { CurriculumPack };
