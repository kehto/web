---
phase: quick-260803-osr
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260803-OSR]
files_modified:
  - tests/e2e/paja-runtime-pointer.spec.ts
  - .planning/quick/260803-osr-remove-the-good-morning-specific-live-po/260803-osr-PLAN.md
  - .planning/quick/260803-osr-remove-the-good-morning-specific-live-po/260803-osr-SUMMARY.md
  - .planning/STATE.md
---

# Quick Task 260803-osr: Remove the Good Morning-specific Paja canary

## Objective

Remove the hard-coded Good Morning Protocol live-network E2E canary and its
environment switch from Paja, retain the deterministic generic pointer tests,
remove the misleading bounded-behavior statement from PR #234, and verify the
updated PR head.

## Protocol check

- NIP-5D PR #2303 head
  `eb45dfd7335b7f88cb53781984c553581d2b4c34` remains the pointer-loading
  authority. It requires signature, Blossom blob hash, aggregate hash, sandbox,
  and verified `srcdoc` behavior; it gives no napplet application a special
  role.
- `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` contains no pointer-resolution
  NAP. This is a NIP-5D loader concern rather than a NAP wire-message change.
- The deterministic `configured-relay-target` browser test continues to cover
  relay-hint fallback, verified bytes, CSP injection, `srcdoc`, and sandboxing.

## Tasks

1. Delete the Good Morning-specific constants and opt-in Playwright test from
   `tests/e2e/paja-runtime-pointer.spec.ts`. Do not change Paja production code,
   generic pointer resolution, or deterministic browser coverage. Add no
   changeset because shipped output is unchanged.
2. Run the focused pointer spec and the repository gates required for #234:
   build, type-check, unit, E2E, docs, CSP, AI-slop, and diff checks.
3. Commit the test and GSD records atomically, push the existing PR branch,
   remove the Good Morning bounded-behavior sentence from #234, update its E2E
   count to the observed result, and wait for fresh CI on the exact head SHA.

## Done

PR #234 has no app-specific Good Morning test or body language, generic
pointer-resolution coverage remains green, no package changeset is added, and
all checks attached to the new PR head pass.
