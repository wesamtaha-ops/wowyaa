# ADR 0001: Offline-first core with no runtime backend

- **Status:** Accepted (M1)
- **Date:** 2026-10-26

## Context

Children must be able to play on first launch in airplane mode. The plan forbids blocking on login, network, remote config or model downloads, and forbids uploading child audio, ink or interaction data (§1.2, §12, §14).

## Decision

1. Everything the P0 core needs is bundled: the app, the curriculum pack (JSON in `packages/curriculum/packs`), migrations and the activity rules.
2. Learner state lives only in on-device SQLite through `ProgressRepository`. Content is immutable versioned JSON, not SQL rows.
3. Offline is enforced in three layers:
   - **Lint:** domain packages cannot import HTTP clients or use `fetch`/`XMLHttpRequest`/`WebSocket`.
   - **Static CI guard** (`tooling/offline-network-guard`): no network calls or remote URLs in source, no ads/tracking SDKs, camera/mic/location permissions absent and explicitly blocked on Android.
   - **Runtime guard** (`apps/mobile/src/network-guard.ts`): in non-dev builds every JS fetch/XHR/WebSocket is refused. Dev builds only warn, because Metro needs the network.
4. Boot is local only (`apps/mobile/src/bootstrap.ts`): migrate, validate the bundled pack, activate it, and mark sessions interrupted by an app kill as `abandoned`.

## Consequences

- No cloud backup: uninstalling loses progress. This must be stated in the parent area (risk table §19).
- OS-level traffic (system services, store updates) is outside JS and can't be blocked by the app. The device network audit covers it (`docs/qa/offline-test-matrix.md`).
- Future P1 sync must be added behind an explicit parental opt-in and a new ADR. It must not be added to child gameplay.
