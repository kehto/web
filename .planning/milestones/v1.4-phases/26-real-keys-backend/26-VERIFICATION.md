---
phase: 26-real-keys-backend
verified: 2026-04-19T00:00:00Z
status: passed
score: 5/5 success criteria verified
requirements:
  - id: KEYS-01
    status: satisfied
    evidence: "packages/services/src/keys-service.ts:510 target.addEventListener('keydown', listener) with target defaulting to document (line 461); subscribe/unsubscribe API via registerAction/unregisterAction routing to bridge.subscribe() returning unsubscribe handle; event.repeat filter at line 476"
  - id: KEYS-02
    status: satisfied
    evidence: "packages/services/src/keys-service.ts:101 exports 'export interface HostKeysBridge'; packages/services/src/index.ts:67 re-exports HostKeysBridge from package barrel; reference browser impl (default document listener path) structurally satisfies the interface"
  - id: KEYS-03
    status: satisfied
    evidence: "apps/demo/napplets/hotkey-chord/ contains 5 source files (index.html, package.json, src/main.ts, tsconfig.json, vite.config.ts); main.ts imports { storage, keys } from '@napplet/sdk' (0 raw window.addEventListener('message')); #hotkey-chord-status transitions connecting... → authenticated → subscribed (main.ts lines 57, 67); #hotkey-chord-count counter at line 76"
  - id: E2E-12
    status: satisfied
    evidence: "tests/e2e/hotkey-chord.spec.ts:73 uses demoBeforeEach(page); spec drives Ctrl+Shift+K via page.keyboard, asserts status transition + counter increment; CI evidence 48 passed / 0 failed / 16.8s"
ci_evidence:
  commit: 15209f5
  docs_commit: 7207a0f
  build: https://github.com/kehto/monorepo/actions/runs/24631096713
  unit: https://github.com/kehto/monorepo/actions/runs/24631096724
  e2e: https://github.com/kehto/monorepo/actions/runs/24631096714
  unit_tests: 456 passing (was 449 → +7 new keys-service tests)
  e2e_tests: 48 passed / 0 failed / 0 skipped / 16.8s (baseline 47 + hotkey-chord spec)
  build_tasks: 21/21 turbo tasks
---

# Phase 26: Real Keys Backend Verification Report

**Phase Goal:** The stub `keys-service` is replaced by a working document-level chord listener exposed via the `keys.*` NUB namespace; a `HostKeysBridge` interface lets host apps swap in OS-level hotkey backends; a `hotkey-chord` demo napplet exercises chord delivery end-to-end and a Layer-B Playwright spec locks the contract.

**Verified:** 2026-04-19
**Status:** passed
**Re-verification:** No — initial verification
**Atomic commit:** 15209f5 (feat) + 7207a0f (docs)

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | keys-service registers document-level keydown listener; subscribe returns unsubscribe; chord fires exactly once per matching keydown with event.repeat filter | VERIFIED | keys-service.ts:510 `target.addEventListener('keydown', listener)` where target defaults to `document` (line 461); event.repeat guard at line 476 `if (ev.repeat) return;`; bridge.subscribe returns unsubscribe handle stored in unsubscribeHandles map (lines 339, 362) |
| 2 | HostKeysBridge interface exported from @kehto/services; reference browser impl satisfies interface structurally | VERIFIED | keys-service.ts:101 `export interface HostKeysBridge` with subscribe(chord, callback): () => void contract; index.ts:67 re-exports HostKeysBridge from package barrel; default non-bridge path (document listener) implements the same subscribe/unsubscribe semantics |
| 3 | hotkey-chord napplet under @napplet/sdk (0 raw postMessage listener); #hotkey-chord-status transitions connecting→authenticated→subscribed | VERIFIED | main.ts imports `{ storage, keys } from '@napplet/sdk'`; `grep window.addEventListener('message')` → 0 matches; setStatus('authenticated') at line 57, setStatus('subscribed') at line 67; countEl updates at line 76 |
| 4 | tests/e2e/hotkey-chord.spec.ts passes against built demo artifact | VERIFIED | Spec file exists; imports `demoBeforeEach` from './helpers/index.js' (line 59); CI evidence runs/24631096714 → 48 passed / 0 failed / 16.8s |
| 5 | Build→run→Playwright loop recorded; 0 window.nostr / signer-service / BusKind in new code; zero anti-term contamination | VERIFIED | 26-ITERATION-LOG.md line 91 "48 passed (16.8s)"; `grep -rE "window.nostr\|signer-service\|BusKind"` across apps/demo/napplets/hotkey-chord + packages/services/src/keys-service.ts → 0 matches; STUB_ONLY_SERVICES = `['media']` only (keys demoted) |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/services/src/keys-service.ts` | Real document keydown listener + HostKeysBridge interface | VERIFIED | 600+ lines; registers keydown listener; exports HostKeysBridge interface; exports createKeysService factory |
| `packages/services/src/index.ts` | Barrel re-exports HostKeysBridge | VERIFIED | Line 67: `HostKeysBridge` exported from `./keys-service.js` alongside KeysServiceOptions and HostKeyEvent |
| `apps/demo/napplets/hotkey-chord/` | 5-file napplet under @napplet/sdk | VERIFIED | index.html, package.json, src/main.ts, tsconfig.json, vite.config.ts (5 files present) |
| `apps/demo/napplets/hotkey-chord/src/main.ts` | Subscribes to Ctrl+Shift+K, DOM sentinel transitions | VERIFIED | Imports { storage, keys } from @napplet/sdk; #hotkey-chord-status and #hotkey-chord-count elements driven |
| `apps/demo/src/shell-host.ts` | Wires hotkey-chord napplet; STUB_ONLY_SERVICES no longer lists keys | VERIFIED | Line 198 registers napplet descriptor; line 111 `STUB_ONLY_SERVICES: readonly string[] = ['media']` (keys demoted) |
| `tests/e2e/hotkey-chord.spec.ts` | Layer-B spec using demoBeforeEach | VERIFIED | Uses demoBeforeEach(page); drives page.keyboard; asserts status + counter |
| `.planning/phases/26-real-keys-backend/26-ITERATION-LOG.md` | Build→run→Playwright loop record | VERIFIED | Contains "48 passed (16.8s)" at lines 91, 95, 140, 191 |
| `.planning/phases/26-real-keys-backend/*-SUMMARY.md` | 4 plan summaries | VERIFIED | 26-01-SUMMARY.md, 26-02-SUMMARY.md, 26-03-SUMMARY.md, 26-04-SUMMARY.md all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| keys-service.ts | document | `target.addEventListener('keydown', listener)` with target = document | WIRED | keys-service.ts:461 default resolution to `document`; line 510 attaches listener |
| keys-service.ts bridge path | HostKeysBridge.subscribe | `bridge.subscribe(chord, cb)` delegation | WIRED | Line 339 branches on hostBridge presence, calls bridge.subscribe, stores unsubscribe at line 362 |
| hotkey-chord/main.ts | @napplet/sdk keys namespace | `keys.registerAction(...)` + `keys.onAction(...)` | WIRED | Imports { storage, keys } from '@napplet/sdk'; registers action and attaches callback |
| hotkey-chord.spec.ts | hotkey-chord napplet iframe | `frameLocator('#hotkey-chord-frame-container iframe')` + `page.keyboard.press('Control+Shift+KeyK')` | WIRED | Spec locates iframe, drives synthetic chord, asserts DOM sentinels |
| shell-host.ts | keys-service | Registers real keys-service (not stub); STUB_ONLY_SERVICES excludes 'keys' | WIRED | Line 111: `STUB_ONLY_SERVICES = ['media']` — keys successfully demoted from stub list |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| keys-service.ts actionRegistry | Map of actionId → ActionEntry | Populated on real `keys.registerAction` envelope from SDK round-trip | Yes — real subscribers drive real entries | FLOWING |
| hotkey-chord/main.ts deliveryCount | Number state rendered in #hotkey-chord-count | Incremented on each keys.action callback (SDK onAction handler) | Yes — counter advances per synthetic chord dispatched by Playwright | FLOWING |
| hotkey-chord/main.ts status text | String state rendered in #hotkey-chord-status | setStatus() called at AUTH and registerAction resolution points | Yes — real SDK Promise resolution drives transitions (CI run green) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| E2E suite runs green against built demo | CI run 24631096714 | 48 passed / 0 failed / 16.8s | PASS (CI evidence) |
| Unit test suite includes new keys-service tests | CI run 24631096724 | 456 passing (449 + 7) | PASS (CI evidence) |
| Build pipeline completes including new napplet | CI run 24631096713 | 21/21 turbo tasks | PASS (CI evidence) |
| Anti-term hygiene holds across new code | `grep -rE "window.nostr\|signer-service\|BusKind" apps/demo/napplets/hotkey-chord packages/services/src/keys-service.ts` | 0 matches | PASS |
| Napplet has 0 raw postMessage listeners | `grep "window.addEventListener('message'" apps/demo/napplets/hotkey-chord/src/main.ts` | 0 matches | PASS |
| Plans declared must-haves | `grep must_haves: plans` | 4/4 plans declare must_haves | PASS |

**Note:** Tests were not re-run locally per orchestrator instruction; CI evidence on commit 15209f5 is authoritative.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| KEYS-01 | 26-01-PLAN.md | keys-service real document listener + subscribe/unsubscribe + autorepeat debounce | SATISFIED | keys-service.ts:510 keydown listener; event.repeat filter line 476; subscribe/unsubscribe contract via registerAction/unregisterAction → bridge |
| KEYS-02 | 26-02-PLAN.md | HostKeysBridge interface exported; reference impl satisfies it | SATISFIED | keys-service.ts:101 interface; index.ts:67 barrel re-export; options.hostBridge branch delegates to bridge |
| KEYS-03 | 26-03-PLAN.md | hotkey-chord demo napplet with status sentinel + counter | SATISFIED | 5 source files; @napplet/sdk imports; #hotkey-chord-status + #hotkey-chord-count DOM sentinels |
| E2E-12 | 26-04-PLAN.md | Layer-B hotkey-chord.spec.ts with demoBeforeEach | SATISFIED | Spec present; demoBeforeEach wired; CI green 48/0/0 |

No orphaned requirements detected. All four IDs are declared across the four plans and all are satisfied.

### Anti-Patterns Found

None. All patterns scanned:
- `window.nostr`, `signer-service`, `BusKind`, `AUTH_KIND`, legacy kind 29001|29002 → 0 matches in new code.
- `window.addEventListener('message'` in napplet source → 0 matches.
- `STUB_ONLY_SERVICES` successfully demoted keys (now only `['media']` remains).

### Human Verification Required

None. All success criteria are programmatically verified. Layer-B Playwright spec provides synthetic chord coverage through CI; no manual UI testing is gated.

### Gaps Summary

None. Phase 26 goal is fully achieved:
- Stub keys-service replaced by real document-level chord listener (KEYS-01)
- HostKeysBridge interface exported from barrel; reference path structurally satisfies it (KEYS-02)
- hotkey-chord demo napplet built under @napplet/sdk with zero raw postMessage listeners (KEYS-03)
- Layer-B spec exercises full E2E chord-delivery contract and passes in CI (E2E-12)
- STUB_ONLY_SERVICES reduced from `['keys', 'media']` to `['media']` — real-backend graduation recorded in demo code
- CI green on atomic commit 15209f5 across Build, Unit (456 passing), and E2E (48/0/0/16.8s) workflows

Note on pattern specificity: The success-criteria text says "registers `document.addEventListener('keydown', ...)`". The implementation uses `target.addEventListener('keydown', listener)` where `target` resolves to `document` by default (keys-service.ts:459-461). This is the correct test-safe pattern (mirrors keys-forwarder.ts, supports SSR/test environments via listenerTarget option). Functionally equivalent and matches plan 26-01 contract. Not a gap.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
