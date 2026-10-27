# M3 proposal: tracing and the adaptive engine

**Plan refs:** §6.1, §6.2, §8.3, §9, §10, §12, §16 (M3), §17 items 6–7. **Gate:** device tests pass, evidence is recorded correctly, and uncertain results are handled without penalizing the child.

## Scope

| Slice | What | Package / files |
| ----- | ---- | --------------- |
| 1 | Trace guides: rasterize each letter's isolated form from an open-licensed font into a normalized occupancy grid, a centerline (skeleton) and separate dot components. Output is a checked-in JSON with font name, version, license and SHA-256 | `tooling/glyph-guides` (new), `packs/ar-foundations-v1/trace-guides.json` |
| 2 | `trace_letter` rules engine and `TraceGeometryEvaluator`: corridor coverage, off-path ratio, stroke progress, dots checked separately. Returns `correct`, `incorrect` or `indeterminate` | `packages/activities-writing` (new) |
| 3 | Optional recognizer hook: the evaluator accepts a `RecognitionOutcome`. Agreement can raise confidence; disagreement gives `indeterminate`, never `incorrect`. The default stays `UnavailableHandwritingRecognizer` | `packages/ai-gateway` (exists), slice 2 |
| 4 | Scheduler v1 (§10): eligible skills from prerequisites and age band, overdue reviews first, then weak foundational skills, mixed with mastered items; deterministic weighted selection by seed; variety caps; remediation queue after repeat errors; every pick carries `reasonCodes` | `packages/learning-engine/src/scheduler.ts`, `scheduler-config.ts` |
| 5 | App: tracing screen (react-native-svg for the guide and ink, built-in PanResponder for touch), sessions planned by the scheduler from stored mastery, `geometryTraceReady` capability | `apps/mobile/src/game/TraceView.tsx`, `play-session.ts` |
| 6 | Tests: golden synthetic stroke fixtures, scheduler determinism and starvation tests, RNTL tracing test, Maestro swipe flow | per package, `apps/mobile/.maestro/` |

## Decisions in this proposal

- **Geometry-only tracing ships as the P0 core; ML Kit Digital Ink is not integrated in M3.** Plan §9 says to ship geometry-only when the native spike hasn't proven offline model availability, and the spike needs physical Android/iOS devices that we don't have yet. The recognizer contract and guard already exist, so an adapter can be added later without changing the evaluator.
- **Guides come from a font, not hand-drawn paths.** Rasterizing the glyph gives a reproducible corridor and real dot positions for all 28 letters. Hand-authored stroke paths would be guesses. The guide shows *where* to trace, not stroke order, because the plan forbids inferring stroke order we can't verify. Proposed font: **Noto Naskh Arabic** (SIL Open Font License 1.1). It is used only by build tooling; the app doesn't need to ship it.
- **Thresholds are hypotheses.** Coverage and corridor tolerances live in a versioned config, are generous for young motor skills, and must be recalibrated with consenting child samples (§15). Results near a threshold return `indeterminate`, which never lowers mastery.
- **No raw ink is stored.** Strokes stay in memory for the current attempt; only error codes and metrics are saved (§6.3).
- **react-native-svg 15.16.0** (Expo SDK 58's bundled version, MIT) for drawing. No Skia, Reanimated or gesture-handler yet; PanResponder is part of React Native.

## Acceptance tests

1. A child can complete tracing with no ML model; `UnavailableHandwritingRecognizer` never blocks or fails an attempt.
2. Golden fixtures: a clean trace along the centerline is `correct`; a scribble outside the corridor is `incorrect` with `off_path`; a body without dots on a dotted letter gets `missing_dots`; a partial trace near the threshold is `indeterminate`.
3. Recognizer agreement keeps `correct` and switches provenance to `hybrid`; disagreement or a timeout gives `indeterminate`, never `incorrect`.
4. `indeterminate` attempts don't change mastery (already true in `mastery-v1`; re-tested through the repository).
5. Scheduler: the same state and seed give the same plan; locked skills (unmet prerequisites) are never picked; overdue reviews come first; weak skills are never starved over 100 sessions; no activity repeats within a session; every pick has `reasonCodes`.
6. Raw stroke coordinates are not written to SQLite (checked against the database after a tracing attempt).
7. Device: tracing playable on the iPad simulator via Maestro swipes; kill and relaunch keeps progress.

## Risks

- Synthetic stroke fixtures aren't real child input. Thresholds will need recalibration after the first consented sessions.
- Font-derived guides follow typographic shapes; the educator must confirm each letter's isolated form is the one taught.
- The simulator can't show touch latency on real devices; §12 budgets stay open until device testing.

## External decisions needed

1. Approve Noto Naskh Arabic (OFL) as the source for trace guides, or name the licensed face the design system will use.
2. Physical test devices for the ML Kit spike (§9). Until then tracing stays geometry-only.
3. Educator review of scheduler parameters and tracing tolerances before beta.
