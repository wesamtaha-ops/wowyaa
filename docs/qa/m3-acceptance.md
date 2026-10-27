# M3 acceptance report

**Gate (plan §16 M3):** device tests pass, evidence is recorded correctly, and uncertain results are handled without penalizing the child. **Status: passed on iOS simulator (2026-10-27), geometry-only.**

| #   | Acceptance test (docs/m3/proposal.md)                                                                  | Result           | Evidence                                                                               |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| 1   | Tracing completes with no ML model; `UnavailableHandwritingRecognizer` never blocks an attempt         | Pass             | `activities-writing` tests, `apps/mobile/test/trace.test.tsx`, Maestro on device       |
| 2   | Golden fixtures: centerline trace correct, scribble `off_path`, missing dots, borderline indeterminate | Pass             | `packages/activities-writing/test`; all 29 trace answer keys in `curriculum` pack test |
| 3   | Recognizer agreement gives `hybrid`; disagreement or timeout gives `indeterminate`, never `incorrect`  | Pass             | `activities-writing` `combine()` tests                                                 |
| 4   | `indeterminate` attempts leave mastery unchanged                                                       | Pass             | `trace.test.tsx` "borderline trace" (checked through SQLite)                           |
| 5   | Scheduler: deterministic, locked skills never picked, reviews first, no starvation, reasonCodes        | Pass             | `packages/learning-engine/test/scheduler.test.ts`                                      |
| 6   | No raw stroke coordinates in SQLite                                                                    | Pass             | `trace.test.tsx` scans every table after an attempt                                    |
| 7   | Tracing playable on the iPad simulator via Maestro; kill and relaunch keeps progress                   | Pass (3/3 flows) | Mac, iPad Pro 13" (M5) sim, iOS 26.5, Maestro 2.12.0, commit 3068b95                   |

## Device run (WESAM's MacBook Pro)

- `pnpm check`: 18/18 turbo tasks, mobile 27/27 tests, 0 content errors.
- iOS Release build with react-native-svg 15.16.0 linked; launches without Metro; build info lists `construct_word@1,match_sound_letter@1,trace_letter@1`.
- Maestro: `play-word-and-relaunch.yaml`, `full-session.yaml` (5 mixed items, done screen, relaunch) and `leave-session.yaml` pass.
- Evidence on the Mac: `~/Documents/wowyaa-m3-evidence` (`maestro-junit-3068b95.xml`, `screens/`, `SUMMARY.txt`).

## Bugs found on device and fixed

1. **Canvas not square (702b688).** `width: '100%'` with `aspectRatio: 1` laid out at 420×984 pt and pushed "next" off-screen, failing 2 of 3 flows. Fixed in 341ca63: an explicit side from the window, capped at 420 pt and 45% of screen height. Now 420×420 pt.
2. **Vertical strokes swallowed by page scroll.** A downward swipe left no ink, which would break letters like alif. Fixed in 3068b95: the play screen stops scrolling on tracing items and the canvas refuses responder hand-off. Confirmed on device (`screens/trace-6-vertical-3068b95.png`).
3. **Stale feedback on the done screen.** The last item's "try again" stayed under the done message. Fixed in 3068b95 (`screens/session-done-3068b95.png`).

## Known gaps (not blocking M3)

- Thresholds are hypotheses from synthetic fixtures; they need recalibration with consented child samples and educator review.
- ML Kit Digital Ink is not integrated; the spike needs physical Android/iOS devices.
- Simulator swipes are not finger input; touch latency budgets (§12) stay open until device testing.
- Font-derived guides (Noto Naskh Arabic, OFL) await approval of the teaching typeface.
- Android still unverified (no Android SDK on the Mac).
