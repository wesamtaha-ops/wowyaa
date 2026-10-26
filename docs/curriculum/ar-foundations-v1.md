# ar-foundations-v1 (draft 1.0.0-draft.1)

**Status: engineering seed, NOT pedagogically reviewed.** Every skill and word has an empty `reviewedBy`. Release validation fails by design until an educator signs off and assets exist.

Source: `packages/curriculum/packs/ar-foundations-v1/pack.json` (JSON is the authored source; edits go through review).
Check: `pnpm validate:content` (draft) · `pnpm --filter @huroofi/content-validator validate:release`.

## Inventory

| Item                      | Count | Notes                                                                                                                                     |
| ------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Letters                   | 28    | Glyph, Arabic name, transliteration, IPA, dot family, non-connecting flag, audio refs                                                     |
| Skills                    | 90    | Per letter: `identify`, `sound`, `trace` (84) plus `vowel.fatha/kasra/damma`, `long_vowel.alif`, `decode.cvcvc_fatha`, `decode.long_alif` |
| Words                     | 11    | 8 from the plan's illustrative list plus 3 engineering seeds (قَلَم، جَمَل، وَلَد) for fatha-only decoding                                |
| Sound discrimination sets | 12    | 9 dot families + 3 similar-sound pairs (س/ص، ت/ط، ه/ح)                                                                                    |
| Tracing sets              | 12    | 9 dot families + 3 similar-shape groups. All 28 letters covered                                                                           |
| Activity items            | 62    | 7 construct_word (1 assessment), 26 match_sound_letter, 29 trace_letter                                                                   |

## Word gating (validator-enforced, plan §3.2)

| Word                              | Activity now?           | Why                                                                    |
| --------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| قَمَر، سَمَك، قَلَم، جَمَل، وَلَد | ✅ `decode.cvcvc_fatha` | Fatha-only, no hamza/shadda/sukun/long vowel                           |
| بَاب، كِتَاب                      | ✅ `decode.long_alif`   | Prerequisites include `long_vowel.alif` (and `vowel.kasra` for كِتَاب) |
| أَسَد                             | ❌ none                 | Hamza. Needs a hamza skill first                                       |
| تُفَّاح                           | ❌ none                 | Shadda + damma + long alif                                             |
| شَمْس                             | ❌ none                 | Sukun                                                                  |
| بَيْت                             | ❌ none                 | Diphthong + sukun                                                      |

Adding a construct item for a gated word under the wrong skill fails CI (`untaught_feature`). This is covered by a test.

## Known gaps (shown as validator warnings)

- 159 warnings in draft mode: 90 unreviewed skills, 11 unreviewed words, 55 items whose activity type is not registered yet (match/trace arrive in M2/M3), all asset references unresolved, and coverage below "≥3 practice + 1 assessment per skill".
- Seven letters (ا ك ل م ن و ي) have no sound-discrimination set yet. They need pedagogy input on sensible distractors.
- Emphatic pairs (س/ص، ت/ط) and ه/ح are hard for heritage learners. An audio reviewer must confirm the recorded prompts are distinguishable (plan §8.2).
- The word list needs to grow from 11 to 36 (plan §3.2), then to 60–100 after review.
