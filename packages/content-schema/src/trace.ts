import { z } from 'zod';
import { ContentIdSchema } from './primitives';

/**
 * Tracing guides (plan §8.3, docs/m3/proposal.md). Each letter's isolated form is
 * rasterized from a font into a square grid in normalized space (0..1, y down). The guide
 * says where ink belongs; it deliberately encodes no stroke order.
 */
const HexRowSchema = z.string().regex(/^[0-9a-f]+$/);
const UnitPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const TraceMarkSchema = z.object({
  /** Centroid and radius of a dot (or other small mark) in normalized space. */
  cx: z.number().min(0).max(1),
  cy: z.number().min(0).max(1),
  r: z.number().positive().max(1),
});
export type TraceMark = z.infer<typeof TraceMarkSchema>;

export const TraceGuideSchema = z.object({
  letterId: ContentIdSchema,
  glyph: z.string().min(1),
  presentation: z.enum(['isolated', 'initial', 'medial', 'final']),
  /** Bitmap of the letter body, one hex string per row, most significant bit = leftmost cell. */
  body: z.array(HexRowSchema),
  /** Centerline samples of the body, in normalized space. */
  skeleton: z.array(UnitPointSchema).min(2),
  marks: z.array(TraceMarkSchema),
  /** Outline for display, as an SVG path in normalized space (unit square). */
  outlinePath: z.string().min(1),
});
export type TraceGuide = z.infer<typeof TraceGuideSchema>;

export const TraceGuideSetSchema = z
  .object({
    packId: ContentIdSchema,
    grid: z.number().int().min(16).max(256),
    source: z.object({
      font: z.string().min(1),
      fontVersion: z.string().min(1),
      license: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    guides: z.array(TraceGuideSchema),
  })
  .superRefine((set, ctx) => {
    const hexLen = Math.ceil(set.grid / 4);
    set.guides.forEach((g, i) => {
      if (g.body.length !== set.grid || g.body.some((row) => row.length !== hexLen)) {
        ctx.addIssue({
          code: 'custom',
          path: ['guides', i, 'body'],
          message: `body must be ${set.grid} rows of ${hexLen} hex chars`,
        });
      }
    });
  });
export type TraceGuideSet = z.infer<typeof TraceGuideSetSchema>;
