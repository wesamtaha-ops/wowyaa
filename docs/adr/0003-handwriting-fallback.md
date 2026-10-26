# ADR 0003: Geometry-first tracing; Digital Ink is optional secondary evidence

- **Status:** Accepted for P0; ML Kit integration pending the feasibility spike
- **Date:** 2026-10-26

## Context

ML Kit Digital Ink recognizes stroke sequences. It does not grade handwriting quality or stroke order. Its Arabic model (`ar`) is a ~20 MB download, not bundled. There is no evidence about accuracy on preschool children's input (§6.1, §9, §22).

## Decision

- Recognizers implement `HandwritingRecognizer` (`packages/ai-gateway`). The default implementation is `UnavailableHandwritingRecognizer`, so tracing works geometry-only from day one.
- Every native recognizer is wrapped by `withRecognitionGuard`. A timeout becomes `uncertain` and a crash becomes `unavailable`. Neither can block completion.
- `indeterminate` outcomes never reduce mastery (enforced in `mastery-v1` and tested through the repository).
- Model download is never automatic. `ensureModelInstalled` only reports state. Any download happens behind a parent-controlled screen (M4).
- Raw stroke coordinates are not accepted by `ProgressRepository`. Only outcomes and error codes are stored.

## Consequences

- The M3 `TraceGeometryEvaluator` is the grading authority. ML Kit can raise confidence when it agrees and trigger a gentle retry or `indeterminate` when it disagrees.
- Go/no-go follows §9 and is recorded in `docs/m0/digital-ink-feasibility-spike.md`.
