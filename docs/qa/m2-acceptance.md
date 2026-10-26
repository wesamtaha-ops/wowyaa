# M2 acceptance report

**Gate (plan §16 M2):** offline E2E passes and every sample answer key is verified. **Status: passed on iOS (2026-10-26).**

| #   | Acceptance test (docs/m2/proposal.md)                                                                    | Result           | Evidence                                                                          |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| 1   | Sound match: seeded order, valid choices, free replay, one record per correct answer, retry after a miss | Pass             | `activities-audio` tests, `apps/mobile/test/sound-match.test.tsx` (fixture audio) |
| 2   | All 7 construct_word and 26 match_sound_letter answer keys solved                                        | Pass             | `packages/curriculum/test/pack.test.ts`                                           |
| 3   | Missing audio hides match items and leaves construct items playable                                      | Pass             | `activity-sdk/test/session.test.ts`, `apps/mobile/test/play-session.test.ts`      |
| 4   | Asset pipeline rejects missing license/credit, missing duration, checksum drift                          | Pass             | `tooling/asset-pipeline/test/pipeline.test.ts`; `pnpm assets:check` in CI         |
| 5   | Double-tapped check records once; mastery updates; session survives kill/relaunch                        | Pass             | `apps/mobile/test/play.test.tsx`, `play-session.test.ts`; Maestro relaunch flow   |
| 6   | Screen tests: complete a word, gentle retry (no red), undo, hint, reduced motion                         | Pass             | `apps/mobile/test/play.test.tsx`                                                  |
| 7   | Maestro: launch → profile → finish a word → next → kill → relaunch → profile kept                        | Pass (2/2 flows) | Mac, iPad Pro 13" (M5) sim, iOS 26.5, Maestro 2.12.0                              |

## Device run (WESAM's MacBook Pro, commit 414577e)

- `pnpm check`: 15 turbo tasks, 149 tests, 0 failures; content 0 errors / 133 warnings (unreviewed draft content, trace configs pending M3).
- iOS Release build with `expo-audio` 58.0.10 linked; launches with no Metro server; build info lists `construct_word@1,match_sound_letter@1`.
- Maestro `apps/mobile/.maestro`: `play-word-and-relaunch.yaml` and `leave-session.yaml` pass. A first run failed because of outside touches on the shared simulator (43 touches logged vs. 11 Maestro taps); the rerun on an untouched simulator matched exactly. Run Maestro on a simulator nobody else is driving.
- Evidence on the Mac: `~/Documents/wowyaa-m2-evidence` (screenshots, logs, `maestro-junit.xml`).

## Known gaps (not blocking M2)

- No recordings: Sound Match is hidden on device until real audio lands (`docs/m2/audio-recording-spec.md`).
- No illustrations: the word prompt shows the written word.
- Android unverified (no Android SDK on the Mac); physical-device airplane-mode run still open from M1.
- Mac setup notes: CocoaPods under Ruby 4 needs `LANG=en_US.UTF-8`; Maestro needs `JAVA_HOME=/opt/homebrew/opt/openjdk@17`.
