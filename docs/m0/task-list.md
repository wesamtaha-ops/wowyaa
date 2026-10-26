# M0 + M1 task list (ordered by dependency)

Status: ✅ done and tested · 🟡 partly done or draft · ⛔ blocked (reason given) · ⏭ belongs to a later milestone

## M0 Discovery / feasibility

| #   | Task                                                                             | Depends on   | Status                                 | Evidence                                                                                                       |
| --- | -------------------------------------------------------------------------------- | ------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0.1 | Inspect repo and toolchain                                                       | —            | ✅                                     | Empty start; Node 22.22, pnpm 10.28                                                                            |
| 0.2 | Dependency compatibility matrix                                                  | 0.1          | ✅                                     | `docs/architecture/compatibility-matrix.md`                                                                    |
| 0.3 | Workspace structure and dependency boundaries                                    | 0.2          | ✅                                     | `docs/architecture/overview.md`, `eslint.config.mjs`                                                           |
| 0.4 | Curriculum schema and draft seed (28 letters, words, 12 sound + 12 tracing sets) | 0.3          | 🟡 draft                               | `packages/curriculum/packs/ar-foundations-v1/pack.json`. Needs educator review                                 |
| 0.5 | Map the 3 activities to skills (M0 exit gate)                                    | 0.4          | ✅                                     | 7 construct_word, 26 match_sound_letter, 29 trace_letter items. Test `maps all three activity types to skills` |
| 0.6 | Design brief / Faseeh character bible                                            | —            | ⛔ needs a designer                    | `docs/m0/design-brief.md` lists requirements and open decisions                                                |
| 0.7 | Device matrix                                                                    | —            | 🟡 proposal                            | `docs/m0/digital-ink-feasibility-spike.md`. Needs your device list                                             |
| 0.8 | ML Kit native spike                                                              | 0.2, devices | ⛔ needs devices and native toolchains | Protocol and doc-verified facts recorded. No device results                                                    |

## M1 Foundation

| #    | Task                                                          | Depends on     | Status                                   | Evidence                                                            |
| ---- | ------------------------------------------------------------- | -------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| 1.1  | pnpm + Turborepo monorepo, strict TS, ESLint/Prettier         | 0.3            | ✅                                       | root configs                                                        |
| 1.2  | Zod domain contracts (§6, §6.1–6.3, §21 reserved)             | 1.1            | ✅                                       | `packages/content-schema`, `packages/ai-gateway`                    |
| 1.3  | Seeded RNG + Arabic text utilities                            | 1.1            | ✅                                       | `packages/game-core`                                                |
| 1.4  | Activity SDK: contract, registry, capability registry, replay | 1.2            | ✅                                       | `packages/activity-sdk`                                             |
| 1.5  | Sample deterministic activity: construct_word rules           | 1.3, 1.4       | ✅                                       | `packages/activities-word`                                          |
| 1.6  | Curriculum validator (quality gates §3.3)                     | 1.2, 1.5       | ✅                                       | `packages/curriculum/src/validate.ts`, CLI `pnpm validate:content`  |
| 1.7  | Mastery-v1 updater (needed for atomic recordAttempt)          | 1.2            | ✅                                       | `packages/learning-engine`. `selectNext` scheduler is M3            |
| 1.8  | SQLite migrations + runner (transactional, no downgrade)      | 1.1            | ✅                                       | `packages/offline-storage/src/migrations.ts`                        |
| 1.9  | ProgressRepository (atomic, idempotent)                       | 1.7, 1.8       | ✅                                       | `packages/offline-storage/src/repository.ts`                        |
| 1.10 | Migration and persistence tests (§7.1)                        | 1.9            | ✅ (Node) / ⏭ device                     | See `docs/qa/m1-acceptance.md`                                      |
| 1.11 | Design tokens                                                 | 1.1            | ✅ placeholder values                    | `packages/design-system`                                            |
| 1.12 | Expo app shell that boots offline                             | 1.6, 1.9, 1.11 | ✅ in Jest + Metro bundle / ⛔ on device | `apps/mobile`                                                       |
| 1.13 | Offline guards (lint, static CI, runtime)                     | 1.12           | ✅                                       | `tooling/offline-network-guard`, `apps/mobile/src/network-guard.ts` |
| 1.14 | CI pipeline                                                   | all            | ✅ written / ⛔ not yet run on GitHub    | `.github/workflows/ci.yml`                                          |
| 1.15 | ADRs 0001–0003, data inventory, offline test matrix           | —              | ✅                                       | `docs/`                                                             |

## Deferred on purpose (later milestones)

- M2: construct_word and match_sound_letter UI, Skia/Reanimated/gesture-handler install, audio engine, asset pipeline, mascot MVP, Maestro E2E.
- M3: trace_letter + `TraceGeometryEvaluator`, `native/digital-ink`, `selectNext` scheduler.
- M4: parent area and gate, PIN in secure storage, `docs/qa/release-checklist.md`, `docs/qa/child-testing-protocol.md`, device benchmarks.
