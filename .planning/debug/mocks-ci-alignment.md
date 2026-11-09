---
status: verifying
trigger: "CI failed in run 42368964963 after merging mocks; Version Packages PR never arrived."
created: 2026-11-07
updated: 2026-11-07
---

# Mocks CI and versioning

## Symptoms

Expected: merged mocks pass main CI and pending changesets open Version Packages.
Actual: PR CI 42368964963 and main CI 42368975122 fail three alignment tests.
Version Packages 42369086139 is intentionally skipped because main CI failed.

## Current Focus

hypothesis: mocks retained its pre-merge Napplet 0.32 development and JSR maps,
and its peer ceilings exclude the current host core 0.38 / nap 0.37 line.
test: reproduce the alignment suite, align package metadata and docs, rerun gates.
expecting: the existing guard covers mocks alongside every other host package.
next_action: open the fix PR, verify CI, then obtain merge approval for main recovery.

## Evidence

- Main 0379d164 contains mocks 0.0.0 and its pending minor changeset.
- Both failed runs report an omitted mocks peer-window row, old JSR imports,
  and lock importer resolving 0.32 instead of host core 0.38 / nap 0.37.
- publish.yml requires successful main CI before running changesets/action.
- Primary checkout has unrelated package.json and packages/shell/skills work;
  isolated fix uses ~/.worktrees/kehto/mocks-ci-alignment.

## Specification check

Read naps/NAP-LLM.md at napplet/naps draft #138 ref 8f741326c111,
the tools/content contract already cited by the mocks implementation.
This fix changes dependency metadata and validation only; no NAP API, wire
message, mock result, lifecycle, or capability behavior changes. Existing draft
authority and mock spec-gap decisions remain in their domain sources.

## Verification

Reproduced all three failures before editing. After alignment: focused suite
400/400, full units 2,861/2,861 (231 files), build, type-check, strict TypeDoc,
VitePress and docs audit (10 packages) pass. Changed-file aislop 0.12.0 scores
100/100 with zero findings; diff whitespace checks pass. No Playwright surface
changed; CI scope detection owns whether browser validation is needed.
Original minor mocks changeset remains intact; the metadata fix adds a patch
changeset, which combines into the same initial minor release.

Main recovery and automated Version Packages creation still require the fix
to land through its PR. No publisher dispatch or release tag is needed.
