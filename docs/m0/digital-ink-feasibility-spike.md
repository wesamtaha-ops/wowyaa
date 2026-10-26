# M0: Native Digital Ink feasibility spike

**Status: NOT EXECUTED. Blocked on physical devices and native toolchains.**
The build container has no Android SDK, Xcode or devices, and cannot reach Google Maven or CocoaPods. No device results exist. None are claimed here. Everything below is either verified from official docs (marked 📄) or is the protocol to run.

## What is verified from documentation (2026-10-26)

| Question (plan §9)               | Finding                                                                                                                                                                                                                                                     | Source                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| (a) Expo/RN compatibility        | ML Kit Android needs minSdk 23 (RN 0.88 uses 24 ✅). iOS pod `GoogleMLKit/DigitalInkRecognition` 8.0.0, Xcode ≥13.2.1. No maintained RN bridge on npm, so we build an Expo module. **Unverified:** iOS simulator arm64 support and New Architecture interop | 📄 ML Kit Android/iOS guides, npm search |
| (b) `ar` availability            | `ar` text model and `ar-x-gesture` listed                                                                                                                                                                                                                   | 📄 base-models page                      |
| (c) Model lifecycle              | Model must be downloaded before first use, ~20 MB per language, via `RemoteModelManager` (Android) / `ModelManager` (iOS). Supports check, download, delete                                                                                                 | 📄 ML Kit guides                         |
| (d) Offline reuse                | Docs imply on-device recognition after download. They do not state it explicitly. **Must be proven in airplane mode**                                                                                                                                       | 📄 (implied only)                        |
| (e) Latency                      | Unknown                                                                                                                                                                                                                                                     | needs devices                            |
| (f) Child single-letter accuracy | Unknown. Docs make no claim about children                                                                                                                                                                                                                  | needs consenting child samples           |
| (g) Dot/form error attribution   | Not provided by ML Kit. It returns candidates, not error categories                                                                                                                                                                                         | 📄 API shape                             |

## Consequence under the §9 go/no-go rule

The model is **not** present offline after install, because it needs a download. So the P0 core ships **geometry-only tracing**, and the optional model install goes behind a parent-controlled download screen. This decision is already implemented as interfaces and fallback (ADR 0003), so it doesn't wait on the spike.

## Spike protocol (to run on devices)

1. Create `native/digital-ink` as a local Expo module (`npx create-expo-module --local`) that implements `HandwritingRecognizer` methods: `isAvailable`, `getModelState`, `downloadModel` (parent screen only), `recognize(strokes, canvas, preContext)`, `deleteModel`. Recognition runs off the JS/UI thread.
2. Build Development Builds: `pnpm --filter @huroofi/mobile prebuild` then `expo run:android` / `expo run:ios` on physical devices.
3. Measure and record per device:
   - cold model download size and time (Wi-Fi)
   - airplane mode after download: recognition still works (pass/fail)
   - airplane mode with no model: returns `unavailable` within guard timeout (pass/fail)
   - p50/p95 latency for single isolated letters, 30 runs, warmed and cold
   - adult-written accuracy on all 28 isolated letters, 5 samples each (engineering baseline only)
4. Child accuracy (f) needs written guardian consent and the §18 protocol. It is **not** part of the engineering spike.
5. Check commercial/licensing terms of ML Kit for a children's app and Play Families / App Store kids rules. Needs a human or legal reviewer.

## Proposed device matrix (needs your confirmation of what you can test on)

| Role                             | Android                                 | iOS                      |
| -------------------------------- | --------------------------------------- | ------------------------ |
| Reference tablet (60 fps target) | Samsung Galaxy Tab A9+ class            | iPad (10th gen) or newer |
| Minimum supported (30 fps floor) | Android 7.0 / API 24, 2–3 GB RAM tablet | Oldest iPad on iOS 15.1+ |
| Phone portrait fallback          | mid-range Android phone                 | iPhone SE (2nd/3rd gen)  |

## Results log

| Date       | Device | OS  | Step | Result | Evidence |
| ---------- | ------ | --- | ---- | ------ | -------- |
| (none yet) |        |     |      |        |          |
