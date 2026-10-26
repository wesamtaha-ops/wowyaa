import { z } from 'zod';
import { ContentIdSchema, NfcTextSchema, SemverSchema, Sha256Schema } from './primitives';

/** Asset directory contract (plan §4). */
export const AssetEntrySchema = z
  .object({
    assetId: ContentIdSchema,
    locale: z.string().min(2),
    contentVersion: SemverSchema,
    sha256: Sha256Schema,
    mime: z.enum([
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
      'audio/ogg',
      'image/svg+xml',
      'image/png',
      'image/webp',
    ]),
    sizeBytes: z.number().int().positive(),
    durationMs: z.number().int().positive().optional(),
    license: z.string().min(1),
    credit: z.string().min(1),
    transcript: NfcTextSchema.optional(),
    relativePath: z
      .string()
      .min(1)
      .refine(
        (p) => !p.startsWith('/') && !p.split('/').includes('..'),
        'relativePath must stay inside the pack',
      ),
  })
  .refine((a) => !a.mime.startsWith('audio/') || a.durationMs !== undefined, {
    message: 'audio assets require durationMs',
    path: ['durationMs'],
  });
export type AssetEntry = z.infer<typeof AssetEntrySchema>;

export const AssetManifestSchema = z.object({
  packId: ContentIdSchema,
  contentVersion: SemverSchema,
  assets: z.array(AssetEntrySchema),
});
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
