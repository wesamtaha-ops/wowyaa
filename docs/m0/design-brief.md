# M0 design brief (requirements; the creative work is still open)

This brief collects the requirements from plan §4 and §13 that design must meet. **No artwork exists yet.** The app uses a 🦊 emoji as an engineering placeholder, which plan §4 allows for prototypes only.

## Faseeh character bible: deliverables needed

- Primary silhouette, palette, proportions. A friendly, non-threatening fox explorer, with no stereotyped cultural costume.
- Poses and animation states, matching `mascotStates` in `packages/design-system`: neutral, celebratory, encouraging, thinking, asking, gently_correcting.
- Prohibited expressions: no anger, mockery or disappointment aimed at the child.
- Voice direction for the MSA voice talent.
- Delivery as SVG or optimized sprites with a low-performance variant. All original or licensed, with license and credit recorded per asset (`AssetEntrySchema`).

## Typeface

- Licensed Arabic face validated for stacked diacritics, shadda+vowel combinations and all joined forms on iOS and Android. Until then the system font is used (`typography.family` is unset).

## Constraints already encoded in tokens

- Touch targets ≥48 dp everywhere and ≥64 dp for pre-reader controls.
- Text contrast meets WCAG AA (tested).
- No error-red token. Wrong answers use a gentle `retry` tone.
- Reduced motion collapses all durations to 0.
- RTL layout with explicit LTR only for debug identifiers.

## Open decisions for you / design

1. Designer or studio for Faseeh and the illustration set.
2. Arabic typeface and its license.
3. Voice talent for MSA recordings (36+ words, 28 letter names, 28 letter sounds, prompts).
