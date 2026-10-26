import {
  CurriculumPackSchema,
  type ActivityItem,
  type AssetManifest,
  type CurriculumPack,
  type Skill,
  type Word,
} from '@huroofi/content-schema';
import {
  DAMMA,
  FATHA,
  KASRA,
  detectWordFeatures,
  segmentGraphemes,
  stripDiacritics,
  type WordFeature,
} from '@huroofi/game-core';

/**
 * Curriculum quality gates (plan §3.3). `draft` mode reports editorial gaps (missing
 * assets, reviews, coverage) as warnings so engineering can proceed; `release` mode turns
 * them into errors so an unreviewed pack can never ship.
 */
export type ValidationMode = 'draft' | 'release';

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  pack: CurriculumPack | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** Optional config validators keyed by `type@version`, supplied by registered activities. */
export type ConfigValidators = ReadonlyMap<string, (raw: unknown) => unknown>;

export interface ValidateOptions {
  mode: ValidationMode;
  assets?: AssetManifest;
  configValidators?: ConfigValidators;
}

/** Which skill (or skill prefix) must be in a word item's prerequisite closure per feature. */
const FEATURE_SKILLS: Record<WordFeature, string> = {
  hamza: 'hamza.',
  shadda: 'mark.shadda',
  sukun: 'mark.sukun',
  long_vowel: 'long_vowel.',
  diphthong: 'long_vowel.diphthong',
  tanween: 'mark.tanween',
  ta_marbuta: 'letter.ta_marbuta',
  superscript_alef: 'mark.superscript_alef',
};
const VOWEL_SKILLS: Record<string, string> = {
  [FATHA]: 'vowel.fatha',
  [KASRA]: 'vowel.kasra',
  [DAMMA]: 'vowel.damma',
};
/** Hamza seats on alif are spelled with the alif tile in early construction tasks. */
const HAMZA_SEAT_TO_BASE: Record<string, string> = { أ: 'ا', إ: 'ا', آ: 'ا' };

export function validatePack(raw: unknown, options: ValidateOptions): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const release = options.mode === 'release';
  const err = (code: string, path: string, message: string) => errors.push({ code, path, message });
  const editorial = (code: string, path: string, message: string) =>
    (release ? errors : warnings).push({ code, path, message });

  const parsed = CurriculumPackSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err('schema', issue.path.join('.'), issue.message);
    return { ok: false, pack: null, errors, warnings };
  }
  const pack = parsed.data;

  const letters = indexUnique(pack.letters, (l) => l.letterId, 'letters', err);
  const skills = indexUnique(pack.skills, (s) => s.skillId, 'skills', err);
  const words = indexUnique(pack.words, (w) => w.wordId, 'words', err);
  indexUnique(pack.activities, (a) => a.activityId, 'activities', err);
  const sets = indexUnique(pack.confusionSets, (s) => s.setId, 'confusionSets', err);

  if (release && pack.status !== 'reviewed') {
    err('pack_not_reviewed', 'status', 'release validation requires status "reviewed"');
  }

  // Skill graph: references resolve and prerequisites are acyclic.
  for (const s of pack.skills) {
    for (const p of s.prerequisites) {
      if (!skills.has(p))
        err('unknown_prerequisite', `skills.${s.skillId}`, `unknown prerequisite ${p}`);
    }
    for (const r of s.remediationSkillIds) {
      if (!skills.has(r))
        err('unknown_remediation', `skills.${s.skillId}`, `unknown remediation skill ${r}`);
    }
    if (s.reviewedBy.length === 0)
      editorial('unreviewed_skill', `skills.${s.skillId}`, 'skill has no reviewer sign-off');
  }
  for (const cycle of findCycles(pack.skills)) {
    err('prerequisite_cycle', 'skills', `prerequisite cycle: ${cycle.join(' → ')}`);
  }
  for (const [from, to] of Object.entries(pack.skillIdAliases)) {
    if (!skills.has(to))
      err('alias_target_missing', `skillIdAliases.${from}`, `alias target ${to} does not exist`);
    if (skills.has(from))
      err('alias_shadows_skill', `skillIdAliases.${from}`, 'alias source is still a live skill');
  }

  // Words: comparison form derives from display; letter sequence matches the canonical spelling.
  for (const w of pack.words) {
    const path = `words.${w.wordId}`;
    if (stripDiacritics(w.display) !== w.canonical) {
      err(
        'canonical_mismatch',
        path,
        `canonical "${w.canonical}" is not the unvocalized display "${stripDiacritics(w.display)}"`,
      );
    }
    const missing = w.letterIds.filter((id) => !letters.has(id));
    if (missing.length > 0) err('unknown_letter', path, `unknown letters ${missing.join(', ')}`);
    else {
      const spelled = w.letterIds.map((id) => letters.get(id)?.glyph).join('');
      const canonicalBases = Array.from(w.canonical, (ch) => HAMZA_SEAT_TO_BASE[ch] ?? ch).join('');
      if (spelled !== canonicalBases) {
        err(
          'letters_mismatch',
          path,
          `letterIds spell "${spelled}" but canonical is "${w.canonical}"`,
        );
      }
    }
    if (w.reviewedBy.length === 0)
      editorial('unreviewed_word', path, 'spelling/vocalization/pronunciation not reviewed');
  }

  // Confusion sets model explicit confusions.
  for (const s of pack.confusionSets) {
    const path = `confusionSets.${s.setId}`;
    const unknown = s.letterIds.filter((id) => !letters.has(id));
    if (unknown.length) err('unknown_letter', path, `unknown letters ${unknown.join(', ')}`);
    if (s.kind === 'sound_discrimination' && s.letterIds.length < 2) {
      err('set_too_small', path, 'sound discrimination needs at least two letters');
    }
    if (s.rationale === 'dot_family') {
      const families = new Set(s.letterIds.map((id) => letters.get(id)?.dotFamily));
      if (families.size !== 1 || families.has(null)) {
        err('dot_family_mismatch', path, 'dot_family set members must share one dot family');
      }
    }
  }

  // Activities.
  const closure = prerequisiteClosure(pack.skills);
  for (const a of pack.activities) {
    const path = `activities.${a.activityId}`;
    for (const sid of a.targetSkillIds) {
      const skill = skills.get(sid);
      if (!skill) err('unknown_target_skill', path, `unknown target skill ${sid}`);
      else if (!skill.supportedActivityTypes.includes(a.type)) {
        err(
          'unsupported_activity_type',
          path,
          `${sid} does not list ${a.type} as a supported activity`,
        );
      }
    }
    const validator = options.configValidators?.get(`${a.type}@${a.version}`);
    if (validator) {
      try {
        validator(a.config);
      } catch (e) {
        err('invalid_config', path, e instanceof Error ? e.message : String(e));
      }
    } else {
      editorial(
        'config_unvalidated',
        path,
        `no registered activity ${a.type}@${a.version} to validate config`,
      );
    }
    validateActivityContent(a, { letters, words, sets, closure }, err);
  }

  // Assets resolve.
  const assetIds = new Set(options.assets?.assets.map((x) => x.assetId) ?? []);
  const refs = collectAssetRefs(pack);
  const unresolved = refs.filter((r) => !assetIds.has(r.ref));
  if (unresolved.length > 0) {
    editorial(
      'missing_assets',
      'assets',
      `${unresolved.length} of ${refs.length} asset references do not resolve (first: ${unresolved[0]?.ref} at ${unresolved[0]?.path})`,
    );
  }

  // Coverage: ≥3 practice and ≥1 assessment per skill that has activities (plan §3.2).
  const coverage = new Map<string, { practice: number; assessment: number }>();
  for (const a of pack.activities) {
    for (const sid of a.targetSkillIds) {
      const c = coverage.get(sid) ?? { practice: 0, assessment: 0 };
      c[a.purpose] += 1;
      coverage.set(sid, c);
    }
  }
  let underCovered = 0;
  let uncovered = 0;
  for (const s of pack.skills) {
    const c = coverage.get(s.skillId);
    if (!c) uncovered += 1;
    else if (c.practice < 3 || c.assessment < 1) underCovered += 1;
  }
  if (uncovered > 0)
    editorial('skills_without_activities', 'activities', `${uncovered} skills have no activity`);
  if (underCovered > 0) {
    editorial(
      'coverage_below_minimum',
      'activities',
      `${underCovered} skills have fewer than 3 practice + 1 assessment items`,
    );
  }

  return { ok: errors.length === 0, pack, errors, warnings };
}

function validateActivityContent(
  a: ActivityItem,
  ctx: {
    letters: Map<string, unknown>;
    words: Map<string, Word>;
    sets: Map<string, unknown>;
    closure: (skillIds: string[]) => Set<string>;
  },
  err: (code: string, path: string, message: string) => void,
): void {
  const path = `activities.${a.activityId}`;
  const cfg = (a.config ?? {}) as Record<string, unknown>;
  const letterRef = (id: unknown, field: string) => {
    if (typeof id !== 'string' || !ctx.letters.has(id))
      err('unknown_letter', path, `${field} references unknown letter ${String(id)}`);
  };
  if (typeof cfg.confusionSetId === 'string' && !ctx.sets.has(cfg.confusionSetId)) {
    err('unknown_confusion_set', path, `unknown confusion set ${cfg.confusionSetId}`);
  }

  switch (a.type) {
    case 'construct_word': {
      const word = typeof cfg.wordId === 'string' ? ctx.words.get(cfg.wordId) : undefined;
      if (!word) {
        err('unknown_word', path, `unknown word ${String(cfg.wordId)}`);
        return;
      }
      if (JSON.stringify(cfg.answer) !== JSON.stringify(word.letterIds)) {
        err('answer_key_mismatch', path, `answer does not equal ${word.wordId} letterIds`);
      }
      if (JSON.stringify(cfg.targetSkillIds) !== JSON.stringify(a.targetSkillIds)) {
        err('target_mismatch', path, 'config.targetSkillIds must equal item targetSkillIds');
      }
      if (Array.isArray(cfg.distractors))
        cfg.distractors.forEach((d, i) => letterRef(d, `distractors[${i}]`));
      const allowed = ctx.closure(a.targetSkillIds);
      const has = (prefixOrId: string) =>
        prefixOrId.endsWith('.')
          ? [...allowed].some((s) => s.startsWith(prefixOrId))
          : allowed.has(prefixOrId);
      for (const f of detectWordFeatures(word.display)) {
        const needed = FEATURE_SKILLS[f];
        if (!has(needed)) {
          err(
            'untaught_feature',
            path,
            `${word.wordId} uses ${f} but no ${needed}* skill is a prerequisite`,
          );
        }
      }
      for (const cluster of segmentGraphemes(word.display)) {
        for (const m of cluster.marks) {
          const needed = VOWEL_SKILLS[m];
          if (needed && !allowed.has(needed)) {
            err(
              'untaught_feature',
              path,
              `${word.wordId} uses ${needed} but it is not a prerequisite`,
            );
          }
        }
      }
      for (const lid of word.letterIds) {
        if (!allowed.has(`${lid}.sound`)) {
          err(
            'untaught_letter',
            path,
            `${word.wordId} uses ${lid} but ${lid}.sound is not targeted or prerequisite`,
          );
        }
      }
      return;
    }
    case 'match_sound_letter': {
      const choices = Array.isArray(cfg.choiceLetterIds) ? (cfg.choiceLetterIds as unknown[]) : [];
      if (choices.length < 2 || choices.length > 4) err('choice_count', path, 'offer 2–4 choices');
      choices.forEach((c, i) => letterRef(c, `choiceLetterIds[${i}]`));
      if (new Set(choices).size !== choices.length)
        err('ambiguous_choices', path, 'duplicate choices');
      letterRef(cfg.answerLetterId, 'answerLetterId');
      if (!choices.includes(cfg.answerLetterId))
        err('answer_not_in_choices', path, 'answer must be one of the choices');
      return;
    }
    case 'trace_letter':
      letterRef(cfg.letterId, 'letterId');
      return;
  }
}

function indexUnique<T>(
  items: readonly T[],
  id: (t: T) => string,
  path: string,
  err: (code: string, path: string, message: string) => void,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const k = id(item);
    if (map.has(k)) err('duplicate_id', path, `duplicate id ${k}`);
    map.set(k, item);
  }
  return map;
}

/** Returns each cycle found in the prerequisite graph (empty when acyclic). */
export function findCycles(skills: readonly Skill[]): string[][] {
  const graph = new Map(skills.map((s) => [s.skillId, s.prerequisites]));
  const state = new Map<string, 'visiting' | 'done'>();
  const cycles: string[][] = [];
  const stack: string[] = [];
  const visit = (id: string) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const p of graph.get(id) ?? []) visit(p);
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of graph.keys()) visit(id);
  return cycles;
}

function prerequisiteClosure(skills: readonly Skill[]): (ids: string[]) => Set<string> {
  const graph = new Map(skills.map((s) => [s.skillId, s.prerequisites]));
  return (ids) => {
    const seen = new Set<string>();
    const todo = [...ids];
    while (todo.length) {
      const id = todo.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(graph.get(id) ?? []));
    }
    return seen;
  };
}

export function collectAssetRefs(pack: CurriculumPack): Array<{ ref: string; path: string }> {
  const refs: Array<{ ref: string; path: string }> = [];
  for (const l of pack.letters) {
    refs.push({ ref: l.nameAudioRef, path: `letters.${l.letterId}.nameAudioRef` });
    for (const s of l.sounds)
      refs.push({ ref: s.audioRef, path: `letters.${l.letterId}.sounds.${s.soundId}` });
  }
  for (const w of pack.words) {
    refs.push({ ref: w.audioRef, path: `words.${w.wordId}.audioRef` });
    refs.push({ ref: w.imageRef, path: `words.${w.wordId}.imageRef` });
  }
  for (const a of pack.activities) {
    const cfg = a.config as Record<string, unknown> | null;
    if (cfg && typeof cfg.promptAudioRef === 'string') {
      refs.push({ ref: cfg.promptAudioRef, path: `activities.${a.activityId}.promptAudioRef` });
    }
  }
  return refs;
}
