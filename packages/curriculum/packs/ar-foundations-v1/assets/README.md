# ar-foundations-v1 assets

Put each recorded or licensed file here, with a sidecar `<file>.meta.json` next to it:

```json
{
  "assetId": "audio.letter.ba.sound",
  "license": "commissioned, all rights assigned to Huroofi",
  "credit": "Voice: <name>",
  "transcript": "بَ",
  "durationMs": 640
}
```

Then run `pnpm assets:build`. CI runs `pnpm assets:check` and fails if the manifest is stale.
Asset ids must match the `audioRef` / `imageRef` values in `pack.json`. The recording spec is in `docs/m2/audio-recording-spec.md`.
