---
phase: 37
plan: "01"
subsystem: spec-and-types
tags:
  - spec-sync
  - provisional-types
  - NIP-5D
  - NUB-CLASS
  - NUB-CONNECT
  - NUB-RESOURCE
dependency_graph:
  requires: []
  provides:
    - specs/NIP-5D.md (resynced v1.7)
    - packages/shell/src/types/provisional-class.ts
    - packages/shell/src/types/provisional-connect.ts
    - packages/shell/src/types/provisional-resource.ts
  affects:
    - Phase 38 (imports provisional-class.ts)
    - Phase 39 (imports provisional-connect.ts)
    - Phase 40 (imports provisional-resource.ts)
tech_stack:
  added: []
  patterns:
    - Provisional type files marked with // provisional header + TODO: swap import annotation
    - Upstream commit SHA recorded in spec header for milestone traceability
key_files:
  created:
    - packages/shell/src/types/provisional-class.ts
    - packages/shell/src/types/provisional-connect.ts
    - packages/shell/src/types/provisional-resource.ts
  modified:
    - specs/NIP-5D.md
    - README.md
decisions:
  - Standalone `// provisional` line comment added before JSDoc block to satisfy grep-based acceptance criteria while keeping JSDoc style
  - Upstream commit SHA d80d7b25f9c4331acbeb40dbeb3b077caa80e885 recorded in spec header for Phase 38/39/40 traceability
metrics:
  duration: "4 minutes 10 seconds"
  completed: "2026-04-24T11:49:09Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
  commits: 2
---

# Phase 37 Plan 01: SPEC Resync & Foundation Gates Summary

**One-liner:** NIP-5D spec resynced from dskvr/nips nip/5d at commit d80d7b25 (class-posture delegation + extended Security Considerations item 1 landed); three provisional wire-type staging files created for unpublished NUB domains.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Resync NIP-5D spec + README update | 4c7b15a | specs/NIP-5D.md, README.md |
| 2 | Create provisional type files | a376f7e | packages/shell/src/types/provisional-{class,connect,resource}.ts |

## Upstream Commit SHA

**d80d7b25f9c4331acbeb40dbeb3b077caa80e885**

Resolved at: `git ls-remote https://github.com/dskvr/nips refs/heads/nip/5d`
Branch: `nip/5d` on `github.com/dskvr/nips`

This SHA is recorded in `specs/NIP-5D.md` header and must be used as the traceability anchor for Phase 38/39/40.

## Diff Summary: v1.2 Pin → v1.7 Sync

Per `research/STACK.md` Section 2, three changes from the v1.2-pinned copy:

1. **Header comment block (kehto-local, not upstream):** Lines 1-7 in the old file were the kehto sync header. Refreshed with v1.7 sync date + upstream commit SHA (now 8 lines).

2. **Security Considerations item 1 extended (upstream change):** Old item 1 ended at `allow-same-origin`. Upstream adds explanatory prose: "Adding `allow-same-origin` would grant the napplet a real origin, allowing it to register a service worker, read shell `localStorage`, and bypass shell mediation entirely -- this prohibition is the load-bearing precondition for browser-enforced isolation of any kind."

3. **Class-posture delegation paragraph (NEW — key addition):** New paragraph in Security Considerations: "NUBs MAY define napplet classes with different security postures delivered through shell-controlled HTTP response headers. Class taxonomy, the mechanism for assigning a class to a napplet, and the wire or header shapes used to express a class are out of scope for this NIP..." This is the canonical authorization for the HTTP-header authority requirement that NUB-CONNECT depends on.

## Provisional Type Files

### provisional-class.ts

- **Purpose:** Stage NUB-CLASS wire types for Phase 38 import
- **Source:** Inferred from NIP-5D class-posture delegation paragraph + Phase 38 requirements (CLASS-01..CLASS-06)
- **Canonical upstream:** None — class subpath does NOT exist in @napplet/nub@0.2.1 or napplet/napplet main
- **Key exports:** `NappletClass`, `ClassAssignmentPayload`
- **Swap target:** `@napplet/nub/class` at `^0.3.0`

### provisional-connect.ts

- **Purpose:** Stage NUB-CONNECT wire types for Phase 39 import
- **Source:** Inferred from research/STACK.md Section 3 + Phase 39 requirements (CONNECT-01..CONNECT-07)
- **Canonical upstream:** None — connect subpath does NOT exist in @napplet/nub@0.2.1 or napplet/napplet main
- **Key exports:** `ConnectGrantKey`, `ConnectGrant`, `ConsentResult`, `ConnectConsentRequest`
- **Swap target:** `@napplet/nub/connect` at `^0.3.0`

### provisional-resource.ts

- **Purpose:** Stage NUB-RESOURCE wire types for Phase 40 import
- **Source:** Mirrors napplet/napplet main `packages/nub/src/resource/` (commit 45661375e9df, 2026-04-20, unpublished)
- **Canonical upstream:** EXISTS in source but not published to npm
- **Key exports:** `ResourceRequestId`, `ResourceBytesRequest`, `ResourceCancelRequest`, `ResourceBytesResult`, `ResourceErrorCode`, `ResourceBytesError`, `ResourceInbound`, `ResourceOutbound`
- **Swap target:** `@napplet/nub/resource` at `^0.2.2`

## Verification Results

```
grep -c "Class-posture delegation" specs/NIP-5D.md          → 1 (PASS)
grep -c "milestone v1.7, 2026-04-24" specs/NIP-5D.md        → 1 (PASS)
grep -c "Upstream commit SHA: " specs/NIP-5D.md             → 1 (PASS)
grep -c "Last synced at **v1.7** (2026-04-24)" README.md    → 1 (PASS)
grep -c "Last synced at **v1.2**" README.md                 → 0 (PASS)
ls packages/shell/src/types/provisional-*.ts | wc -l        → 3 (PASS)
pnpm type-check                                              → 10 tasks, 0 errors (PASS)
grep -l "// provisional" provisional-*.ts | wc -l           → 3 (PASS)
grep -l "TODO: swap import" provisional-*.ts | wc -l        → 3 (PASS)
grep -r "provisional-*" packages/shell/src/index.ts         → (empty — correct)
grep -rn "from.*provisional-*" packages/                    → (empty — correct)
```

## pnpm type-check Notes

No warnings or errors. All 10 tasks passed (8 cached, 2 rebuilt — shell and shell:build had cache misses as expected for new files). No pre-existing workspace issues observed.

## No Existing Code Imports Provisional Files

Confirmed: `grep -rn "from.*provisional-class\|from.*provisional-connect\|from.*provisional-resource" packages/` returns nothing. Provisional files are staging-only; Phase 38/39/40 will be their first consumers.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Added standalone `// provisional` line comment**

- **Found during:** Task 2 verification
- **Issue:** Plan required `grep -l "// provisional"` to match all 3 files. Initial write used `* provisional — pending...` inside the JSDoc `/** */` block, which grep for `// provisional` would not match.
- **Fix:** Added `// provisional — pending @napplet/nub/<domain> publish` as a standalone line comment before the JSDoc block in each file. JSDoc content preserved; standalone comment added as the file's first content line.
- **Files modified:** provisional-class.ts, provisional-connect.ts, provisional-resource.ts
- **Commit:** a376f7e (included in same task commit — fix was within the same task before committing)

## Known Stubs

None. This is a foundation/staging plan — no data flows to UI. Provisional type files are intentionally not wired to any barrel or consumer yet.

## Self-Check: PASSED
