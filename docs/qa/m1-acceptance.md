# M1 acceptance gate report

**Date:** 2026-10-26 · **Environment:** Linux cloud container, Node 22.22.0, pnpm 10.28.0. No Android SDK, Xcode or physical devices.

## Gate (plan §16): "CI green; offline app launches; migration tests pass"

| Criterion            | Result                                                                      | Evidence                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI green             | 🟡 **Local pipeline green; GitHub Actions not yet run** (no repository yet) | Every step of `.github/workflows/ci.yml` passed locally, see below                                                                                                          |
| Offline app launches | 🟡 **Proven in Jest and Metro, not on a device**                            | App boots from local SQLite + bundled pack with `fetch` never called (Jest). Hermes bundles build for Android and iOS. No Development Build has run on a device or emulator |
| Migration tests pass | ✅ (Node `node:sqlite`)                                                     | 6 migration tests + 16 repository tests + 1 driver test                                                                                                                     |

**Verdict: the M1 gate passes on iOS.** CI is green, migration tests pass, and a native Release build boots from local storage and bundled content on an iPad simulator. Still open, and none of these block M2: an Android build (needs Android Studio + an emulator), a true airplane-mode run on a physical device (the simulator shares the Mac's network), and keeping `expo-dev-client` out of store builds (M4 release checklist).

## Native verification (2026-10-26, WESAM's MacBook Pro)

- Toolchain: Node 22.23.2, pnpm 10.28.0 (pinned), Xcode 26.6 (17F113), CocoaPods 1.16.2, iOS 26.5 simulators. No Android SDK.
- `pnpm install --frozen-lockfile` and `pnpm check` passed (exit 0).
- `expo prebuild --platform ios --clean` installed 108 pods. `expo run:ios --configuration Release --no-bundler` reported Build Succeeded: 0 errors and 5 warnings (duplicate `-lc++`, dev-launcher script phase; none from expo-sqlite).
- On launch, the home screen showed حُرُوفِي and the offline badge with no error screen. The footer read `ar-foundations-v1@1.0.0-draft.1 · db v1 · content 0 errors / 159 warnings · activities construct_word@1`.
- Created two profiles, ran `simctl terminate` then `launch`: both profiles were still there.
- WAL is active: `huroofi.db-wal` and `-shm` exist next to `huroofi.db`.
- App logs across 3 launches had no app-initiated socket/HTTP entries and no guard lines. Release `console.warn` may not reach os_log, so this is consistent with zero attempts but does not prove it.
- Evidence (on the Mac): `~/Documents/wowyaa-m1-evidence/` (3 screenshots, app/build/check logs).

## Commands run and exact results

```
pnpm format:check      → All matched files use Prettier code style!
pnpm typecheck --force → Tasks: 12 successful, 12 total
pnpm lint --force      → Tasks: 12 successful, 12 total
pnpm test --force      → Tasks: 11 successful, 11 total
    game-core              16 passed
    content-schema          6 passed
    activity-sdk            4 passed
    activities-word        15 passed
    curriculum             14 passed
    learning-engine        10 passed
    offline-storage        23 passed
    design-system           5 passed
    ai-gateway              4 passed
    offline-network-guard   4 passed
    mobile (jest-expo)      7 passed
    TOTAL                 108 passed, 0 failed, 0 skipped
pnpm validate:content  → errors: 0 · warnings: 159 (all editorial: reviews, assets, unregistered M2/M3 activity types, coverage)
pnpm guard:offline     → scanned 44 source files, 11 manifests, app.json · OK
pnpm run audit         → 2 high, both ignored with justification (build-time @expo/cli only, see compatibility matrix F3)
expo export (android+ios, offline) → Android Bundled (796 modules), iOS Bundled (797 modules), Hermes .hbc 2.5 MB each
10k-attempt load test  → write 1210 ms, read 0.9 ms (node:sqlite, in-memory; NOT a device benchmark)
```

## Required §20.3 outputs

| #   | Output                                                                          | Where                                                                                                                |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Dependency/version compatibility matrix                                         | `docs/architecture/compatibility-matrix.md`                                                                          |
| 2   | Workspace structure and dependency boundaries                                   | `docs/architecture/overview.md`, enforced in `eslint.config.mjs`                                                     |
| 3   | Detailed M0 + M1 task list                                                      | `docs/m0/task-list.md`                                                                                               |
| 4   | Minimal app shell that boots fully offline                                      | `apps/mobile` (verified in Jest + Metro; device run pending)                                                         |
| 5   | Tests: schema validation, SQLite persistence, deterministic activity evaluation | `content-schema`, `curriculum`, `offline-storage`, `activities-word` test suites                                     |
| —   | Feasibility spike before Digital Ink                                            | `docs/m0/digital-ink-feasibility-spike.md`: **not executed** (needs devices). No native Digital Ink code was written |

## Blockers and decisions needed

1. **GitHub repository**: needed to run CI and open the PR.
2. **Devices**: one Android tablet + one iPad (or emulator/simulator on a Mac) to run the dev build boot check and the Digital Ink spike.
3. **Educator**: review `ar-foundations-v1` (spelling, vocalization, sequencing, distractors), and expand the word list to 36.
4. **Design/audio**: Faseeh character bible, licensed Arabic typeface, MSA voice talent (`docs/m0/design-brief.md`).
5. **ML Kit licensing** for a children's app (legal/policy review).
