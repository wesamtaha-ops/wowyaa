# Audio recording spec: ar-foundations-v1

For the voice talent and audio editor. Every file needs a sidecar with license and credit (see `packages/curriculum/packs/ar-foundations-v1/assets/README.md`).

## Format

- Modern Standard Arabic, native speaker, warm and clear. Child-directed, not sing-song.
- AAC in `.m4a`, mono, 44.1 kHz, about 64–96 kbps. Peak −1 dBFS, integrated loudness around −16 LUFS, with every file loudness-matched.
- Quiet room, no music or reverb. Trim to ≤150 ms of silence at each end.
- File names and `assetId`s must match `pack.json` exactly.

## Required for M2 (current seed)

| Set           | Count | assetId pattern           | Notes                                                                                                                                                                                                            |
| ------------- | ----- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Letter sounds | 28    | `audio.letter.<id>.sound` | **The isolated sound, not the letter name.** Stops (ب ت د ط ق ك ء) take a short fatha so they're audible, e.g. "بَ". The emphatic pairs س/ص، ت/ط، ه/ح must be clearly distinct, and a reviewer signs off on that |
| Letter names  | 28    | `audio.letter.<id>.name`  | e.g. "باء"                                                                                                                                                                                                       |
| Words         | 11    | `audio.word.<id>`         | Fully vocalized as displayed in `pack.json`                                                                                                                                                                      |
| Prompts       | ~6    | `audio.prompt.*`          | "Listen and choose the letter", "Build the word", "Try again, you can do it", "Well done", and so on. Copy written by the educator                                                                               |

Durations go in each sidecar's `durationMs`. Measure them with your editor or `ffprobe`.

## Review

An Arabic-speaking reviewer checks each file for pronunciation, vocalization and distinguishability, and is recorded in the pack's `reviewedBy` before release (plan §3.3).
