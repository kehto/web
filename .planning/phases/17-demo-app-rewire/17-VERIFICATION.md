---
phase: 17-demo-app-rewire
verified: 2026-04-17T00:00:00Z
status: passed
score: 9/9 must-haves verified
---

# Phase 17: Demo App Rewire — Verification Report

**Phase Goal:** The demo application boots cleanly against the canonical v1.2 `@kehto/*` APIs — zero legacy references, all 8 service nodes visible in topology, signer/NIP-46/ACL/debugger surfaces wired and functional.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `grep -rE "window\.nostr\|signer-service\|BusKind\|AUTH_KIND\|kind === 2900[12]" apps/demo/src/` returns no functional matches (comments only) | VERIFIED | Grep returns 7 comment-only hits: 2 in `demo-config.ts`, 1 in `signer-demo.ts`, 2 in `signer-modal.ts`, 2 in `signer-connection.ts`, 1 in `notification-demo.ts` — all in JSDoc/comment blocks, zero live code |
| 2 | `createDemoHooks()` registers `keys`, `media`, `theme` services via `@kehto/services` factories | VERIFIED | `shell-host.ts` lines 21-26 import `createKeysService`, `createMediaService`, `createThemeService`; lines 363-389 instantiate all three inside `createDemoHooks()` |
| 3 | `topology.ts` references `STUB_ONLY_SERVICES`/`DEMO_TOPOLOGY_SERVICE_NAMES`; renders 8 service nodes; stub-only marker on `keys`+`media` | VERIFIED | `topology.ts` line 6 imports `STUB_ONLY_SERVICES` from `shell-host.ts`; `shell-host.ts` exports `DEMO_TOPOLOGY_SERVICE_NAMES` (8 entries: identity, keys, media, notifications, relay, signer, storage, theme); `topology.ts` line 478 checks `STUB_ONLY_SERVICES.includes(service)` and renders `stub-badge`; `data-service-stub="true"` set on keys+media nodes |
| 4 | `signer-modal.ts` + `signer-demo.ts` route through `getIdentityServiceHandler()` / `runIdentityProbe()` — no `window.nostr` paths | VERIFIED | `signer-modal.ts` line 21 imports `getIdentityServiceHandler`; lines 156+198 call `runIdentityProbe()`; line 214 defines `runIdentityProbe()` using `getIdentityServiceHandler()`; no `window.nostr` call sites in functional code |
| 5 | `debugger.ts` displays NIP-5D envelope `type` strings; animators route by envelope domain | VERIFIED | `debugger.ts` line 67: `if (msg.envelopeType)` with `msg.envelopeType.split('.', 2)`; line 379: returns `msg.envelopeType` directly; `flow-animator.ts` line 50-58: routes by `msg.parsed.domain`; `sequence-diagram.ts` lines 36+121 use `msg.envelopeType` |
| 6 | `acl-panel.ts`, `acl-modal.ts`, `acl-history.ts` mutate via `getAclAdapter()` — no direct `aclState.*` calls | VERIFIED | All three files import `getAclAdapter` from `shell-host.ts`; grep for `aclState.` in these three files returns zero matches |
| 7 | `node-inspector.ts` has per-role rendering (acl/runtime/napplet/service/shell) | VERIFIED | Lines 138-147: `renderForRole()` switch dispatches `case 'acl'`, `case 'runtime'`, `case 'napplet'`, `case 'service'`, `case 'shell'` to dedicated renderers |
| 8 | 5 E2E-06 specs exist: `demo-boot`, `demo-node-inspector`, `demo-debugger`, `demo-service-toggle`, `demo-notification-service` | VERIFIED | All 5 files present in `tests/e2e/`; all import `demoBeforeEach` from `./helpers/index.js`; all use `test.use({ baseURL: 'http://localhost:4174' })` |
| 9 | Iteration log at `.planning/phases/17-demo-app-rewire/17-ITERATION-LOG.md` documents at least one build→Playwright→fix cycle and a final pass | VERIFIED | Log contains 3 iterations; Iteration 1 captured 2 FAIL/PASS results + root-cause diagnosis; Iteration 2 applied fixes; Iteration 3 recorded 17/17 tests PASS with anti-term grep clean; Phase close gate satisfied |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/demo/src/shell-host.ts` | `createDemoHooks()` registers keys/media/theme; exports `STUB_ONLY_SERVICES`, `DEMO_TOPOLOGY_SERVICE_NAMES`, `getAclAdapter()`, `getIdentityServiceHandler()` | VERIFIED | All exports confirmed present; factory calls at lines 363-389 |
| `apps/demo/src/topology.ts` | Imports `STUB_ONLY_SERVICES`; renders 8 service nodes with stub-only badge on keys+media | VERIFIED | Import at line 6; `data-service-stub` attribute and `.stub-badge` rendered conditionally at lines 478-482 |
| `apps/demo/src/signer-modal.ts` | Routes through `getIdentityServiceHandler()` / `runIdentityProbe()` | VERIFIED | Lines 21, 156, 198, 214 |
| `apps/demo/src/signer-demo.ts` | No `kind 29001`/`kind 29002` in live code; uses `finalizeEvent` | VERIFIED | JSDoc comment references removed terms as "removed in v1.2"; live code only calls `generateSecretKey`, `finalizeEvent` |
| `apps/demo/src/debugger.ts` | Dispatches on `msg.envelopeType`; displays NIP-5D type strings | VERIFIED | Lines 67-89: envelope-first dispatch; returns `msg.envelopeType` at line 379 |
| `apps/demo/src/node-inspector.ts` | Per-role dispatch for acl/runtime/napplet/service/shell | VERIFIED | `renderForRole()` switch at lines 138-147 |
| `apps/demo/src/acl-panel.ts` | Uses `getAclAdapter()`, no direct `aclState.*` | VERIFIED | Import at line 8; uses adapter at lines 89, 121 |
| `apps/demo/src/acl-modal.ts` | Uses `getAclAdapter()` for grant/revoke | VERIFIED | Import at line 10; uses adapter at line 46 |
| `apps/demo/src/acl-history.ts` | Subscribes via `getAclAdapter().onCheck()` | VERIFIED | Import at line 9; `getAclAdapter().onCheck(listener)` at line 129 |
| `apps/demo/src/flow-animator.ts` | Routes by envelope domain, no BusKind | VERIFIED | Lines 49-58: domain-based routing; no BusKind present |
| `apps/demo/src/sequence-diagram.ts` | Uses `msg.envelopeType`, no BusKind | VERIFIED | Lines 36, 121: envelope type used; no BusKind present |
| `apps/demo/src/trace-animator.ts` | No BusKind | VERIFIED | No BusKind matches; 156-line file uses envelope type |
| `tests/e2e/demo-boot.spec.ts` | Tests 8 nodes, stub-badge count, no anti-term | VERIFIED | Asserts `toHaveCount(8)`, `toHaveCount(2)` for stub-badge, anti-term regex |
| `tests/e2e/demo-node-inspector.spec.ts` | Per-role inspector content assertions | VERIFIED | 6 tests covering ACL, runtime, napplet, service, open/close, anti-term |
| `tests/e2e/demo-debugger.spec.ts` | Canonical envelope type in debugger output | VERIFIED | 2 tests using `ENVELOPE_TYPE_RE` |
| `tests/e2e/demo-service-toggle.spec.ts` | Toggle flips `.service-disabled` class | VERIFIED | 2 tests |
| `tests/e2e/demo-notification-service.spec.ts` | notify.create/list/read/dismiss host-side flows | VERIFIED | 6 tests |
| `.planning/phases/17-demo-app-rewire/17-ITERATION-LOG.md` | At least one build→Playwright→fix cycle + final pass | VERIFIED | 3 iterations documented; 17/17 final pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `acl-panel.ts` | `shell-host.ts` | `getAclAdapter()` import | WIRED | Import at line 8; called at lines 89, 121 |
| `acl-modal.ts` | `shell-host.ts` | `getAclAdapter()` import | WIRED | Import at line 10; called at line 46 |
| `acl-history.ts` | `shell-host.ts` | `getAclAdapter().onCheck()` | WIRED | Import at line 9; subscription at line 129 |
| `signer-modal.ts` | `shell-host.ts` | `getIdentityServiceHandler()` | WIRED | Import at line 21; called inside `runIdentityProbe()` |
| `topology.ts` | `shell-host.ts` | `STUB_ONLY_SERVICES` import | WIRED | Import at line 6; used at line 478 |
| `debugger.ts` | `shell-host.ts` | `TappedMessage`, `DemoProtocolPath` types | WIRED | `import type { TappedMessage, MessageTap, DemoProtocolPath }` at line 12 |
| E2E specs (all 5) | `tests/e2e/helpers/index.js` | `demoBeforeEach` import | WIRED | All 5 specs confirmed importing and calling `demoBeforeEach` |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| DEMO-01 | Demo boots clean — no legacy anti-terms, 8 service nodes visible | SATISFIED | Anti-term grep returns comments only; 8 nodes in `DEMO_TOPOLOGY_SERVICE_NAMES` |
| DEMO-02 | Signer UX uses canonical identity.*/relay.publish paths | SATISFIED | `signer-modal.ts` routes through `getIdentityServiceHandler()`; no `window.nostr` call sites |
| DEMO-03 | ACL panel/modal/history functional via ShellAdapter.acl hooks | SATISFIED | All three files use `getAclAdapter()`; zero direct `aclState.*` calls |
| DEMO-04 | Debugger displays NIP-5D envelope type strings | SATISFIED | `debugger.ts` dispatches on `msg.envelopeType` and displays literal `type` field |
| DEMO-05 | `createDemoHooks()` registers keys/media/theme from @kehto/services | SATISFIED | `createKeysService()`, `createMediaService()`, `createThemeService()` instantiated in `createDemoHooks()` |
| DEMO-06 | Node inspector shows per-role content on topology-node click | SATISFIED | `renderForRole()` dispatches all 5 roles; E2E confirms ACL/runtime/napplet/service paths |
| DEMO-07 | Notification demo + kinds + constants panels render v1.2 data | SATISFIED | Anti-term checks clean; `notification-demo.ts` uses `notify.*` envelopes |
| DEMO-08 | Edge animators render live traffic without stale NIP-01/BusKind refs | SATISFIED | All three animators (flow, sequence, trace) confirmed BusKind-free; domain-based routing |
| E2E-06 | 5 demo-surface specs green | SATISFIED | All 5 specs exist with correct helpers, baseURL, assertions; iteration log confirms 17/17 PASS |
| E2E-11 | Phase closes with recorded build→run→Playwright→fix loop | SATISFIED | Iteration log has 3 iterations; Phase close gate entry at 2026-04-18T02:25Z |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

Anti-term grep (`window.nostr`, `signer-service`, `BusKind`, `AUTH_KIND`, `kind === 29001/29002`) returns only comment-block references in 5 files. All are explanatory "removed in v1.2" or "NOT window.nostr" comments — explicitly permitted by D-01. No live code anti-terms present.

The `return null` and `return []` patterns found in anti-pattern scan are all legitimate guard-clause returns in utility functions (color-state.ts, nip46-client.ts, shell-host.ts persistence adapters) — not rendering stubs.

---

### Human Verification Required

**1. Demo Boot Visual**
**Test:** Run `pnpm --filter @kehto/demo preview` and navigate to `http://localhost:4174` in a browser.
**Expected:** Topology graph renders with 8 service nodes visible; `keys` and `media` show "stub-only" badge; shell pubkey appears in shell node.
**Why human:** Visual layout and CSS rendering cannot be verified programmatically.

**2. NIP-46 / NIP-07 Signer Connect Flow**
**Test:** Click "Connect Signer" on the signer topology node; try NIP-07 connection (requires browser extension) and NIP-46 QR code rendering.
**Expected:** Modal opens; NIP-07 button triggers extension prompt or shows "not available" gracefully; QR code renders for NIP-46 bunker URI.
**Why human:** Requires a live browser with NIP-07 extension; WebRTC/QR rendering is visual.

---

### Gaps Summary

No gaps found. All 9 must-have truths verified against actual codebase:

- Legacy anti-terms purged to comments only across all 21 demo source files
- `createDemoHooks()` instantiates all 3 new `@kehto/services` factories (keys, media, theme) in addition to existing identity/notify
- Topology correctly exports `DEMO_TOPOLOGY_SERVICE_NAMES` (8 names) and `STUB_ONLY_SERVICES` (`keys`, `media`); renders `data-service-stub` and `.stub-badge` conditionally
- Signer UX chain: `signer-modal.ts` → `getIdentityServiceHandler()` → `runIdentityProbe()` — no `window.nostr` call sites in functional code
- Debugger dispatches on `msg.envelopeType`, returns literal type strings; all 3 animators route by envelope domain prefix
- ACL panels (panel/modal/history) exclusively use `getAclAdapter()` adapter seam — zero direct `aclState.*` calls
- Node inspector `renderForRole()` dispatch covers all 5 topology roles
- All 5 E2E-06 specs present, wired to `demoBeforeEach` helper, targeting `:4174`
- Iteration log documents 3 build→Playwright→fix cycles; 17/17 final test pass recorded

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
