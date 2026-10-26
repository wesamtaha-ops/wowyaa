# M1 acceptance gate report

**Date:** 2026-10-26 · **Environment:** Linux cloud container, Node 22.22.0, pnpm 10.28.0. No Android SDK, Xcode or physical devices.

## Gate (plan §16): "CI green; offline app launches; migration tests pass"

| Criterion            | Result                                                                      | Evidence                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI green             | 🟡 **Local pipeline green; GitHub Actions not yet run** (no repository yet) | Every step of `.github/workflows/ci.yml` passed locally, see below                                                                                                          |
| Offline app launches | 🟡 **Proven in Jest and Metro, not on a device**                            | App boots from local SQLite + bundled pack with `fetch` never called (Jest). Hermes bundles build for Android and iOS. No Development Build has run on a device or emulator |
| Migration tests pass | ✅ (Node `node:sqlite`)                                                     | 6 migration tests + 16 repository tests + 1 driver test                                                                                                                     |

**Verdict: M1 passes everything that can be verified without devices.** Two items stay open before calling M1 fully closed: (1) the first green GitHub Actions run, and (2) one Development Build booting in airplane mode on one Android and one iOS device. M2 should not start UI work until (2) is done, because Skia/Reanimated native setup depends on a working dev build.

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
