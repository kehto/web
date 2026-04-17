---
phase: 10-spec-conformance-audit
verified: 2026-04-17T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: null
gaps: []
human_verification: []
---

# Phase 10: Spec Conformance Audit — Verification Report

**Phase Goal:** Produce an authoritative, cross-package inventory of every way kehto drifts from the canonical NIP-5D spec and the 8-nub napplet message surface.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Contributor can open kehto repo and find canonical NIP-5D spec at `specs/NIP-5D.md` with README pointing at upstream dskvr/nips | VERIFIED | `specs/NIP-5D.md` exists (125 lines, 7-line provenance header); README.md `## Specification` at line 14 with relative link to `./specs/NIP-5D.md` (line 18) and upstream URL `github.com/dskvr/nips/blob/nip/5d/5D.md` (line 19) |
| 2 | `specs/NIP-5D.md` body (tail -n +8) is byte-identical to canonical upstream | VERIFIED | `curl ... \| diff` against `https://raw.githubusercontent.com/dskvr/nips/nip/5d/5D.md` produced zero output (live-fetched during verification) |
| 3 | Audit document lists every spec requirement not yet satisfied by @kehto/* packages, grouped by package | VERIFIED | `docs/v1.2-NIP-5D-AUDIT.md` exists (177 lines) with 5 package sections (`## 1. @kehto/acl` through `## 5. Dispatch / Core API`) |
| 4 | Audit explicitly covers `window.nostr` prohibition, `shell.supports('perm:*')` namespace, shell-mediated signing/encryption | VERIFIED | `window.nostr` appears 4 times (DRIFT-SHELL-01); `perm:` appears 3 times (DRIFT-SHELL-02); `publishEncrypted` appears 10 times (DRIFT-RT-07/08, DRIFT-ACL-06, DRIFT-SHELL-03, DRIFT-SVC-01/08) |
| 5 | Audit covers every message type exported by all 8 `@napplet/nub-*` packages | VERIFIED | All 8 domains named (identity/ifc/keys/media/notify/relay/storage/theme) with ≥16 domain-prefixed matrix references (actual: 35); 27 matrix rows across all 8 domains in `## 6. 8-Domain Coverage Matrix` |
| 6 | Every drift item has a concrete owning package, one-line remediation, Target Phase | VERIFIED | 40 unique DRIFT-* IDs; every row has 6-column shape with ID \| Drift Item \| Current State \| Spec/Pkg Req \| Target Phase \| Remediation Note; every row cites `packages/<pkg>/src/<file>.ts[:line]` path or explicit absence |
| 7 | Downstream Phase 12/13/14 planners can filter mechanically by Target Phase | VERIFIED | Target Phase column-filter rollup: Phase 11: 3 rows, Phase 12: 32 rows, Phase 13: 3 rows, Phase 14: 2 rows → sums to 40 (matches unique DRIFT ID count exactly) |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `specs/NIP-5D.md` | 125 lines, 7-line provenance header, upstream byte-identical body | VERIFIED | 125 lines; lines 1-7 match expected header (Source: / Synced at: milestone v1.2, 2026-04-17 / Sync policy:); `diff <(tail -n +8 specs/NIP-5D.md) upstream` = zero output |
| `README.md` `## Specification` section | relative link + upstream URL + v1.2 sync milestone | VERIFIED | Line 14 `## Specification`; line 18 `[\`specs/NIP-5D.md\`](./specs/NIP-5D.md)`; line 19 `github.com/dskvr/nips/blob/nip/5d/5D.md`; line 20 `milestone **v1.2** (2026-04-17)` |
| `docs/v1.2-NIP-5D-AUDIT.md` | ≥150 lines; 5 sections + matrix; ≥25 DRIFT rows; ≥16 domain-prefixed matrix references | VERIFIED | 177 lines; 6 sections (5 package + matrix); 40 DRIFT rows; 35 domain-prefixed references; 27 matrix rows |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `README.md` | `specs/NIP-5D.md` | relative markdown link | WIRED | `[\`specs/NIP-5D.md\`](./specs/NIP-5D.md)` on README.md:18 |
| `README.md` | upstream `dskvr/nips nip/5d` | canonical URL | WIRED | `https://github.com/dskvr/nips/blob/nip/5d/5D.md` on README.md:19 |
| `docs/v1.2-NIP-5D-AUDIT.md` | `specs/NIP-5D.md` | relative markdown link | WIRED | `[\`specs/NIP-5D.md\`](../specs/NIP-5D.md)` on audit line 5 |
| `docs/v1.2-NIP-5D-AUDIT.md` | `packages/shell/src/shell-init.ts` | DRIFT-SHELL-01/-02/-03/-04 citations | WIRED | 4 citations; spot-checked `packages/shell/src/shell-init.ts:103` contains `window.nostr = { ... }` as claimed |
| `docs/v1.2-NIP-5D-AUDIT.md` | `packages/runtime/src/runtime.ts` | DRIFT-RT-01..10 citations | WIRED | 22 citations; spot-checked `packages/runtime/src/runtime.ts:746` contains `case 'signer':` as claimed |
| `docs/v1.2-NIP-5D-AUDIT.md` | `packages/acl/src/resolve.ts` | DRIFT-ACL-01..09 citations | WIRED | 10 citations; spot-checked `packages/acl/src/resolve.ts:109` contains `case 'signer':` with expected getPublicKey/getRelays/nip04/nip44 handling |

### Data-Flow Trace (Level 4)

N/A — phase output is a markdown document. Audit rows are "data" but do not render via a dynamic data source; each row is statically authored. Level 4 (data-flow) is not applicable to documentation artifacts. Traceability instead verified by spot-checking 3 DRIFT-* cited source paths (DRIFT-SHELL-01, DRIFT-RT-06, DRIFT-ACL-05) against real code at those lines — all confirmed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Upstream byte-identical body | `diff <(tail -n +8 specs/NIP-5D.md) <(curl -fsSL https://raw.githubusercontent.com/dskvr/nips/nip/5d/5D.md)` | zero output | PASS |
| 40 unique DRIFT IDs | `grep -oE 'DRIFT-(ACL\|RT\|SHELL\|SVC\|CORE)-[0-9]+' docs/v1.2-NIP-5D-AUDIT.md \| sort -u \| wc -l` | 40 | PASS |
| All 8 domain keywords present | `grep -qw <domain>` for each of identity/ifc/keys/media/notify/relay/storage/theme | all match | PASS |
| Target Phase rollup internally consistent | sum of `\| 11 \|`+`\| 12 \|`+`\| 13 \|`+`\| 14 \|` column-filter matches unique ID count | 3+32+3+2 = 40 = unique DRIFT count | PASS |
| DRIFT rows cite real code | spot-check DRIFT-SHELL-01 @ shell-init.ts:103, DRIFT-RT-06 @ runtime.ts:746, DRIFT-ACL-05 @ resolve.ts:109 | all 3 resolve to real code as claimed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SPEC-01 | 10-01-PLAN | kehto repo carries authoritative reference to current NIP-5D spec (local copy at `specs/NIP-5D.md`, synced from canonical) | SATISFIED | `specs/NIP-5D.md` exists, byte-identical to upstream; README points at local + canonical + v1.2 sync milestone. REQUIREMENTS.md line 23 marks `[x]` |
| SPEC-02 | 10-02-PLAN | Cross-package audit documents every NIP-5D requirement not yet satisfied by @kehto/runtime, @kehto/shell, @kehto/acl, or @kehto/services | SATISFIED | `docs/v1.2-NIP-5D-AUDIT.md` contains 40 DRIFT rows across 5 package namespaces, 27-row 8-domain matrix, 3 canonical-spec deltas, every row cites source path + remediation + Target Phase. REQUIREMENTS.md line 24 marks `[x]` |

No ORPHANED requirements — Phase 10 scope in REQUIREMENTS.md is exactly SPEC-01 and SPEC-02, both claimed by plans and both satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `docs/v1.2-NIP-5D-AUDIT.md` | 169-170 (in-document `## Summary`) | Aggregate count "Total DRIFT rows across sections 1-5: **33**" contradicts authoritative per-namespace breakdown `9+10+8+8+5 = 40` | Info | Minor internal inconsistency; the machine-consumable fields (DRIFT-* IDs, per-namespace counts, Target Phase column) are all correct. Plan 10-02 SUMMARY.md explicitly acknowledges this observation and leaves the audit body unchanged. Downstream planners should enumerate rows by `grep '^\| DRIFT-'` or filter by `\| <phase> \|` column, NOT by reading the in-document Summary aggregate. |
| `docs/v1.2-NIP-5D-AUDIT.md` | 170 (in-document `## Summary`) | "Phase 12: **26** rows" contradicts actual column-filter count of **32** rows | Info | Same root cause as above — aggregate drafted mid-pass before final rows landed. Per-row Target Phase values (the field downstream planners filter on) are correct; only the human-readable summary aggregate is stale. |

No Blocker or Warning anti-patterns found. No code-style anti-patterns applicable (phase output is documentation/analysis, not code).

### Human Verification Required

None — all goal-relevant truths are programmatically verifiable and passed. The Plan 10-02 Task 2 human-verify checkpoint was already performed by the user (approval recorded in 10-02-SUMMARY.md "Checkpoint Approval" section with 3 DRIFT-* spot-checks confirmed against real code).

### Gaps Summary

No gaps. Phase 10 goal achieved:

- Canonical NIP-5D spec pinned at `specs/NIP-5D.md` (byte-identical to upstream).
- README.md `## Specification` section wires contributor-facing discovery path.
- Cross-package drift audit at `docs/v1.2-NIP-5D-AUDIT.md` inventories 40 DRIFT rows across 5 stable ID namespaces (ACL 9, RT 10, SHELL 8, SVC 8, CORE 5), covers all 8 nub domains in a 27-row matrix, explicitly documents all 3 canonical-spec deltas (window.nostr MUST NOT, perm: namespace, shell-mediated signing), and partitions work by Target Phase (11/12/13/14) with internally consistent rollup (3+32+3+2 = 40).
- Requirements SPEC-01 and SPEC-02 both satisfied and marked `[x]` in `.planning/REQUIREMENTS.md`.

Downstream Phase 11/12/13/14 planners can enumerate their scope mechanically by filtering the Target Phase column of the audit table. No blockers.

**Minor observation (non-blocking):** The audit's in-document `## Summary` section has two stale aggregates (total row count 33 vs actual 40; Phase 12 count 26 vs actual 32). The per-row table data is authoritative and internally consistent; the stale aggregates are Info-level only. Plan 10-02 SUMMARY explicitly flags this and leaves the audit unchanged on the principle that planners filter the table, not read the prose summary.

---

*Verified: 2026-04-17*
*Verifier: Claude (gsd-verifier)*
