# Data inventory (P0, as implemented in M1)

Everything below is stored **only on the device**, in SQLite (`huroofi.db`). Nothing is transmitted. There is no account, analytics, crash-reporting or ads SDK (CI-enforced by `pnpm guard:offline`).

| Table               | Data                                                                                                 | Personal?            | Retention                         | Deleted by `deleteChildData` |
| ------------------- | ---------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------- | ---------------------------- |
| `child_profiles`    | display name (free text, 1–40 chars, may be a nickname), age band `4-6`/`7-9`, avatar id, timestamps | Yes (name, age band) | Until parent deletes or uninstall | ✅                           |
| `parent_settings`   | play limit, audio on/off, reduced motion, optional-data flag (default off)                           | Linked to child      | Same                              | ✅ cascade                   |
| `learning_sessions` | pack id/version, start/end time, random seed, status                                                 | Linked to child      | Same                              | ✅ cascade                   |
| `activity_attempts` | activity id/type/version, input source, outcome, hints, response time, error codes, time             | Linked to child      | Same                              | ✅ cascade                   |
| `skill_evidence`    | per-skill outcome and hints per attempt                                                              | Linked to child      | Same                              | ✅ cascade via attempt       |
| `skill_mastery`     | mastery score, counts, review dates, algorithm version                                               | Linked to child      | Same                              | ✅ cascade                   |
| `content_packs`     | installed pack ids, versions, checksums                                                              | No                   | App lifetime                      | n/a                          |
| `device_settings`   | UI preferences as JSON                                                                               | No                   | App lifetime                      | n/a                          |
| `schema_migrations` | applied DB versions                                                                                  | No                   | App lifetime                      | n/a                          |

## Not collected

- No raw handwriting strokes, audio, camera frames, precise birth dates, contact data, location, device identifiers or advertising ids. `ProgressRepository` has no field that accepts raw ink.
- Android blocks `CAMERA`, `RECORD_AUDIO`, location, contacts and `AD_ID` in `app.json`. iOS declares no camera, mic, location or tracking usage strings.

## To do before beta (plan §14)

- Parent-facing "what we store" screen (M4).
- Parental PIN: store only a derived credential in platform secure storage, with throttling (M4, `expo-secure-store`).
- Threat model and legal review (GDPR, COPPA-style rules, Play Families, App Store Kids). This document is not a compliance certification.
