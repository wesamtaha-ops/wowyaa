import { z } from 'zod';

/** Stable content identifier: lowercase dotted/underscored slug, e.g. `letter.ba.sound`. */
export const ContentIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'content ids are lowercase slugs separated by . _ or -');

/** UTC epoch milliseconds (plan §6: all timestamps are UTC epoch ms). */
export const EpochMsSchema = z.number().int().nonnegative();

/** Arabic (or any) source text must be stored in Unicode NFC (plan §1.2). */
export const NfcTextSchema = z
  .string()
  .min(1)
  .refine((s) => s === s.normalize('NFC'), { message: 'text must be Unicode NFC normalized' });

export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'must be a semantic version');

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase hex SHA-256');

export const AgeBandSchema = z.enum(['4-6', '7-9']);
export type AgeBand = z.infer<typeof AgeBandSchema>;
