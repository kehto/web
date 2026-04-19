---
phase: 24-drift-core-06-cleanup
verified: 2026-04-19T00:00:00Z
status: passed
score: 5/5 must-haves verified
ci_evidence:
  build: https://github.com/kehto/monorepo/actions/runs/24629192335
  unit: https://github.com/kehto/monorepo/actions/runs/24629192337
  e2e: https://github.com/kehto/monorepo/actions/runs/24629192336
  atomic_commit: 4c12cd2
  metadata_commit: c92faa9
---

# Phase 24: DRIFT-CORE-06 Cleanup — Verification Report

**Phase Goal:** `packages/runtime/src/core-compat.ts` is deleted and every live type it shimmed is re-imported from its rightful home — v1.4 npm publication ships clean code with no compatibility scaffolding and no dead NIP-01 paths.

**Verified:** 2026-04-19
**Status:** passed
**Re-verification:** No — initial verification
**Mode:** Read-only audit (tests/e2e were previously captured in atomic commit 4c12cd2; CI green on all 3 checks)

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                          | Status     | Evidence                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `packages/runtime/src/core-compat.ts` does not exist                                           | VERIFIED   | `test ! -f` passes; file absent from filesystem                                                          |
| 2   | No `core-compat` references anywhere in live source/tests/fixtures/specs                       | VERIFIED   | `git grep -n "core-compat" -- packages/ apps/ tests/ specs/` → 0 hits                                    |
| 3   | `Capability`, `ServiceDescriptor`, `REPLAY_WINDOW_SECONDS` re-imported from canonical sources   | VERIFIED   | `types.ts:9` imports Capability from `@kehto/acl/capabilities`; `replay.ts:16` inlines `= 30`; `index.ts:85-87` re-exports |
| 4   | Zero dead NIP-01 symbols (`BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS`) in runtime/services src | VERIFIED   | Grep across `packages/runtime/src` and `packages/services/src` → No matches                              |
| 5   | ACL live symbols `CapabilityResolution` and `resolveCapabilitiesNub` preserved at `packages/acl/src/resolve.ts` | VERIFIED   | `CapabilityResolution` at resolve.ts:46 (interface) + multiple usages; `resolveCapabilitiesNub` at resolve.ts:232 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                            | Expected                                                          | Status    | Details                                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `packages/runtime/src/core-compat.ts`                               | Deleted                                                           | VERIFIED  | File absent (test ! -f passed)                                          |
| `packages/runtime/src/types.ts` (Capability import)                 | `import type { Capability } from '@kehto/acl/capabilities'`       | VERIFIED  | Line 9 matches canonical import                                         |
| `packages/runtime/src/types.ts` (ServiceDescriptor)                 | `export interface ServiceDescriptor { ... }`                      | VERIFIED  | Line 360 declares interface; re-exported from index.ts:87               |
| `packages/runtime/src/replay.ts`                                    | Inline `const REPLAY_WINDOW_SECONDS = 30`                         | VERIFIED  | Line 16: `const REPLAY_WINDOW_SECONDS = 30;` (value parity with Phase 23) |
| `packages/runtime/src/index.ts`                                     | Public re-export of Capability + ServiceDescriptor from canonical | VERIFIED  | Lines 80-87 contain documented re-exports                               |
| `packages/acl/src/resolve.ts` (CapabilityResolution)                | Live interface preserved (scope-excluded from cleanup)            | VERIFIED  | Line 46 exports interface; used in 7 mapping functions                   |
| `packages/acl/src/resolve.ts` (resolveCapabilitiesNub)              | Live function preserved                                           | VERIFIED  | Line 232 exports function                                                |
| `.planning/phases/24-drift-core-06-cleanup/24-ITERATION-LOG.md`     | Exists, ≥ 50 lines, contains "47 passed" + "0 skipped"            | VERIFIED  | 156 lines; "47 passed / 0 failed / 0 skipped / 14.2s" on line 43        |
| `.planning/phases/24-drift-core-06-cleanup/24-01-SUMMARY.md`        | Exists                                                            | VERIFIED  | 21173 bytes                                                              |
| `.planning/phases/24-drift-core-06-cleanup/24-02-SUMMARY.md`        | Exists                                                            | VERIFIED  | 26590 bytes                                                              |

### Key Link Verification

| From                              | To                            | Via                                                                | Status | Details                                                       |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------ | ------ | ------------------------------------------------------------- |
| runtime/src/types.ts              | @kehto/acl/capabilities       | `import type { Capability }`                                       | WIRED  | Line 9 of types.ts                                            |
| runtime/src/event-buffer.ts       | @kehto/acl/capabilities       | `import type { Capability }`                                       | WIRED  | Line 9                                                        |
| runtime/src/runtime.ts            | @kehto/acl/capabilities       | `import type { Capability }` + usage in acl-revoke/grant dispatch  | WIRED  | Line 15 + usage at 368/369/1119                               |
| runtime/src/acl-state.ts          | @kehto/acl/capabilities       | `import type { Capability }` + CAP_MAP / bitsToCapabilities        | WIRED  | Line 8 + usage through capToBit/bitsToCapabilities            |
| runtime/src/enforce.ts            | @kehto/acl/capabilities       | `import type { Capability }` + enforce gates                       | WIRED  | Line 12 + usage throughout enforce / enforceNub               |
| runtime/src/index.ts              | public API                    | Re-export `Capability` + `ServiceDescriptor`                        | WIRED  | Lines 85-87; documented comment block lines 80-82             |
| runtime/src/replay.ts             | (inline)                      | `const REPLAY_WINDOW_SECONDS = 30` — no external import needed     | WIRED  | Line 16 local; line 64 uses in `getReplayWindow?.() ?? ...`   |

### Requirements Coverage

| Requirement | Description                                         | Status    | Evidence                                                                                          |
| ----------- | --------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| DRIFT-01    | Delete core-compat.ts and re-home shimmed types     | SATISFIED | File deleted; Capability/ServiceDescriptor/REPLAY_WINDOW_SECONDS re-homed to canonical sources    |
| DRIFT-02    | Remove dead NIP-01 paths from runtime/services src  | SATISFIED | Zero BusKind/AUTH_KIND/DESTRUCTIVE_KINDS/STATE_TOPICS in runtime/src or services/src              |

### Anti-Patterns Found

None. Scan across `packages/runtime/src` and `packages/services/src` found:
- Zero `BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS` references
- Zero `core-compat` imports or references anywhere in live paths
- No TODO/FIXME/placeholder introduced by this refactor

### CI / Test Evidence (Captured, Not Re-Run)

Per audit instructions this was a read-only verification. Evidence from atomic commit 4c12cd2:

| Check        | Result                       | Source                                                              |
| ------------ | ---------------------------- | ------------------------------------------------------------------- |
| type-check   | 8/8                          | Executor local run, logged in 24-ITERATION-LOG.md                   |
| unit tests   | 442 passed / 0 failed / 0 skipped | Matches Phase 23 baseline exactly (442/0)                      |
| e2e tests    | 47 passed / 0 failed / 0 skipped / 14.2s | 24-ITERATION-LOG.md line 43 + line 80                    |
| CI Build     | green                        | https://github.com/kehto/monorepo/actions/runs/24629192335          |
| CI Unit      | green                        | https://github.com/kehto/monorepo/actions/runs/24629192337          |
| CI E2E       | green                        | https://github.com/kehto/monorepo/actions/runs/24629192336          |

### Human Verification Required

None. All success criteria are programmatically verifiable and all verified against live state.

### Gaps Summary

No gaps found. Phase 24 achieved its stated goal:
- `core-compat.ts` is deleted
- All shimmed live types re-homed to canonical sources (`@kehto/acl/capabilities`, `./types.ts`, inline constant)
- All dead NIP-01 symbols removed from runtime/services source
- ACL-scope-excluded live symbols (CapabilityResolution, resolveCapabilitiesNub) preserved
- Test parity maintained with Phase 23 baseline (442 unit, 47 e2e)
- CI green on 4c12cd2 across all three workflows

v1.4 npm publication precondition — clean code with no compatibility scaffolding — is satisfied.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier, read-only audit mode)_
