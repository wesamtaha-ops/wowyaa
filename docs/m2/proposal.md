# M2 proposal: two playable activities

**Plan refs:** §8.1, §8.2, §16 (M2), §17 items 4–5. **Gate:** offline E2E tests pass, and every sample answer key is verified.

## Scope

| Slice | What                                                                                                                                                                | Package / files                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | `match_sound_letter` rules engine: seeded choice order, replay never penalizes, 2–4 distinct choices                                                                | `packages/activities-audio` (new)                                                             |
| 2     | Audio layer: `AudioCatalog` resolves `audioRef` through the asset manifest, `AudioPlayer` interface, missing-audio policy                                           | `packages/audio-engine` (new), `apps/mobile/src/audio/expo-player.ts` (`expo-audio ~58.0.10`) |
| 3     | Asset pipeline: builds `manifest.json` from `assets/<pack>/` plus sidecar metadata. Computes SHA-256 and size, and requires license, credit and duration            | `tooling/asset-pipeline` (new)                                                                |
| 4     | Session runner: ordered queue of eligible items, deterministic per-item seed, attempt id `session:activity:submission`, so each submission is recorded exactly once | `packages/game-core/src/session.ts`, `apps/mobile/src/game/`                                  |
| 5     | Screens: Word Construction (tap tile → next slot, tap slot → remove, undo, hint, check) and Sound Match (replay button, choices)                                    | `apps/mobile/src/screens/`                                                                    |
| 6     | Mascot MVP: `Faseeh` component driven by `mascotStates`, placeholder visuals, reduced motion respected                                                              | `packages/mascot` (new, pure state mapping) + app component                                   |
| 7     | Tests: unit, RNTL screen tests, Maestro offline flows                                                                                                               | per package, `apps/mobile/.maestro/`                                                          |

## Decisions in this proposal

- **Tap-to-place, not drag, for M2.** Plan §8.1 allows drag or tap. Tap works for pre-readers, is accessible, and needs no new native modules. Drag (gesture-handler + Reanimated) is added once fun is proven in child testing. Skia stays deferred until mascot art exists.
- **No placeholder or synthetic speech.** Plan §13 forbids machine-generated instruction audio, and §8.2 needs clean recorded segments. Missing-audio policy:
  - `match_sound_letter`: the sound _is_ the question, so items without resolvable audio are **hidden** (plan §8.2: "audio missing → hidden activity").
  - `construct_word`: word audio is optional support, so it stays playable with the illustration placeholder and the replay button hidden.
- Until recordings exist, **only Word Construction is playable on device.** Sound Match is fully built and tested with fixture audio, and it switches on automatically once real assets land in the manifest.

## Acceptance tests

1. Sound match: same seed gives the same choice order; every pack item has its answer among 2–4 unique choices; replay doesn't change score or hints; a correct answer records once; a wrong answer gets supportive feedback and allows retry.
2. All 7 construct_word and 26 match_sound_letter answer keys are solved in automated tests, so the validator has no `config_unvalidated` warnings for these types.
3. Missing audio hides match items and leaves construct items playable. An `audioReady=false` capability never crashes.
4. Asset pipeline rejects files without a license or credit, audio without duration, and checksum drift.
5. Session: a double-tapped "check" records one attempt; mastery updates through the repository; the session survives kill/relaunch.
6. Screen tests: complete a word, wrong answer → gentle retry with no red, undo, hint, reduced motion.
7. Maestro flows (run on the Mac iOS simulator): fresh launch → profile → play a word to completion → kill → relaunch → progress kept.

## Risks

- No recordings yet, so Sound Match can't be demoed on device until audio exists.
- Without real art the placeholder visuals undersell the product. Child testing must wait for M2 art.
- Maestro needs to be installed on your Mac (Homebrew), which needs your permission.

## External decisions needed

1. Voice talent and recording plan: 28 letter sounds, 28 letter names, 11+ words, plus prompts and rewards. A recording spec is in `docs/m2/audio-recording-spec.md`.
2. Illustrations for the 11 seed words.
