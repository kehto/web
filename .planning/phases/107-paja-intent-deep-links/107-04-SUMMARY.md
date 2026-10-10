---
phase: 107-paja-intent-deep-links
plan: "04"
subsystem: verification-and-shipping
status: verified
requirements: [LINK-10, LINK-11, LINK-12]
---

# Phase 107 Plan 04: Verification and shipping

The feature is implemented and verified. PR creation is the final shipping step;
this task does not merge or release packages.

## Changes

- Synchronized active package, runtime, host, migration, and how-to documentation with URI invocation, ordered text params, publisher-safe IDs, and retained acceptance.
- Added a minor changeset for the four changed shipped packages: nip, services, shell, and Paja. Runtime/playground changes here are consumer documentation or unpublished app wiring, not a runtime package-output change.
- Updated static guards to distinguish the pinned working draft from the older installed package line. The local canonical type exception, legacy warnings, and removal conditions are explicit.
- Refactored Paja builder controls, persistence, config, and launcher integration into private modules. Kept one shared URI normalizer for host and injected binding.
- Fixed warm completion ordering, per-source launch correlation, omission versus empty text fields, explicit Share choices, and modal focus loss during sandbox readiness.

## Verification

- `pnpm build` — passed.
- `pnpm type-check` — passed.
- `pnpm test:unit` — 2,085 passed across 163 files.
- `pnpm test:e2e` — 120 passed; full final run 2.6 minutes.
- `pnpm docs:check` — passed strict TypeDoc and docs/package audit.
- AI-slop 0.12.0 — 95/100, zero errors, five size warnings; pinned configuration unchanged and no new suppressions.
- `git diff --check` — passed.
- Security — all 9 planned threats closed, ASVS L1, no risk waiver.

The earlier CVM timer failure passed in subsequent full runs without test changes.
The final docs run is sequential after build, avoiding transient declaration
removal by a concurrent browser build. The complete requirement/evidence matrix
is in `107-VERIFICATION.md`.

## Authority and decisions

Both draft heads were rechecked before shipping: NAP-INTENT PR #106
`fc121fc264615482143eda86125863d2e1f741a2`, and NIP-5D PR #2303
`020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. The verified launcher route is
conformant to these working contracts. Native external-origin sender support is
deferred as a documented upstream spec gap. The primary checkout's unrelated
package.json change remains untouched.

## Shipping

Pending creation of the PR from `feat/paja-intent-links` to `main`.
