# Offline test matrix

Legend: ✅ automated and passing · 🧪 automated in Node/Jest only (not on device) · 📋 manual/device, not yet run

| #   | Scenario (plan §7.1, §12, §17)                                                        | Layer      | Status                   | Where                                        |
| --- | ------------------------------------------------------------------------------------- | ---------- | ------------------------ | -------------------------------------------- |
| 1   | Fresh install creates full schema, FKs on                                             | SQLite     | 🧪                       | `offline-storage/test/migrations.test.ts`    |
| 2   | Upgrade N→N+1 keeps learner data                                                      | SQLite     | 🧪                       | same                                         |
| 3   | Aborted upgrade rolls back completely                                                 | SQLite     | 🧪                       | same                                         |
| 4   | Older build refuses newer DB (no downgrade)                                           | SQLite     | 🧪                       | same                                         |
| 5   | Duplicate attempt insert is a no-op                                                   | Repository | 🧪                       | `repository.test.ts`                         |
| 6   | Concurrent duplicate submissions (double tap) record once                             | Repository | 🧪                       | same                                         |
| 7   | Mastery write failure rolls back the attempt                                          | Repository | 🧪                       | same                                         |
| 8   | Child deletion cascades to every child table                                          | Repository | 🧪                       | same                                         |
| 9   | Timezone change keeps UTC ordering                                                    | Repository | 🧪                       | same                                         |
| 10  | Language/device setting change leaves progress untouched                              | Repository | 🧪                       | same                                         |
| 11  | App kill mid-session, relaunch recovers (session → abandoned, progress kept)          | Repository | 🧪 file-backed DB        | same                                         |
| 12  | 10k synthetic attempts within budget                                                  | Repository | 🧪 Node only             | same. Device budget in M4                    |
| 13  | App boots with only local DB + bundled content, no fetch                              | App        | 🧪 Jest                  | `apps/mobile/test/App.test.tsx`              |
| 14  | Unreviewed content refused in release mode                                            | App        | 🧪 Jest                  | same                                         |
| 15  | Storage failure shows a recoverable error screen                                      | App        | 🧪 Jest                  | same                                         |
| 16  | Runtime guard blocks fetch/XHR/WebSocket when enforced                                | App        | 🧪 Jest                  | `network-guard.test.ts`                      |
| 17  | No network calls / tracking SDKs / camera-mic permissions in source and config        | Static     | ✅ CI                    | `pnpm guard:offline`                         |
| 18  | JS bundles build for Android and iOS                                                  | Build      | ✅ local, CI job written | `pnpm --filter @huroofi/mobile bundle:check` |
| 19  | Airplane-mode fresh install → profile → all 3 games → parent progress → kill/relaunch | Device E2E | 📋 M2–M4 (Maestro)       | needs Development Builds on devices          |
| 20  | WAL journal mode accepted on iOS and Android                                          | Device     | 📋                       | `PRAGMA journal_mode` result to be logged    |
| 21  | Proxy/network inspector audit in child mode (separate app vs OS traffic)              | Device     | 📋                       | before beta                                  |
| 22  | Digital Ink works offline after model download                                        | Device     | 📋 spike                 | `docs/m0/digital-ink-feasibility-spike.md`   |

Note on bundled strings: Hermes bundles contain library URL strings (React/Expo docs links, a `json-schema.org` id, `classic-assets.eascdn.net` from expo-asset). These are inert strings. The runtime guard blocks any JS request in non-dev builds, and the device audit (#21) is what proves real traffic.
