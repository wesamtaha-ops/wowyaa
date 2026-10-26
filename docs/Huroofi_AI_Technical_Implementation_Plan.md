# Huroofi AI — Technical Implementation Plan

**Version:** 1.0  
**Date:** 26 October 2026  
**Status:** Implementation-ready technical specification, subject to early native feasibility spikes  
**Primary reader:** Claude Code / engineering team  
**Product:** Offline-first Arabic literacy game for children, digital-first with a future physical Smart Kit

> **Execution directive for Claude Code:** Implement this plan incrementally. Do not attempt the entire product in one pass. Start with repository inspection and feasibility gates, produce working vertical slices, run tests, and obtain explicit approval before introducing external services, paid dependencies, cloud AI, or invasive collection of children's data. Do not fabricate assets, model performance numbers, or completed tests.

## 1. Executive Summary

Huroofi AI is a child-safe, Arabic-first educational game for ages 4–9. Release 1 delivers a fully functional offline core with three games (word construction, sound-to-letter matching, letter tracing), a versioned Arabic curriculum, a deterministic adaptive learning engine, Faseeh the companion mascot, locally bundled human-recorded Modern Standard Arabic audio, local child profiles and parental insight screens. The initial product requires no account, analytics SDK, cloud authentication, or continuous network access.

**Product pillars:** (1) fun before worksheets; (2) authentic Arabic literacy, including short vowels and contextual letter forms; (3) 100% offline core; (4) explainable personalization; (5) privacy by design; (6) a common input contract supporting future camera-observed physical tiles.

### 1.1 Release boundaries

**In scope (P0):** curriculum design and validation; Faseeh visual identity and licensed asset pipeline; RTL-ready UI; activity plug-in SDK and game state machine; three playable games; SQLite persistence; initial adaptive scheduler; Arabic digital ink recognition feasibility and integration with graceful fallback; audio asset pipeline; local parental area; offline, accessibility, performance, and child usability tests.

**Deferred (P1):** child speech recognition / phoneme scoring; cloud sync; parental accounts; purchasing/entitlements; new worlds and stories; optional local language model; remote CMS; teacher dashboard.

**Deferred (P2):** physical tiles, camera, visual marker detection, tabletop calibration, kit manufacturing. P0 must reserve interfaces for P2, not implement a camera feature prematurely.

### 1.2 Non-negotiable rules

- Launch directly into locally playable content; do not block on login, internet, remote configuration or model downloads.
- Never award a learning failure due to uncertain AI output. Support `indeterminate` outcome and manual/touch fallback.
- Do not send raw child audio, handwriting or camera frames to a server. No third-party ad SDKs, behavioral tracking SDKs or unrestricted chat.
- Keep all core progression deterministic, explainable, testable and independent of LLMs.
- Store Arabic source text in Unicode NFC; preserve both normalized comparison form and pedagogical diacritics; never strip diacritics blindly for tasks that teach vowels.
- Write tests before or alongside each critical learning and persistence behavior.

## 2. Users, Learning Objectives and Success Metrics

**Primary learners:** ages 4–6 pre-readers and ages 7–9 emergent/beginner Arabic readers, including heritage-language learners abroad. **Parent:** selects age band, manages profiles and viewing progress. **Pedagogical reviewer:** certifies sound, wording, sequence and difficulty.

Initial competency strands: visual letter identity; phoneme association; letter forms and dot groups; short vowels (fatha, kasra, damma); joining patterns; word decoding and construction; letter stroke tracing. Do not assume all children already speak Modern Standard Arabic.

**Proposed product KPIs (hypotheses to validate, not launch promises):** ≥80% of children can start an activity unassisted in observed tests; ≥90% of core sessions complete without blocking defects; measurable skill gain across repeated guided probes; 0 essential requests in offline flight-mode smoke tests; 0 accidental network uploads of child interaction data. Track skill progress locally and collect aggregate opt-in analytics only in a later release after privacy review.

## 3. Curriculum Specification (P0)

### 3.1 Curriculum authoring model

Represent curriculum as a dependency graph, not a linear array of levels. Every skill includes `skillId`, `strand`, `prerequisites`, `difficulty`, `targetAgeBand`, `learningObjective`, `supportedActivityTypes`, `passPolicy`, `remediationSkillIds`, and `reviewedBy`. Skill revisions must use immutable versions.

Core phonics uses **Modern Standard Arabic (MSA)**, native editorial review, and vocalized beginner words. Introduce the 28 basic Arabic letters through sound, visual form and contextual examples. Track dot families (ب/ت/ث, ج/ح/خ, د/ذ, ر/ز, س/ش, ص/ض, ط/ظ, ع/غ, ف/ق), long vowels, non-connecting letters, and shape-in-word variants. Explain hamza forms separately rather than treating them as an additional basic alphabet letter.

### 3.2 Deliverable: curriculum pack `ar-foundations-v1`

- 28 base letters with display name, isolated glyph, canonical learning sound(s), initial/medial/final examples where applicable, and an `audioRef` for each instructed sound.
- First 36 controlled target words (an editorial seed list; expand to 60–100 after review). Each word has fully diacritized display, canonical unvocalized form, letters/graphemes, target difficulty, image concept, syllable/phoneme notes, recognized aliases, and distinct audio files.
- 12 sound/letter discrimination sets and 12 tracing sets, explicitly weighted toward confusable forms.
- At least 3 practice and 1 assessment activity per introduced skill; use separate assessment items where possible.
- Parent-facing progress labels in plain Arabic, not psychometric diagnoses.

**Suggested illustrative words, pending review:** أَسَد، بَاب، قَمَر، كِتَاب، سَمَك، تُفَّاح، شَمْس، بَيْت. Reject words whose graphemic complexity exceeds the relevant skill prerequisites. In particular, initial activities must not silently rely on untaught hamza, shadda or long-vowel concepts.

### 3.3 Curriculum quality gates

A reviewer signs off on each word's spelling, vocalization, image association and recorded pronunciation. A validator checks every activity's target exists, all `audioRef`/`imageRef` assets resolve, prerequisites are acyclic, duplicates are intentional, answer choices are unambiguous, and distractors reflect explicitly modeled confusions. Curriculum packages are semver-versioned with SHA-256 asset manifests.

## 4. Character, Design System and Asset Pipeline

**Mascot:** Faseeh, a friendly, non-threatening fox explorer; recognizably Arabic-learning themed without stereotyped cultural costuming. Prepare a character bible including primary silhouette, palette, expressive poses (neutral, celebratory, encouraging, thinking, asking, gently correcting), proportions, animation states, prohibited expressions and voice direction. All production artwork must be original or licensed; placeholder emoji are acceptable only during engineering prototypes.

**Visual principles:** landscape-first tablet canvas but responsive portrait phone fallback; large touch targets (≥48 dp, preferably ≥64 dp for pre-readers); minimal reading requirements on child screens; no shameful red failure patterns; reduced-motion option; accessible audio replay; age-appropriate contrast; RTL text with explicit LTR exceptions for tooling/debug IDs. Prefer SVG/Skia/optimized sprites and keep GPU/memory budget conservative.

**Design tokens:** `colors`, `spacing`, `radii`, `typography`, `motion`, `sounds`, `mascotStates`, `touchTargets`. Arabic typeface must be licensed and validated for diacritics and joined forms on iOS/Android. Animation should support a low-performance mode.

**Assets directory contract:** `assetId`, `locale`, `contentVersion`, `sha256`, `mime`, `sizeBytes`, `durationMs` (audio), `license`, `credit`, `transcript`, `relativePath`. Use authored MSA recordings of discrete instructions, letters, words, correct/try-again prompts, and rewards. Aim for consistent volume and loudness; record in quiet conditions; trim long silence; export compressed audio suitable for mobile; verify native rendering and lip/pose timing.

## 5. Monorepo Architecture

**Stack:** pnpm + Turborepo, TypeScript strict mode, React Native/Expo Development Builds, React Native Skia + Reanimated, Zustand for ephemeral UI state, `expo-sqlite` for authoritative local progression, Zod for data validation, Vitest/Jest where appropriate, React Native Testing Library, Maestro/Detox for E2E as platform practicality dictates. Prefer pinned compatible versions chosen by a dependency audit, not hard-coded unverified latest versions. No backend required for P0 runtime.

```text
huroofi/
  apps/
    mobile/                  # Expo app, iOS and Android
    asset-preview/           # optional internal asset QA viewer
  packages/
    curriculum/              # skill graph, validation, fixtures
    content-schema/          # zod contracts and pack manifests
    game-core/               # pure TS state machines, scoring
    activity-sdk/            # activity plugin API and registry
    activities-word/         # construct-word activity
    activities-audio/        # sound-letter match activity
    activities-trace/        # trace-letter activity
    learning-engine/         # mastery and review scheduler
    interaction-core/        # canonical multimodal inputs
    ai-gateway/              # on-device provider interface
    handwriting-engine/      # ML Kit adapter + deterministic fallback
    audio-engine/            # bundled playback and cues
    offline-storage/         # SQLite, migration, repository layer
    design-system/           # components/tokens/RTL behavior
    mascot/                  # Faseeh states and animation contracts
    test-fixtures/           # skills, assets, outcomes, DB fixtures
  native/
    digital-ink/             # Expo native module / config plugin
  tooling/
    content-validator/
    asset-pipeline/
    offline-network-guard/
    device-benchmarks/
  docs/
    architecture/
    curriculum/
    adr/
    privacy/
    qa/
  .github/workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

**Architectural dependency rule:** UI → activity SDK → pure game core/learning core → repository interfaces. Native recognition implementations must depend on interfaces defined in `ai-gateway`, never vice versa. Activity packages cannot import SQLite directly or make HTTP calls. Keep cloud contracts absent from child gameplay until P1.

## 6. Domain Contracts and Interfaces

Define these as shared contracts with runtime schema validation at data boundaries.

```ts
export type InputSource = 'touch' | 'audio_choice' | 'handwriting' | 'physical_tile';
export type EvaluationStatus = 'correct' | 'incorrect' | 'indeterminate';
export type GameEvent = {
  eventId: string; sessionId: string; activityId: string;
  source: InputSource; kind: 'letter' | 'word' | 'stroke_set' | 'tile_sequence';
  payload: unknown; occurredAtMs: number;
  confidence?: number; // 0..1 when a model supplies it
};
export type EvaluationResult = {
  status: EvaluationStatus; targetSkillIds: string[];
  feedbackKey: string; errorCodes: string[];
  hintsUsed: number; scoreDelta: number;
  provenance: 'deterministic' | 'mlkit' | 'hybrid';
};
export type ActivityDefinition<TConfig = unknown> = {
  type: string; version: number;
  validateConfig(raw: unknown): TConfig;
  createInitialState(config: TConfig, seed: number): unknown;
  reduce(state: unknown, event: GameEvent): unknown;
  evaluate(state: unknown, config: TConfig): EvaluationResult | null;
  supportedSources: InputSource[];
};
export interface ActivityRegistry {
  register<T>(activity: ActivityDefinition<T>): void;
  resolve(type: string, version: number): ActivityDefinition;
}
```

Require seeded deterministic generation for word tiles/distractors so activity sessions can be reproduced in tests. All timestamps are UTC epoch milliseconds; rendering converts to local device timezone.

### 6.1 AI recognition contract

```ts
export type StrokePoint = { x: number; y: number; tMs: number };
export type Stroke = { points: StrokePoint[] };
export type InkRequest = {
  requestId: string; targetGrapheme: string;
  expectedPresentation: 'isolated' | 'initial' | 'medial' | 'final';
  strokes: Stroke[]; canvas: { width: number; height: number };
};
export type RecognitionOutcome = {
  status: 'recognized' | 'uncertain' | 'unavailable';
  candidates: Array<{ text: string; score?: number }>;
  engine: string; engineVersion: string; elapsedMs: number;
  diagnosticCodes: string[];
};
export interface HandwritingRecognizer {
  isAvailable(): Promise<boolean>;
  ensureModelInstalled(): Promise<'ready' | 'download_required' | 'unsupported'>;
  recognize(request: InkRequest): Promise<RecognitionOutcome>;
  dispose(): Promise<void>;
}
```

Digital Ink recognizes stroke sequences, not writing correctness by itself. Implement separate `TraceGeometryEvaluator` using tolerant stroke corridor, missing dots, progression and completion checks, calibrated on real child samples. Do not infer stroke order from ML Kit alone. If the model is missing, uncertain, unavailable or overloaded, allow scaffolded stroke-following exercises and teacher-authored tracing tolerance rather than blocking the game.

### 6.2 Learning engine contract

```ts
export type MasteryState = {
  childId: string; skillId: string; mastery: number; // 0..1
  exposures: number; correct: number; incorrect: number;
  consecutiveCorrect: number; lastPracticedAtMs: number | null;
  nextReviewAtMs: number | null; algorithmVersion: string;
};
export type SkillEvidence = {
  attemptId: string; childId: string; skillId: string;
  outcome: EvaluationStatus; hintsUsed: number;
  responseMs: number | null; completedAtMs: number;
};
export interface LearningEngine {
  update(state: MasteryState, evidence: SkillEvidence): MasteryState;
  selectNext(context: {
    states: MasteryState[]; eligibleActivityIds: string[];
    sessionSeed: number; nowMs: number;
  }): { activityId: string; reasonCodes: string[] };
}
```

Start with explicit heuristics rather than opaque ML: correct unaided work raises mastery more than hinted work; indeterminate attempts do not reduce mastery; spaced review activates after delays; caps prevent repeated identical prompts; dependency graph blocks overly advanced activities; provide error-specific remediation for dot confusions and shapes. Version every algorithm and test deterministic expected results. Initial thresholds and interval lengths are configurable research hypotheses, not scientifically validated constants.

### 6.3 Local storage interface

```ts
export interface ProgressRepository {
  createChild(input: { displayName: string; ageBand: '4-6' | '7-9' }): Promise<string>;
  startSession(childId: string, seed: number): Promise<string>;
  recordAttempt(input: {
    attemptId: string; sessionId: string; childId: string;
    activityId: string; contentVersion: string;
    result: EvaluationResult; completedAtMs: number;
  }): Promise<void>;
  getMastery(childId: string): Promise<MasteryState[]>;
  listRecentSessions(childId: string, limit: number): Promise<unknown[]>;
  deleteChildData(childId: string): Promise<void>;
}
```

One `recordAttempt` transaction writes the attempt and mastery changes atomically. Enforce `attemptId` uniqueness for duplicate event idempotency. Keep raw stroke coordinates transient by default; store only categorized errors and performance evidence unless an explicit local-only parent setting enables diagnostic samples.

## 7. SQLite Schema (P0)

Use versioned SQL migrations executed transactionally. Enable foreign keys, test journal mode on each platform, and avoid schema reset after upgrades.

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at_ms INTEGER NOT NULL
);
CREATE TABLE child_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK(age_band IN ('4-6','7-9')),
  avatar_id TEXT NOT NULL DEFAULT 'faseeh_default',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE TABLE content_packs (
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  installed_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  PRIMARY KEY(pack_id, version)
);
CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  content_pack_id TEXT NOT NULL,
  content_version TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  random_seed INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','complete','abandoned'))
);
CREATE INDEX idx_sessions_child_started ON learning_sessions(child_id, started_at_ms DESC);
CREATE TABLE activity_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_version INTEGER NOT NULL,
  input_source TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('correct','incorrect','indeterminate')),
  hints_used INTEGER NOT NULL DEFAULT 0,
  response_ms INTEGER,
  error_codes_json TEXT NOT NULL DEFAULT '[]',
  completed_at_ms INTEGER NOT NULL,
  content_version TEXT NOT NULL
);
CREATE INDEX idx_attempts_child_time ON activity_attempts(child_id, completed_at_ms DESC);
CREATE TABLE skill_mastery (
  child_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  mastery REAL NOT NULL CHECK(mastery >= 0 AND mastery <= 1),
  exposures INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  last_practiced_at_ms INTEGER,
  next_review_at_ms INTEGER,
  algorithm_version TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(child_id, skill_id)
);
CREATE TABLE skill_evidence (
  attempt_id TEXT NOT NULL REFERENCES activity_attempts(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  hints_used INTEGER NOT NULL,
  PRIMARY KEY(attempt_id, skill_id)
);
CREATE TABLE parent_settings (
  child_id TEXT PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  daily_play_limit_min INTEGER NOT NULL DEFAULT 20,
  audio_enabled INTEGER NOT NULL DEFAULT 1,
  reduced_motion INTEGER NOT NULL DEFAULT 0,
  optional_data_collection INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE device_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
```

**Content design:** The published curriculum graph, localized strings and assets are immutable versioned JSON packages, not mutable SQL rows. `skill_mastery.skill_id` and attempts reference stable content IDs. Provide compatibility mappings for renamed skills across pack versions. Use SQLite for user-generated state; content can live in bundled immutable application assets or cache with checksum verification. The current pack may be cached offline indefinitely. Parental PIN must never be kept in plaintext; use platform secure storage for derived credentials and throttled attempts, acknowledging that local parental gates are deterrents rather than high-assurance identity verification.

### 7.1 Migration tests

Test fresh install, upgrade N→N+1, aborted upgrade rollback, duplicate attempt insert, concurrent UI action idempotency, child deletion cascading, timezone changes, language settings changes, app-kill between session transitions, and 10k synthetic attempt records within device performance budgets.

## 8. Activity Mechanics and Acceptance Tests

### 8.1 Word Construction (`construct_word`)

Child sees an illustration and hears a pre-recorded word. Drag/tap shuffled letter/grapheme tiles into ordered slots. Initial tasks use isolated single graphemes and explicitly taught words; later tasks include contextual shape display and vowels. Comparison checks canonical grapheme sequence, not visual glyph shaping. Present targeted hint for wrong first letter or dot-family confusion. Support keyboard-free interaction.

**Acceptance:** reproducible shuffle using seed; no unsolvable distractor sets; correct output advances and records evidence exactly once; wrong answer gives supportive feedback; undo/retry; game completes with no network; 100% of editorial answer keys covered by automated tests.

### 8.2 Sound-to-Letter (`match_sound_letter`)

Replay bundled Arabic phoneme/letter voice asset; offer 2–4 visually distinct choices adjusted to difficulty. Use acoustically clean sound segments where practical, not just full letter names, and avoid tasks where different letters have indistinguishable spoken prompts. Maintain an accessible replay control and optional animated Faseeh lips/ear cue.

**Acceptance:** playback works with phone silent-mode semantics documented and headset routing; no HTTP request; focus and distractor sets validated; repeat audio does not penalize score; audio missing → safe fallback or hidden activity; reduced-motion works.

### 8.3 Letter Tracing (`trace_letter`)

Draw a large Arabic glyph guide with start indicator and optional animated demonstration. Capture timestamped touch strokes in normalized coordinates. Initial deterministic trace evaluator tests corridor coverage, deliberate stroke progress, and visible completion; dot placement is evaluated separately. ML Kit Digital Ink `ar` can supply a corroborating candidate when model installed. Calibration must tolerate motor development differences rather than demand calligraphic perfection.

**Acceptance:** child can play tracing with no ML model; ML Kit recognition never blocks completion; correct recognizer outcome and geometry agreement can increase confidence; disagreement produces gentle retry or `indeterminate`, never categorical criticism; after a download, ML runs in airplane mode; recognition executes off UI-critical thread; saved progress excludes raw ink by default.

## 9. Native Handwriting Feasibility Gate

Before committing to one recognizer, build an Android/iOS spike in Expo Development Builds using an isolated native bridge. Confirm: (a) selected React Native/Expo SDK compatibility; (b) language tag `ar` availability; (c) model lifecycle and initial download behavior; (d) model reuse in offline mode; (e) latency on target devices; (f) Arabic single-letter accuracy against *children's* stroke input; (g) error attribution for dots/forms. Use the official Google ML Kit Digital Ink docs and verify commercial/licensing implications.

**Go/no-go rule:** If the model is not present offline after installation, ship geometry-only tracing as the P0 core; optional model install occurs behind a parent-controlled download screen. If single-letter accuracy is inadequate, position model as secondary evidence, not grading authority. Do not claim that Digital Ink scores stroke order or pedagogical handwriting quality.

## 10. Adaptive Learning Algorithm v1

1. Build eligible skill set from curriculum prerequisites and age/level configuration.
2. Retrieve each skill's mastery, due-review time, confusion counts, exposure and prior activity types.
3. Prioritize overdue reviews and foundational weak skills, mixed with mastered activities for confidence and enjoyment.
4. Produce a deterministic weighted selection using an explicit session seed.
5. Select activity + word set, enforce variety and session caps.
6. Evaluate child evidence; `indeterminate` preserves mastery; hinted correct contributes less; repeat errors add a remediation queue.
7. Write attempt and updated mastery in one transaction; emit local summary event for the parent screen.

**Illustrative parameters:** starting mastery 0.25; correct unaided +0.08, hinted correct +0.04, incorrect −0.05, each clamped 0…1; review after 1/3/7 days for successive successes. These must live in a config file and be reviewed by the educator, not represented as validated learning-science estimates. Test no infinite activity loops, no starvation of weak skills, and stable scheduling across restarts.

## 11. Local Parent Area

Provide parent entry behind an age-appropriate adult gate, with optional PIN. Present per-child last seven days of play, skills practiced, progress by learning objective, repeated confusions, and a recommended 5-minute offline practice activity. Allow profile editing, session time limit, voice/reduced-motion settings, deleting all child data, explanation of what is stored, and version of installed content/model. No rankings among children. No server required to render any parent screen.

## 12. Offline-First Operational Design

**Bundled:** UI, 3 games, first alphabet curriculum, essential Faseeh sprites, baseline audio, local database migrations, deterministic tracing evaluator, and parent UI. **Downloadable later:** large voice packs, extended curriculum, optional Arabic Digital Ink model and future vision/ASR. First launch must work in airplane mode even if optional downloads have never run.

A `CapabilityRegistry` reports `touchReady`, `audioReady`, `geometryTraceReady`, `digitalInkReady`, and eventually `speechReady` and `physicalVisionReady`. Activities declare required and optional capabilities, then gracefully degrade. Never silently replace a local failure with a cloud AI call.

Implement a network-denial integration suite: block DNS/network in device test, reinstall fresh build, create a profile, complete all 3 activities, view parent progress, kill and relaunch, and verify persisted data. Audit outbound requests in child mode with a local proxy/network inspector. Explicitly document OS-level network behavior versus app-initiated transmissions.

**Performance budgets (targets, benchmark-adjustable):** 60 fps on reference tablet during simple play, 30 fps floor on minimum supported device; ≤150 ms touch feedback; ≤2.5 s cold-start-to-playable on reference devices after initial OS startup (re-evaluate in device tests); bounded native model latency with spinner/timeout; keep initial download size modest, with no mandatory LLM. Actual device and binary benchmarks are release gates.

## 13. Localization, Accessibility and Arabic QA

Use Arabic-first copy written by an educator, not machine-generated instructional text. Use `I18nManager`/RTL support with visual tests of joined glyphs, diacritics, numerals, punctuation, icons and directional gestures. Explicitly distinguish logical text order from display order. Include accessible labels on parent controls, nonverbal cues and audio prompts for prereaders, adjustable sounds, replay, reduced-motion, visually differentiated tile shapes, and high-contrast mode where possible. Test regional Android fonts and multiple iOS display sizes.

## 14. Privacy, Security and Compliance Workstream

Develop a data-flow map and threat model before beta. Local anonymous child profiles by default; least-privilege permissions; microphone permission not needed for P0; camera permission not needed until the physical kit; no remote telemetry without explicit informed parental control and legal review; no ad network; no third-party LLM; no unmoderated child communication. Provide delete and export (later) paths. Before distribution review GDPR, app-store children's policies, age-appropriate design, parental consent and regional requirements with qualified counsel. This plan does not itself certify compliance.

## 15. CI/CD, QA and Engineering Standards

- Conventional commits, branch protection, TypeScript `strict`, ESLint/Prettier, dependency audit, secret scanning, and reviewed ADRs.
- PR pipeline: typecheck; lint; curriculum and asset validation; pure game-core tests; learning-engine tests; SQLite integration tests; screenshot snapshots for Arabic RTL; build smoke checks.
- Nightly/device pipeline: iOS and Android Development Build E2E, airplane-mode suite, app termination/restart recovery, long-session memory/performance, asset playback, model provider gate.
- Environments: local development; internal device testing; family beta; production. No production backend is required for MVP. Use signed builds and secure release credentials.
- AI tests: golden stroke fixtures from consenting test sessions, false-accept/false-reject analysis, children's motor variability, different styluses/fingers, low-end device performance. Never infer child pronunciation ability from handwriting metrics.

## 16. Milestones and Dependencies

| Milestone | Indicative window | Main deliverables | Exit gate |
|---|---|---|---|
| M0 Discovery/feasibility | Weeks 1–2 | Curriculum draft, design brief, ML Kit native spike, device matrix | Native feasibility recorded; 3 activities mapped to skills |
| M1 Foundation | Weeks 3–4 | Monorepo, design tokens, DB migrations, content schema, activity SDK | CI green; offline app launches; migration tests pass |
| M2 Two playable activities | Weeks 5–7 | Word construction, sound matching, audio packs, mascot MVP | E2E tests offline; all sample answer keys verified |
| M3 Writing + adaptive engine | Weeks 8–10 | Tracing, deterministic fallback, optional ML Kit, mastery scheduler | Device tests, evidence correctness, uncertainty behavior |
| M4 Parent & beta hardening | Weeks 11–12 | Parent area, performance/security/accessibility QA, child pilots | Release gate checklist signed and no P0 blockers |

Schedule assumes readily available educational/audio/design contributors, prompt QA turnaround, and no major native SDK blockers; 12 weeks is a planning target, not a guarantee. Physical kit begins only after evidence from P0 and has its own separate business/engineering gate.

### 16.1 Task dependency graph

`Curriculum schema → reviewed seed content → activity fixtures → game authoring`; `design system → mascot/avatar screens → activity UI`; `SQLite migrations → repository → game session persistence → learning engine → parent dashboard`; `native feasibility → optional digital-ink adapter → child handwriting evaluation`; `audio asset pipeline → sound-letter game`; `all vertical slices → device/offline/child usability gates`.

## 17. Definition of Done and Release Acceptance

A milestone is not done until its tests, documentation, accessibility evidence and demo exist. For P0 release:

1. A fresh install with **zero network connectivity** starts a child profile and completes all three games.
2. Child progress persists across force-quit, reboot, database migration, and airplane-mode sessions.
3. Reviewed `ar-foundations-v1` has no invalid prerequisites, missing assets, ambiguous answer keys or unreviewed pronunciations.
4. Randomized word tiles cannot generate an unwinnable puzzle; every submission produces at most one recorded attempt.
5. Audio prompts replay without network, have no broken references and meet intelligibility review.
6. Tracing succeeds in geometry-only mode; optional model removal never blocks the child; uncertainty is handled without penalizing mastery.
7. Skill scheduling is deterministic for equal state/seed and produces an auditable `reasonCodes` trail.
8. Parent area shows progress consistent with SQL fixtures, enforces adult gate and deletes child data comprehensively.
9. RTL and diacritic rendering is reviewed on the device matrix; minimum touch target checks pass.
10. Network audit finds no app-initiated child voice, ink, identifier, or interaction upload in offline core.
11. Accessibility and usability trial findings are resolved or explicitly accepted by product/pedagogy owners.
12. CI, native builds, crash handling, rollback procedure and license provenance are documented.

## 18. Child Testing Protocol

Use small, supervised rounds across both target age bands, with written guardian consent, safe recruitment and no unnecessary identifiable recording. Evaluate first-use comprehension, frustration moments, time-to-complete, repeated request for help, content misunderstandings, tracing tolerance, and whether feedback is perceived as encouraging. Use structured observation notes; do not produce unsupported statistical claims from tiny pilots. Run at least one session on a modest Android tablet and a supported iPad before signing release.

## 19. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Arabic diacritics/glyph shaping bugs | Wrong pedagogy | Font QA, device screenshot fixtures, manual curriculum review |
| Digital Ink requires first-time download | Offline promise fails | Built-in geometry tracing; optional parent model download |
| Single-letter handwriting false negatives | Child frustration | Multiple evidence channels; `indeterminate`; calibration and child pilot |
| React Native animation stutter | Low engagement | Skia optimization, sprite compression, device budgets |
| Content/voice production bottleneck | Schedule slips | Lock small reviewed word list; asset pipeline and editorial checklist |
| Loss of local data on uninstall | Parent trust | Explicit notice now; optional opt-in cloud backup later |
| Too much technical scope before fun is proven | Product failure | Three polished games, child testing, no mandatory LLM |
| Regional child privacy obligations | Compliance exposure | No data export; legal/store review before beta/public release |

## 20. Claude Code Execution Instructions

### 20.1 Working agreement

Act as senior RN/TypeScript architect and implementation agent. Inspect repository state first; if repository empty initialize it. Before each milestone: write a concise implementation proposal, list files to change, explicit acceptance tests, risks and external decisions. Implement one vertical slice at a time; do not leave mock implementations labeled as production. Avoid unwarranted dependency additions. Ask permission before SaaS integrations, creating paid infrastructure, installing native SDKs with restrictive licenses, or collecting children's data. When an external dependency cannot be validated, implement the interface and a deterministic fallback, and document the blocked integration clearly.

### 20.2 Required engineering artifacts

- `/docs/architecture/overview.md` and Mermaid diagram
- `/docs/adr/0001-offline-first.md`, `0002-curriculum-pack-versioning.md`, `0003-handwriting-fallback.md`
- `/docs/curriculum/ar-foundations-v1.md` with reviewed coverage spreadsheet/JSON equivalents
- `/docs/privacy/data-inventory.md` and `/docs/qa/offline-test-matrix.md`
- migrations, repositories, fixtures, typed contracts, activity registry and tests
- code-level READMEs and commands for Android/iOS physical device builds
- `/docs/qa/release-checklist.md`, `/docs/qa/child-testing-protocol.md`

### 20.3 Exact first instruction to run

```text
You are implementing Huroofi AI. Read Huroofi_AI_Technical_Implementation_Plan.md in full.
Do not implement all milestones at once.
First, inspect the repository and toolchain; produce:
1) a dependency/version compatibility matrix for Expo, React Native, Skia,
   Reanimated, expo-sqlite and the proposed native Digital Ink bridge;
2) a proposed pnpm/Turborepo workspace structure and dependency boundaries;
3) a detailed M0 + M1 task list, ordered by dependencies;
4) a minimal working app shell that boots fully offline;
5) tests proving schema validation, SQLite persistence and a sample
   deterministic activity evaluation.
Before native Digital Ink integration, execute and document the feasibility spike.
Implement clean production-grade TypeScript, commit logical units, run relevant
checks, report exact test results and remaining blockers. Do not invent results.
Keep everything child-safe and offline-first by default.
```

### 20.4 Iteration handoff report template

For every implementation iteration report: `Completed`, `Changed files`, `Commands executed`, `Tests/results`, `Device verification`, `Offline verification`, `Known limitations`, `Next milestone`. Include actual logs when feasible. Never say native code was tested if only a web or mocked test ran.

## 21. Post-MVP Hybrid Extension Contract (Reserved, Not Built)

Physical letter tiles will emit the same `GameEvent` representation through a `physical_tile` input adapter. `PhysicalKitManifest` maps stable marker/tile IDs to canonical letter/grapheme IDs; a camera adapter handles calibration, occlusion, illumination, orientation and confidence, and returns `indeterminate` when recognition is doubtful. Prefer detectable printed markers for pilot reliability; keep visually seamless options as research. Do not need AR anchoring or 3D registration for the first physical kit.

Reserve interface only:

```ts
export interface PhysicalTileRecognizer {
  initialize(manifestVersion: string): Promise<void>;
  recognizeFrame(frameHandle: unknown): Promise<{
    status: 'recognized' | 'uncertain' | 'unavailable';
    tiles: Array<{ tileId: string; x: number; y: number; confidence: number }>;
  }>;
  dispose(): Promise<void>;
}
```

No camera entitlement or runtime permission should be present in P0 just to satisfy this future interface.

## 22. Source References and Verification Notes

Official documentation to consult during implementation (accessed/verified October 2026; recheck compatibility and policies at implementation time):

- Expo Development Builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- ML Kit Digital Ink: https://developers.google.com/ml-kit/vision/digital-ink-recognition/
- ML Kit supported base models (`ar`): https://developers.google.com/ml-kit/vision/digital-ink-recognition/base-models
- ONNX Runtime React Native: https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Families Policy: https://support.google.com/googleplay/android-developer/answer/9893335

**Important qualification:** Official ML Kit documentation confirms on-device stroke-based digital ink recognition and Arabic model availability, but does not establish robust Arabic handwriting grading performance for preschool children. This must be tested as a separate product capability. Expo native modules require a development build rather than relying solely on Expo Go.
