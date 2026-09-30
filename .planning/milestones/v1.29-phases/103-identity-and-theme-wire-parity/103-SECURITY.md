---
phase: 103-identity-and-theme-wire-parity
audited: 2026-07-23
status: secured
asvs_level: 1
threats_total: 48
threats_closed: 48
threats_open: 0
authority: 896c32c92deee68dc4d10fc1132b62df20cccb6f
---

# Phase 103 Security Verification

## Verdict

**SECURED.** All high-severity threats are mitigated. The two declared
low-severity risks are explicitly accepted below. No unregistered threat flags
appear in the seven plan summaries.

The audited authority is the draft NAP-IDENTITY, NAP-THEME, and web projection
at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`.

## Remediated Audit Findings

- **T-103-06-02 — alternate delivery bypass:** public identity/theme proxy
  `emit()` compatibility methods now fail closed before delivery. Automatic
  changes can leave the host only through `ShellBridge`, which rechecks the
  live authenticated session, frozen granted domain, current recipient ACL,
  and current iframe window.
- **T-103-07-01 — incomplete active-surface guard:** the guard now rejects raw
  proxy posting, invented identity/theme error paths, unsupported theme
  subscriptions, and stale direct fanout guidance. Paja's generic diagnostic
  uses the sanctioned `resource.info.error` shape.
- **T-103-07-03 — broad-recipient guidance:** active ShellBridge and package
  guidance now describes eligible-session/current-ACL delivery and parent-only
  binding provenance.
- **Review CR-01/CR-02/CR-03:** all nine sanctioned identity reads traverse the
  runtime and readonly binding; the root `window.napplet` descriptor cannot be
  replaced/deleted/recreated; and playground theme state is seeded before
  readiness with forged/readiness/load fanout paths removed.

## Threat Register

| Threats | Disposition | Evidence |
|---|---|---|
| T-103-01-01..05, T-103-01-SC | Mitigated | Exact request allowlist and canonical safe results in runtime; unsupported/result/change spoofing is dropped; no dependency metadata drift. |
| T-103-02-01..04, T-103-02-SC | Mitigated | Explicit service action branches, stable failure normalization, single settlement, complete theme validation, and no dependency drift. |
| T-103-02-05 | Accepted | See Accepted Risks. |
| T-103-03-01..06, T-103-03-SC | Mitigated | Per-recipient live-session/domain/current-ACL/window checks and exact lifecycle/cardinality tests. |
| T-103-04-01..06, T-103-04-SC | Mitigated | Parent-only readonly binding, all sanctioned reads, root/domain replacement attacks blocked, listener teardown, and INC isolation regressions. |
| T-103-05-01..05, T-103-05-SC | Mitigated | Single ThemeService-to-ShellBridge link, state-before-callback, fail-closed attachment, local `onChanged`, and no wire subscription. |
| T-103-05-06 | Accepted | See Accepted Risks. |
| T-103-06-01..06, T-103-06-SC | Mitigated | Seeded playground theme state, one mutation/push path, fail-closed proxies, exact signer transitions, forged-readiness browser proof, and isolated IPv6 validation. |
| T-103-07-01..07, T-103-07-SC | Mitigated | Active-source guard, canonical signer probe, accurate guidance, pinned authority, five changesets, cross-layer tests, and clean phase/package boundaries. |

## Accepted Risks

### T-103-02-05 — no durable audit log for local identity reads

**Severity:** low  
**Disposition:** accepted

Identity reads are correlated, non-mutating, local runtime operations. Durable
logging would retain additional identity data without improving delivery
integrity. Exact request-id, safe-result, settlement, and cardinality tests are
the proportionate control.

### T-103-05-06 — no durable Paja theme-delivery telemetry

**Severity:** low  
**Disposition:** accepted

Paja is a local development host. Its in-memory direction/type message log and
deterministic Playwright state/cardinality proof are sufficient. Persisting
theme activity would add retention and privacy cost without changing the
carrier contract.

## Verification Evidence

- Security re-audit focused matrix: 11 files, 378 tests passed.
- Post-fix focused implementation matrix: 10 files, 250 tests passed.
- Full unit suite: 111 files, 1,420 tests passed.
- Full build, type-check, strict TypeDoc/VitePress docs audit, and
  `git diff --check` passed.
- Isolated IPv6 identity/theme/Paja browser proof: 4 tests passed.

