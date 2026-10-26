# ADR 0002: Curriculum packs are immutable, semver-versioned and gate-validated

- **Status:** Accepted (M1)
- **Date:** 2026-10-26

## Context

Curriculum must be reviewable by educators, reproducible, and safe to evolve without breaking stored mastery (§3, §7).

## Decision

- A pack is one JSON document validated by `CurriculumPackSchema` (`packages/content-schema`). Fields: `packId`, semver `version`, `schemaVersion`, `status: draft|reviewed`, letters, skills, words, confusion sets, activity items, and `skillIdAliases` for renamed skills.
- Skills carry an integer `version`. A changed skill gets a new version, never an in-place edit. Stored mastery references stable `skillId`s; renames go through `skillIdAliases`.
- All Arabic text must be Unicode NFC (schema-enforced). Display text keeps full vocalization. The canonical form is derived by stripping marks and is checked against the display form.
- `validatePack` (`packages/curriculum`) runs in two modes:
  - **draft:** structural errors fail (unknown refs, cycles, answer-key drift, untaught features, ambiguous choices). Editorial gaps (missing reviews, assets, coverage) are warnings.
  - **release:** editorial gaps become errors, and `status` must be `reviewed`.
- **Untaught-feature gate:** a `construct_word` item fails if its word uses hamza, shadda, sukun, long vowels, diphthongs, tanween, ta marbuta or a short vowel that is not covered by the item's target skills or their prerequisites. Each letter's `.sound` skill must also be covered.
- At boot, the app computes SHA-256 of the bundled pack and records it in `content_packs`. Exactly one pack is active.

## Consequences

- The current seed is `ar-foundations-v1@1.0.0-draft.1`. It passes draft validation and **cannot** pass release validation until an educator reviews it and assets exist. That is intended.
- Asset manifests (`AssetManifestSchema`) are defined, but the asset pipeline that produces them is M2 work.
