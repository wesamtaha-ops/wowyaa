/**
 * Arabic text helpers. Pedagogical diacritics are preserved in display text; these helpers
 * derive comparison forms and detect features without mutating the source (plan §1.2).
 */

export const FATHA = 'َ';
export const DAMMA = 'ُ';
export const KASRA = 'ِ';
export const SHADDA = 'ّ';
export const SUKUN = 'ْ';
const TANWEEN = new Set(['ً', 'ٌ', 'ٍ']);
const SUPERSCRIPT_ALEF = 'ٰ';

const HAMZA_LETTERS = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);

export function isArabicMark(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x064b && c <= 0x065f) || c === 0x0670;
}

export function toNfc(text: string): string {
  return text.normalize('NFC');
}

/** Removes harakat/tanween/shadda/sukun. Use only for comparison forms, never for display. */
export function stripDiacritics(text: string): string {
  return Array.from(toNfc(text))
    .filter((ch) => !isArabicMark(ch))
    .join('');
}

export interface GraphemeCluster {
  base: string;
  marks: string[];
}

/** Splits text into base letters with their following combining marks, in logical order. */
export function segmentGraphemes(text: string): GraphemeCluster[] {
  const clusters: GraphemeCluster[] = [];
  for (const ch of Array.from(toNfc(text))) {
    const last = clusters[clusters.length - 1];
    if (isArabicMark(ch)) {
      if (!last) throw new Error(`text starts with a combining mark: ${JSON.stringify(text)}`);
      last.marks.push(ch);
    } else {
      clusters.push({ base: ch, marks: [] });
    }
  }
  return clusters;
}

export type WordFeature =
  | 'hamza'
  | 'shadda'
  | 'sukun'
  | 'long_vowel'
  | 'diphthong'
  | 'tanween'
  | 'ta_marbuta'
  | 'superscript_alef';

/**
 * Detects graphemic features a word relies on, so the validator can reject words whose
 * complexity exceeds the skill prerequisites (plan §3.2). Long vowels are detected from
 * vocalization: a bare ا after fatha, و after damma, ي after kasra.
 */
export function detectWordFeatures(vocalized: string): Set<WordFeature> {
  const features = new Set<WordFeature>();
  const clusters = segmentGraphemes(vocalized);
  clusters.forEach((cluster, i) => {
    const prev = clusters[i - 1];
    if (HAMZA_LETTERS.has(cluster.base)) features.add('hamza');
    if (cluster.base === 'ة') features.add('ta_marbuta');
    for (const m of cluster.marks) {
      if (m === SHADDA) features.add('shadda');
      if (m === SUKUN) features.add('sukun');
      if (TANWEEN.has(m)) features.add('tanween');
      if (m === SUPERSCRIPT_ALEF) features.add('superscript_alef');
    }
    if (!prev) return;
    const bare = cluster.marks.length === 0;
    const prevVowel = prev.marks.find((m) => m === FATHA || m === DAMMA || m === KASRA);
    if (bare) {
      if (
        (cluster.base === 'ا' && prevVowel === FATHA) ||
        (cluster.base === 'و' && prevVowel === DAMMA) ||
        (cluster.base === 'ي' && prevVowel === KASRA)
      ) {
        features.add('long_vowel');
      }
    } else if (
      (cluster.base === 'ي' || cluster.base === 'و') &&
      cluster.marks.includes(SUKUN) &&
      prevVowel === FATHA
    ) {
      features.add('diphthong');
    }
  });
  return features;
}
