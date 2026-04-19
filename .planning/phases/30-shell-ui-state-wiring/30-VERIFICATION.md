---
phase: 30-shell-ui-state-wiring
verified: 2026-04-19T23:55:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification: []
---

# Phase 30: Shell UI State Wiring — Verification Report

**Phase Goal:** Shell UI state surfaces reflect live NUB envelope traffic for all authenticated napplets.
**Verified:** 2026-04-19T23:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01: `installActivityProjection` routes NUB envelope traffic to `topology-node-service-${domain}` rings via `SERVICE_DOMAIN_ALIAS` + `topology.services.includes()` guard | ✓ VERIFIED | `SERVICE_DOMAIN_ALIAS` at node-details.ts:39–41; routing block at lines 459–467; 2 occurrences of each pattern confirmed |
| 2 | UI-01: `notify` envelope domain aliased to `notifications` service node id | ✓ VERIFIED | `notify: 'notifications'` at node-details.ts:40; alias applied before `topology.services.includes()` check |
| 3 | UI-02: `aclAdapter.snapshot()` gated on `info.authenticated` (not `info.pubkey`) so all 10 napplets appear in ACL Matrix | ✓ VERIFIED | `if (!info.authenticated) continue` at shell-host.ts:1111; old `if (!info.pubkey) continue` absent; `const pk = info.pubkey ?? ''` at line 1112; 14 capability check call sites preserved |
| 4 | UI-03: Hardcoded `LANE_NAMES=['Chat','Shell','Bot']` and `LANE_PCTS` removed; `deriveLanes()` helper drives dynamic lane list from `msg.windowId → NappletInfo.name` | ✓ VERIFIED | No `LANE_NAMES` or `LANE_PCTS` in sequence-diagram.ts; `function deriveLanes` at line 46; 3 `nappletInfos: Map<string, NappletInfo>` parameter sites confirmed |
| 5 | UI-03: `debugger.ts` updated to pass `getNapplets()` as second argument to `renderSequenceDiagram` | ✓ VERIFIED | `import { getNapplets } from './shell-host.js'` at debugger.ts:13; call site at line 435: `renderSequenceDiagram(this.allMessages, getNapplets())` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/demo/src/node-details.ts` | `SERVICE_DOMAIN_ALIAS` + service-level routing in `installActivityProjection` | ✓ VERIFIED | MODULE-SCOPED alias map (lines 39–41), routing block (lines 455–467), no orphan domains via `includes()` guard |
| `apps/demo/src/shell-host.ts` | `aclAdapter.snapshot()` gated on `info.authenticated` | ✓ VERIFIED | Single-line swap at line 1111, `pk` coerced via `?? ''` at 1112, 14 capability checks untouched |
| `apps/demo/src/sequence-diagram.ts` | `deriveLanes` helper + `renderSequenceDiagram(messages, nappletInfos)` signature | ✓ VERIFIED | `deriveLanes` at line 46, `laneX`/`laneIndexOf`/`getLaneEndpoints` helpers all present, 1 public export preserved, docblock rewritten |
| `apps/demo/src/debugger.ts` | `getNapplets` imported; call site passes it to `renderSequenceDiagram` | ✓ VERIFIED | Import at line 13, updated call at line 435 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `installActivityProjection` tapped envelope | `topology-node-service-${serviceKey}` ring | `envelopeType.split('.')[0]` → `SERVICE_DOMAIN_ALIAS` → `topology.services.includes()` → `pushActivity` | ✓ WIRED | Pattern `topology-node-service-\${` present 2× (signer path + new service-domain path); guard at node-details.ts:463 |
| `aclAdapter.snapshot()` loop | `aclState.check(pk, dTag, hash, capability)` | `info.authenticated` gate, `pk = info.pubkey ?? ''` | ✓ WIRED | Gate swap confirmed; 14 capability calls unchanged |
| `debugger.ts updateSequenceDiagram()` | `renderSequenceDiagram(messages, nappletInfos)` | `getNapplets()` import from `shell-host.js` | ✓ WIRED | Import + call site both confirmed |
| `deriveLanes()` | SVG lane headers + lifelines + arrow X-coordinates | `lanes.indexOf(name)` × `laneX(i, laneCount, vbWidth)` | ✓ WIRED | `effectiveLanes` drives all three SVG rendering loops in `renderSequenceDiagram` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `node-details.ts` service ring | `entry` (NodeActivityEntry) | Live `tap.onMessage` from shell-host MessageTap | Yes — real NUB envelope traffic; Playwright MCP observed identity:4, relay:12, storage:12 activity post-boot | ✓ FLOWING |
| `shell-host.ts` snapshot rows | `napplets` Map iteration | Live `napplets` Map populated by AUTH handlers (shell-host:810–844) | Yes — 10 authenticated napplets at boot; Playwright MCP observed 10 rows, no "No authenticated napplets" | ✓ FLOWING |
| `sequence-diagram.ts` lane list | `lanes` from `deriveLanes()` | `nappletInfos` map passed from `getNapplets()` at call time | Yes — 11 lanes observed at boot (10 napplets + Shell centered); Playwright MCP confirmed exact ordering | ✓ FLOWING |

---

### Behavioral Spot-Checks (Playwright MCP UAT — accepted per verification brief)

Evidence from `30-ITERATION-LOG.md` Iteration 1 (automated via Playwright MCP against `:4174` post-wave-1 build):

| Behavior | Evidence | Status |
|----------|----------|--------|
| Service activity counters increment post-boot | identity:4 recent, relay:12 recent, storage:12 recent, keys:2 recent, media:2 recent (DOM reads via `getElementById`) | ✓ PASS |
| notifications + theme at 0 by design (no boot-time traffic) | Confirmed 0 recent — expected, not a bug | ✓ PASS |
| ifc skipped by `topology.services.includes()` guard | Correctly absent from topology.services | ✓ PASS |
| ACL Matrix: 10 rows, no fallback text | rowCount:10, emptyText:null, all 10 napplets named | ✓ PASS |
| Sequence Diagram: 11 lanes, Shell centered at position 6 | bot, chat, composer, feed, hotkey-chord, Shell, media-controller, preferences, profile-viewer, theme-switcher, toaster — matches CONTEXT.md locked derivation | ✓ PASS |
| 49/0/0 Playwright baseline preserved | `pnpm test:e2e` 49 passed / 0 failed / 0 skipped post-wave-1 | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 30-01-PLAN.md | Service node activity counters increment on NUB envelope traffic | ✓ SATISFIED | `SERVICE_DOMAIN_ALIAS` + routing block in `installActivityProjection`; Playwright MCP confirmed non-zero activity on 6 services |
| UI-02 | 30-02-PLAN.md | ACL Capability Matrix lists every authenticated napplet | ✓ SATISFIED | `info.authenticated` gate in `aclAdapter.snapshot()`; Playwright MCP confirmed 10-row matrix |
| UI-03 | 30-03-PLAN.md | Sequence Diagram renders a lane per authenticated napplet | ✓ SATISFIED | `deriveLanes()` + `renderSequenceDiagram(messages, nappletInfos)` + debugger propagation; Playwright MCP confirmed 11 lanes |

REQUIREMENTS.md status table shows UI-01, UI-02, UI-03 all marked `Complete` under Phase 30 — consistent with implementation evidence.

---

### Anti-Patterns Found

No blocker or warning-level anti-patterns detected.

Post-sweep across all four changed files (`node-details.ts`, `shell-host.ts`, `sequence-diagram.ts`, `debugger.ts`):
- `window.nostr`, `signer-service`, `BusKind`, `29001`, `29002`, `allow-same-origin`: 0 matches
- No `TODO`/`FIXME`/`PLACEHOLDER` introduced
- No `return null`/`return []`/`return {}` stubs in public API paths
- No orphaned code — every new helper (`deriveLanes`, `laneX`, `laneIndexOf`, `getLaneEndpoints`) is called from `renderSequenceDiagram`

---

### Human Verification Required

None. The Playwright MCP UAT captured in `30-ITERATION-LOG.md` provides DOM-level evidence (service counter values, ACL matrix row count, SVG lane header text extraction) that is accepted as equivalent to manual UAT per the verification brief.

---

### Commit Evidence

| Commit | Plan | Description |
|--------|------|-------------|
| `80928b2` | 30-01 | feat(30-01): add service-level activity routing to installActivityProjection() |
| `a03f58e` | 30-02 | fix(30-02): swap aclAdapter.snapshot() gate from info.pubkey to info.authenticated |
| `b894786` | 30-03 | feat(30-03): dynamic lane derivation in sequence-diagram (UI-03) |

All three hashes confirmed present in git history.

---

### Gaps Summary

No gaps. All five observable truths verified, all four artifacts substantive and wired, all three data flows confirmed live. The 49/0/0 Playwright baseline is preserved across all three fixes.

---

_Verified: 2026-04-19T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
