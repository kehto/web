---
phase: 106
slug: active-surface-conformance-and-release
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-27
---

# Phase 106 — Security

> ASVS L1 verification of the plan-authored STRIDE register. All fourteen
> mitigations are present and no blocking threat remains open.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Upstream authority → Kehto evidence | Mutable GitHub PR state and npm/JSR package metadata become immutable local conformance claims only after live reconciliation. | Specification refs, package versions, source/release provenance |
| Active source → historical evidence | Current code and guidance are scanned fail-closed while explicitly classified historical material remains preserved and non-authoritative. | Source paths, protocol vocabulary, generated/current guidance |
| Napplet frame → host runtime | Real Paja/playground frames cross a parent/source/session boundary before receiving shell capabilities, INC traffic, or intent delivery. | Window sources, session identity, protocol envelopes |
| Local branch → GitHub PR/release boundary | Local evidence becomes merge-ready only when the pushed SHA and required checks agree; merge, tag, dispatch, and publish remain separate authorities. | Commit SHA, check conclusions, changesets, release commands |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-106-01 | Tampering | PR authority record | high | mitigate | `verify-napplet-authorities.mjs` re-fetches PR #89–#92 facts and validates the immutable semantic record. | closed |
| T-106-02 | Elevation of Privilege | Legacy route/intent reachability | high | mitigate | `sdk-migration-guard.test.ts` scans non-empty active roots and current guidance, including multiline obsolete shapes. | closed |
| T-106-03 | Tampering | Package provenance | high | mitigate | Authority verification reconciles npm/JSR, installed manifests, lock data, and source/release refs; published-package guards pass. | closed |
| T-106-04 | Tampering | Focused evidence matrix | high | mitigate | The matrix verifier rejects malformed/missing rows and runs 9 allowlisted files / 97 tests for all 47 completed requirements. | closed |
| T-106-05 | Repudiation | Historical/current classification | medium | mitigate | Explicit active/historical inventories, line diagnostics, and the dated intent-design supersession banner preserve the boundary. | closed |
| T-106-06 | Spoofing | Sibling/source shell and delivery paths | high | mitigate | Real-shell Playwright coverage verifies registered parent/source/session identity and target-only delivery. | closed |
| T-106-07 | Elevation of Privilege | Legacy route reachability | high | mitigate | Focused and full E2E exercise exact INC events/channels and carrier-neutral intent delivery without query/prefix fallback. | closed |
| T-106-08 | Tampering | Browser evidence record | high | mitigate | The release checklist records command, source SHA, exit status, named flow evidence, and the sole permitted network skip. | closed |
| T-106-09 | Repudiation | UI release claim | medium | mitigate | Checklist, PR body, verification, and completed UAT preserve the 12/24 audit as non-passing debt with explicit owner and no visual sign-off. | closed |
| T-106-10 | Tampering | Package provenance at final gate | high | mitigate | Authority, build, type, unit, E2E, docs, AI-slop, diff, and changeset gates passed after current-main synchronization. | closed |
| T-106-11 | Tampering | Release from unvalidated SHA | high | mitigate | Local/remote/PR SHA equality and exact-head hosted CI were verified before closeout; final metadata is subject to the same push/check gate. | closed |
| T-106-12 | Tampering | Changeset membership | high | mitigate | `pnpm changeset status` confirms the exact seven minor Kehto packages while unrelated historical changesets remain preserved. | closed |
| T-106-13 | Elevation of Privilege | Merge/tag/publish boundary | high | mitigate | Execution and PR evidence explicitly exclude merge, Version Packages mutation, default-branch writes, tag, dispatch, and publication. | closed |
| T-106-14 | Repudiation | PR evidence | medium | mitigate | PR #204 records authority, package provenance, gates, UI disposition, exact SHA/check URLs, and out-of-scope release actions. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-27 | 14 | 14 | 0 | Codex / GSD ASVS L1 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-27
