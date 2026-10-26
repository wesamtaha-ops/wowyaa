import type { ValidationMode } from '@huroofi/curriculum';

/**
 * `draft` lets engineering builds boot the unreviewed seed pack. Must be `release` for any
 * build given to families (docs/qa/release-checklist.md); release mode refuses unreviewed content.
 */
export const CONTENT_VALIDATION_MODE: ValidationMode = 'draft';
