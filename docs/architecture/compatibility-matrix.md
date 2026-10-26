# Dependency compatibility matrix

**Verified:** 2026-10-26, against the npm registry and installed `node_modules` (not from memory).
**Rule:** Expo SDK 58 is the anchor. Native modules use the version Expo bundles (`expo/bundledNativeModules.json`), installed with `npx expo install`. Never bump a native module on its own.

## Runtime (P0 app)

| Package                        | Pinned   | Source of truth | Status                         | Notes                                                         |
| ------------------------------ | -------- | --------------- | ------------------------------ | ------------------------------------------------------------- |
| expo                           | ~58.0.19 | npm latest      | ✅ installed                   | Node `^22.13 \|\| ^24.3 \|\| ^26`                             |
| react-native                   | 0.88.0   | Expo 58 bundled | ✅ installed                   | New Architecture on. Android minSdk 24, iOS min 15.1          |
| react                          | 19.3.0   | Expo 58 bundled | ✅ installed                   |                                                               |
| expo-sqlite                    | ~58.0.14 | Expo 58 bundled | ✅ installed, bundled by Metro | See finding F1                                                |
| expo-crypto                    | ~58.0.7  | Expo 58 bundled | ✅ installed                   | SHA-256 for pack checksums, UUIDs                             |
| expo-dev-client                | ~58.0.15 | Expo 58 bundled | ✅ installed                   | Development Builds are required for native modules (plan §22) |
| react-native-safe-area-context | ~5.10.1  | Expo 58 bundled | ✅ installed                   |                                                               |
| @shopify/react-native-skia     | 2.14.0   | Expo 58 bundled | ⏸ M2 (not installed yet)       | peers: RN ≥0.78, reanimated ≥4, worklets ≥0.7 ✅              |
| react-native-reanimated        | 4.7.1    | Expo 58 bundled | ⏸ M2                           | peers: RN 0.86–0.88 ✅, worklets 0.13.x                       |
| react-native-worklets          | 0.13.0   | Expo 58 bundled | ⏸ M2                           | peers: RN 0.86–0.88 ✅                                        |
| react-native-gesture-handler   | ~3.3.0   | Expo 58 bundled | ⏸ M2                           | Needed for drag tiles / tracing                               |
| expo-audio                     | ~58.0.10 | Expo 58 bundled | ⏸ M2                           | Bundled audio playback                                        |
| expo-secure-store              | ~58.0.2  | Expo 58 bundled | ⏸ M4                           | Derived parental PIN (plan §7)                                |
| zod                            | 4.6.7    | npm latest      | ✅                             | ≥4.6.6 required (GHSA-mrhx-c7xc-m3w5)                         |
| zustand                        | —        | —               | ⏸ M2                           | Not needed until gameplay UI                                  |

Skia, Reanimated, Worklets and Gesture Handler are deliberately **not installed in M1**: the shell does not use them and the plan says to avoid unwarranted dependencies. Their versions are locked here so M2 installs exactly these.

## Native Digital Ink (proposed bridge)

| Item               | Value                                                                     | Verified how                 | Status                                               |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| Android artifact   | `com.google.mlkit:digital-ink-recognition:19.0.0`                         | Official ML Kit Android docs | 📄 docs only, see F2                                 |
| Android min SDK    | 23                                                                        | ML Kit docs                  | ✅ below RN 0.88's minSdk 24                         |
| iOS pod            | `GoogleMLKit/DigitalInkRecognition` 8.0.0                                 | Official ML Kit iOS docs     | 📄 docs only, see F2                                 |
| Arabic model tag   | `ar` (also `ar-x-gesture`)                                                | ML Kit base-models page      | ✅ listed                                            |
| Model size         | ~20 MB per language, downloaded via `RemoteModelManager` / `ModelManager` | ML Kit docs                  | ⚠️ not bundled: first use needs a download           |
| Existing RN bridge | none mature on npm (`@nitro-mlkit/digital-ink` 0.1.0-beta only)           | npm search                   | ➡️ build our own Expo module in `native/digital-ink` |
| Expo Go            | not supported                                                             | Expo docs (plan §22)         | Development Build only                               |

## Tooling

| Tool                          | Pinned                             | Notes                                                                                                                                             |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node                          | 22 (`.nvmrc`), engines ≥22.13      | `node:sqlite` used by storage tests needs ≥22.13 without a flag                                                                                   |
| pnpm                          | 10.28.0                            | `node-linker=hoisted` for Expo autolinking/Metro                                                                                                  |
| turbo                         | 2.11.10                            |                                                                                                                                                   |
| TypeScript                    | 6.0.3                              | ⚠️ **Not 7.x**: Expo 58's template pins `~6.0.3` and `typescript-eslint@8.72` supports `<6.1.0`. TS 7.0.2 is `latest` on npm but would break lint |
| ESLint                        | 10.13.0 + typescript-eslint 8.72.0 | Flat config, boundary rules in `eslint.config.mjs`                                                                                                |
| Vitest                        | 5.0.5                              | Pure packages                                                                                                                                     |
| Jest / jest-expo              | 30.5.2 / ~58.0.12                  | App package                                                                                                                                       |
| @testing-library/react-native | 14.1.0                             | v14 APIs are async (`await render`, `await fireEvent`)                                                                                            |
| tsx                           | 4.23.15                            | Runs tooling CLIs                                                                                                                                 |

## Findings

- **F1: expo-sqlite exclusive transactions open a second connection.** `withExclusiveTransactionAsync` creates a new connection per transaction (`useNewConnection: true` in expo-sqlite 58.0.14 source). `PRAGMA foreign_keys` is per connection, and a pragma inside an open transaction is a no-op. So `ON DELETE CASCADE` (child data deletion) would silently not fire there. **Decision:** one connection, serialized in JS, with `BEGIN IMMEDIATE` (`packages/offline-storage/src/serialized.ts`). Covered by tests.
- **F2: ML Kit hosts could not be reached from the build container.** `dl.google.com` (Google Maven) and CocoaPods trunk returned 403 through the sandbox proxy. Versions above come from the official docs pages, not from resolving the artifacts. The Android/iOS spike must confirm they resolve.
- **F3: dependency audit.** Two high advisories exist, both only in `@expo/cli`, which is build tooling and not shipped in the app bundle: `node-forge` (GHSA-86w9-cpqp-85rv, no patched release) and `zod@3.25.76` (GHSA-mrhx-c7xc-m3w5). They are ignored explicitly in `package.json` → `pnpm.auditConfig`. Re-check on every Expo patch bump.
- **F4: Metro bundle smoke passes.** `expo export` bundled Android (796 modules) and iOS (797 modules) to Hermes bytecode. `node:sqlite` is absent from both bundles.
