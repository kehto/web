---
phase: quick-260804-dql
plan: "01"
subsystem: paja-security
tags: [paja, nap-common, nap-fs, relay-policy, filesystem, vitest]
requires:
  - phase: PR-234 review
    provides: live review threads and immutable authority references
provides:
  - authoritative ledger for all 21 live PR #234 claims
  - Paja relay-hint and social-target policy regressions
  - pre-allocation filesystem write and revision bounds
affects: [quick-260804-dql-02, quick-260804-dql-03, review-resolution]
tech-stack:
  added: []
  patterns:
    - preflight encoded payload size before decode allocation
    - use the shared Paja relay policy for untrusted profile hints
key-files:
  created:
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-REVIEW-INVENTORY.md
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-01-SUMMARY.md
  modified:
    - packages/paja/src/browser-common.ts
    - packages/paja/src/browser-common.test.ts
    - packages/paja/src/browser-fs-support.ts
    - packages/paja/src/browser-fs.test.ts
key-decisions:
  - "NAP-COMMON nprofile relay TLVs are filtered through isPajaRelayAllowed while configured relay defaults remain intact."
  - "NAP-FS mandates decoded write limits but not a revision-hash ceiling; MAX_REVISION_BYTES is explicit Kehto DoS policy."
requirements-completed: [QUICK-260804-DQL]
coverage:
  - id: D1
    description: Paja filters untrusted profile relay hints and accepts both hex and npub social targets.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/paja/src/browser-common.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Paja rejects oversized encoded writes and revision candidates before allocation.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/paja/src/browser-fs.test.ts
        status: pass
    human_judgment: false
duration: 15m
completed: 2026-08-04
status: complete
---

# Quick 260804-dql Plan 01: P1 Review Boundaries Summary

**Live PR #234 claim inventory plus Paja relay-policy, social-target, and filesystem allocation protections backed by focused regressions.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-04T09:30:35Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Reconciled the live review to 16 unresolved threads and 21 distinct claims, with immutable NAP/NIP authorities and installed package-contract checks.
- Routed nprofile relay hints through the shared Paja allow-policy and normalized common follow/unfollow targets from either canonical hex or npub.
- Rejected oversized base64 write payloads before `atob`/decoded-buffer allocation and files above 16 MiB before revision hashing reads them.

## Verification

`pnpm exec vitest run packages/paja/src/browser-common.test.ts packages/paja/src/browser-fs.test.ts` — **13 passed**.

## Task Commits

1. **Task 1: Inventory live review claims** — `111c561` (`docs`)
2. **Task 2: Common/social regressions and fixes** — `0df7bd7` (`test`), `3336770` (`fix`), `a4c9dd9` (`test`), `5826849` (`fix`), `7b06c45` (`docs`)
3. **Task 3: Filesystem allocation regressions and fixes** — `84613ce` (`test`), `d5f9d12` (`fix`), `10c6b46` (`docs`)

## Decisions Made

- C01–C03 are direct protocol-security requirements. C04 is valid Kehto hardening: NAP-FS requires resource limits but intentionally leaves the revision implementation and bound to the runtime.
- No review replies or resolutions were made; later plans own push, replies, resolution, and exact-head CI.

## Deviations from Plan

None - plan executed as specified. The first inventory write was detected in the primary checkout before commit, removed there, and recreated in this worktree; no tracked source or planning artifact was changed outside this worktree.

## Known Stubs

None.

## Next Phase Readiness

Plans 02–06 can use the committed inventory rows and immutable-authority mappings. C05 onward remain unresolved and untouched by this plan.

## Self-Check: PASSED

All six plan artifacts/source files exist, all nine listed commits are present,
the focused 13-test run passes, and no stub markers were found in the modified
production or test files.
