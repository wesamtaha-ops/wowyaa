# Huroofi AI (حُرُوفِي)

Offline-first Arabic literacy game for children aged 4–9. See [`docs/Huroofi_AI_Technical_Implementation_Plan.md`](docs/Huroofi_AI_Technical_Implementation_Plan.md) for the full plan. This repository currently covers **M0 + M1** (see `docs/qa/m1-acceptance.md`).

## Requirements

- Node ≥ 22.13 (`.nvmrc`), pnpm 10 (`corepack enable`)
- For device builds: Android Studio + SDK (minSdk 24), and/or Xcode with iOS ≥ 15.1 on macOS

## Commands

```bash
pnpm install
pnpm check              # typecheck, lint, tests, content validation, offline guard
pnpm test               # all unit/integration tests
pnpm validate:content   # curriculum quality gate (draft mode)
pnpm guard:offline      # static offline/privacy gate
pnpm --filter @huroofi/mobile bundle:check   # Metro bundle for Android + iOS
```

## Running on a device (Development Build, not Expo Go)

```bash
cd apps/mobile
pnpm prebuild            # generates android/ and ios/ (git-ignored)
pnpm android             # expo run:android, device connected via adb
pnpm ios                 # expo run:ios, macOS only
pnpm start               # Metro for an installed dev build
```

For the offline check: install the dev build, then turn on airplane mode, kill the app, and launch it. It must reach the home screen and keep created profiles across restarts. Record results in `docs/qa/offline-test-matrix.md`.

## Layout

See `docs/architecture/overview.md`. Domain packages are pure TypeScript and cannot import UI, SQLite or network code (lint-enforced).

## Docs

- Architecture: `docs/architecture/`
- Decisions: `docs/adr/0001-offline-first.md`, `0002-curriculum-pack-versioning.md`, `0003-handwriting-fallback.md`
- Curriculum: `docs/curriculum/ar-foundations-v1.md`
- Privacy: `docs/privacy/data-inventory.md`
- QA: `docs/qa/offline-test-matrix.md`, `docs/qa/m1-acceptance.md`
- M0: `docs/m0/`
