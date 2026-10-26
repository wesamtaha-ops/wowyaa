import { z } from 'zod';
import {
  AgeBandSchema,
  ContentIdSchema,
  EpochMsSchema,
  NfcTextSchema,
  SemverSchema,
} from './primitives';

export const CURRICULUM_SCHEMA_VERSION = 1;

export const StrandSchema = z.enum([
  'letter_identity',
  'phoneme_association',
  'letter_forms',
  'short_vowels',
  'joining',
  'decoding',
  'tracing',
]);
export type Strand = z.infer<typeof StrandSchema>;

export const ActivityTypeSchema = z.enum(['construct_word', 'match_sound_letter', 'trace_letter']);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ReviewSchema = z.object({
  reviewer: z.string().min(1),
  role: z.enum(['pedagogy', 'arabic_editor', 'audio', 'illustration']),
  reviewedAtMs: EpochMsSchema,
});
export type Review = z.infer<typeof ReviewSchema>;

export const LocalizedTextSchema = z.object({
  ar: NfcTextSchema,
  en: z.string().min(1).optional(),
});

export const PassPolicySchema = z.object({
  /** Minimum correct, unaided-or-hinted attempts inside the evaluation window. */
  minCorrect: z.number().int().positive(),
  window: z.number().int().positive(),
  minMastery: z.number().min(0).max(1),
});

export const SkillSchema = z.object({
  skillId: ContentIdSchema,
  /** Immutable revision number; a changed skill gets a new version, never an in-place edit. */
  version: z.number().int().positive(),
  strand: StrandSchema,
  prerequisites: z.array(ContentIdSchema),
  difficulty: z.number().int().min(1).max(5),
  targetAgeBand: z.array(AgeBandSchema).min(1),
  learningObjective: LocalizedTextSchema,
  supportedActivityTypes: z.array(ActivityTypeSchema),
  passPolicy: PassPolicySchema,
  remediationSkillIds: z.array(ContentIdSchema),
  reviewedBy: z.array(ReviewSchema),
});
export type Skill = z.infer<typeof SkillSchema>;

export const PresentationSchema = z.enum(['isolated', 'initial', 'medial', 'final']);
export type Presentation = z.infer<typeof PresentationSchema>;

export const LetterSchema = z.object({
  letterId: ContentIdSchema,
  glyph: NfcTextSchema,
  nameAr: NfcTextSchema,
  nameTranslit: z.string().min(1),
  /** Letters sharing a skeleton and differing by dots (plan §3.1), e.g. `ba_ta_tha`. */
  dotFamily: ContentIdSchema.nullable(),
  /** False for the six non-connecting letters (ا د ذ ر ز و). */
  connectsToNext: z.boolean(),
  sounds: z
    .array(
      z.object({ soundId: ContentIdSchema, ipa: z.string().min(1), audioRef: ContentIdSchema }),
    )
    .min(1),
  nameAudioRef: ContentIdSchema,
  exampleWordIds: z.object({
    initial: ContentIdSchema.optional(),
    medial: ContentIdSchema.optional(),
    final: ContentIdSchema.optional(),
  }),
});
export type Letter = z.infer<typeof LetterSchema>;

export const WordSchema = z.object({
  wordId: ContentIdSchema,
  /** Fully vocalized display form, NFC. */
  display: NfcTextSchema,
  /** Canonical unvocalized comparison form, NFC. */
  canonical: NfcTextSchema,
  /** Letter ids in logical (reading) order. Comparison uses these, never visual glyph shaping. */
  letterIds: z.array(ContentIdSchema).min(1),
  difficulty: z.number().int().min(1).max(5),
  imageRef: ContentIdSchema,
  audioRef: ContentIdSchema,
  concept: z.object({ en: z.string().min(1) }),
  aliases: z.array(NfcTextSchema),
  notes: z.string().optional(),
  reviewedBy: z.array(ReviewSchema),
});
export type Word = z.infer<typeof WordSchema>;

export const ActivityItemSchema = z.object({
  activityId: ContentIdSchema,
  type: ActivityTypeSchema,
  version: z.number().int().positive(),
  purpose: z.enum(['practice', 'assessment']),
  targetSkillIds: z.array(ContentIdSchema).min(1),
  /** Validated by the activity definition registered for (type, version). */
  config: z.unknown(),
});
export type ActivityItem = z.infer<typeof ActivityItemSchema>;

export const ConfusionSetSchema = z.object({
  setId: ContentIdSchema,
  kind: z.enum(['sound_discrimination', 'tracing']),
  letterIds: z.array(ContentIdSchema).min(1),
  /** Why these letters are grouped, e.g. `dot_family`, `similar_sound`. */
  rationale: z.enum(['dot_family', 'similar_sound', 'similar_shape', 'non_connecting']),
});
export type ConfusionSet = z.infer<typeof ConfusionSetSchema>;

export const CurriculumPackSchema = z.object({
  packId: ContentIdSchema,
  version: SemverSchema,
  schemaVersion: z.literal(CURRICULUM_SCHEMA_VERSION),
  locale: z.literal('ar'),
  status: z.enum(['draft', 'reviewed']),
  letters: z.array(LetterSchema),
  skills: z.array(SkillSchema),
  words: z.array(WordSchema),
  confusionSets: z.array(ConfusionSetSchema),
  activities: z.array(ActivityItemSchema),
  /** Skill renames across pack versions so stored mastery keeps resolving (plan §7). */
  skillIdAliases: z.record(ContentIdSchema, ContentIdSchema),
});
export type CurriculumPack = z.infer<typeof CurriculumPackSchema>;
