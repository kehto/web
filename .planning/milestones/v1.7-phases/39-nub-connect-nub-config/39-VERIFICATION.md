---
phase: 39-nub-connect-nub-config
verified: 2026-04-24T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 39: NUB-CONNECT Adoption + NUB-CONFIG Reference Service — Verification Report

**Phase Goal:** Shell becomes the HTTP-header authority for napplet CSP (`connect-src`), a consent flow gates origin grants, and the 9th NUB domain (config) is live as a reference service — so napplets can only connect to origins they have been granted and can read shell-owned configuration.
**Verified:** 2026-04-24
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Per-napplet CSP `connect-src` header present on napplet HTML responses in both dev and preview modes | ✓ VERIFIED | `serveNappletCsp()` in `apps/demo/vite.config.ts` — both `configureServer` (line 209) and `configurePreviewServer` (line 221) hooks wired; `CSP_NO_GRANTS = "connect-src 'none'"` (line 89); E2E-23 passes against `:4174` preview |
| 2 | Consent dialog approve flow enables subsequent fetch; dismiss=deny flow returns canonical refusal | ✓ VERIFIED | `apps/demo/src/consent-modal.ts` — `closeModal('approve')` resolves `true`, all other outcomes (`deny`, `dismiss`, `timeout`) resolve `false`; M-04 anti-feature confirmed: `grep resolve(true) consent-modal.ts` = 0 matches; E2E-21 passes (2 tests) |
| 3 | Revoking a connect grant triggers iframe destroy+recreate; newly-mounted iframe receives updated CSP header excluding the revoked origin | ✓ VERIFIED | `apps/demo/src/main.ts` — `__revokeConnect__` dispatches `shell:connect-revoked` CustomEvent; listener snapshots napplets Map before iteration (Dev 2 fix, commit c764e7d) and calls `loadNapplet()`; E2E-22 passes (asserts old iframe replaced by new iframe with different id) |
| 4 | `pnpm audit:csp` runs post-build, scans built napplet `dist/index.html` files, exits non-zero if any `<meta http-equiv="Content-Security-Policy">` tag found | ✓ VERIFIED | `scripts/audit-csp.mjs` exists with canonical error message; `package.json` script `"audit:csp": "node scripts/audit-csp.mjs"` wired; `.github/workflows/build.yml` step "Audit CSP (residual meta-CSP scan)" at line 37 (after build, before type-check); ITERATION-LOG records `[audit:csp] OK — scanned 11 napplet dist/index.html file(s), no meta-CSP found` |
| 5 | config-demo napplet exercises `config.get` + `config.subscribe` round-trip; values propagate correctly | ✓ VERIFIED | `apps/demo/napplets/config-demo/src/main.ts` — calls `config.subscribe()` and `config.get()`; `#config-demo-values` sentinel updated on every push; `createConfigService` registered in `shell-host.ts` via `nubDispatch.registerNub('config', configAdapter)` (Dev 1 fix, commit fb81401); E2E-24 passes |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shell/src/connect-store.ts` | connectStore singleton + connectKey helper | ✓ VERIFIED | Exists, 235 lines; `export const connectStore`, `export function connectGrantKey`; grant/revoke/check/getOrigins/getAllGrants/persist/load/clear all present; localStorage key `napplet:connect` |
| `packages/shell/src/shell-bridge.ts` | ShellBridge.connectStore readonly surface | ✓ VERIFIED | Import at line 29; interface declaration at line 158 (`readonly connectStore: ConnectStore`); getter at lines 292–294 |
| `packages/shell/src/index.ts` | connectStore + type re-exports | ✓ VERIFIED | Line 109: `export { connectStore, connectGrantKey } from './connect-store.js'` |
| `packages/acl/src/capabilities.ts` | `config:read` in ALL_CAPABILITIES | ✓ VERIFIED | Line 36 in array; line 66: `export const CAP_CONFIG_READ = 'config:read' as const` |
| `packages/acl/src/resolve.ts` | `case 'config'` dispatch | ✓ VERIFIED | Line 270: `case 'config': return configMap(action)` |
| `scripts/audit-csp.mjs` | Node script scanning built napplet HTML | ✓ VERIFIED | Exists; `META_CSP_REGEX` case-insensitive scan; canonical error message; exit 0 on clean |
| `package.json` | `pnpm audit:csp` script | ✓ VERIFIED | Line 6: `"audit:csp": "node scripts/audit-csp.mjs"` |
| `packages/services/src/config-service.ts` | createConfigService factory | ✓ VERIFIED | Exists, 380 lines; full 5-message wire protocol; `publishValues` fan-out; scope boundary documented; no `config.set` handling (comment at line 13 is the anti-feature note only) |
| `packages/services/src/index.ts` | createConfigService re-exports | ✓ VERIFIED | Line 101: `export { createConfigService }`; lines 103–105: type exports |
| `apps/demo/vite.config.ts` | `serveNappletCsp()` Vite plugin | ✓ VERIFIED | Full plugin with `configureServer` + `configurePreviewServer`; `POST /__connect-grants` endpoint; `GRANT_SYNC_ORIGIN_ALLOWLIST`; `CSP_NO_GRANTS = "connect-src 'none'"`; registered BEFORE `serveDemoNapplets()` |
| `.github/workflows/build.yml` | Audit CSP Build step | ✓ VERIFIED | Step at line 37 "Audit CSP (residual meta-CSP scan)"; ordering: Build (34) → Audit CSP (37) → Type-check (44) |
| `apps/demo/napplets/config-demo/` | 11th napplet scaffold | ✓ VERIFIED | Directory exists with all 6 files; `config-schema.json` has `notifications-enabled` (4 properties); `index.html` has `#config-demo-values` sentinel and NO `http-equiv` meta tag; `src/main.ts` has ≥3 `config.subscribe` references |
| `apps/demo/src/shell-host.ts` | 11 DEMO_NAPPLETS entries, config-demo CLASS_BY_DTAG, createConfigService instantiation, setDemoConfigValue export | ✓ VERIFIED | 11th entry (config-demo) confirmed; CLASS_BY_DTAG has matching entry; `createConfigService` imported + called (3 occurrences); `setDemoConfigValue` exported |
| `apps/demo/src/consent-modal.ts` | createConsentModal factory with DOM modal | ✓ VERIFIED | Full modal with 60s timeout, overlay z-index 10000, origin list + cleartext warning, `data-testid` attributes; `resolve(true)` = 0 matches (M-04 clean) |
| `apps/demo/src/main.ts` | consent modal + test hooks + iframe destroy+recreate | ✓ VERIFIED | `createConsentModal().registerWith(relay, ...)` at line 90; `__grantConnectOrigin__` at line 953; `__revokeConnect__` at line 964; `shell:connect-revoked` dispatch at line 969, listener at line 977; `__publishConfigValues__` at line 1018 |
| `docs/policies/SHELL-CONNECT-POLICY.md` | Policy with source provenance + kehto cross-refs + Production Deployment Gap | ✓ VERIFIED | Source SHA 641e865, copy date 2026-04-24; kehto file:line cross-references embedded; "Production Deployment Gap (C-05)" section at line 265; `packages/shell/src/connect-store.ts` referenced twice |
| `tests/e2e/connect-consent.spec.ts` | E2E-21 (2 tests) | ✓ VERIFIED | 2 tests: approve flow + dismiss=deny; `__grantConnectOrigin__` call present; serial mode + beforeEach Vite reset |
| `tests/e2e/connect-revocation.spec.ts` | E2E-22 (1 test) | ✓ VERIFIED | 1 test; `__revokeConnect__` + `waitForFunction` asserting iframe replacement |
| `tests/e2e/connect-csp-preview.spec.ts` | E2E-23 (1 test) | ✓ VERIFIED | 1 test; `baseURL` asserted to contain `4174`; `content-security-policy` header asserted |
| `tests/e2e/nub-config.spec.ts` | E2E-24 (1 test) | ✓ VERIFIED | 1 test; `__publishConfigValues__` hook used (not `#config-demo-update-btn`); `frameLocator` + `#config-demo-values` sentinel assertion |
| `.planning/phases/39-nub-connect-nub-config/39-ITERATION-LOG.md` | 67/0/0 recorded | ✓ VERIFIED | "67 passed (24.9s)" at line 152; "PHASE 39 CLOSE CONFIRMED" at line 245; 3 deviations recorded (Dev 1 runtime dispatch fix, Dev 2 infinite loop fix, Dev 3 spec corrections) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shell/src/connect-store.ts` | localStorage `napplet:connect` | `STORAGE_KEY` + `persist()`/`load()` | ✓ WIRED | Line 17: `const STORAGE_KEY = 'napplet:connect'`; persist() at line 179; load() at line 191 |
| `packages/shell/src/shell-bridge.ts` | `connectStore` singleton | `get connectStore() { return connectStore; }` | ✓ WIRED | Lines 29 (import), 158 (interface), 292–294 (getter) |
| `packages/acl/src/resolve.ts` | `config:read` capability | `case 'config': return configMap(action)` | ✓ WIRED | Line 270; `configMap` function verified to return `{ senderCap: 'config:read', ... }` for napplet-originated messages |
| `apps/demo/vite.config.ts` `POST /__connect-grants` | plugin internal grants Map | `handleGrantSync` → `grants.set()/delete()` | ✓ WIRED | Lines 101–153; origin allowlist at line 108; 204 response on success |
| `apps/demo/vite.config.ts` `configurePreviewServer` | same grants Map + CSP middleware | `server.middlewares.use('/napplets', cspMiddleware)` | ✓ WIRED | Lines 221–232; structural mirror of configureServer; 2 `configurePreviewServer` occurrences confirmed |
| `apps/demo/src/main.ts` `__grantConnectOrigin__` | `connectStore.grant` + `POST /__connect-grants` | `connectStore.grant(dTag, hash, next)` + `syncGrantsToVite(...)` | ✓ WIRED | Lines 953–961; `syncGrantsToVite` defined at lines 940–950 |
| `apps/demo/src/main.ts` `__revokeConnect__` | `connectStore.revoke` + `shell:connect-revoked` + iframe destroy+recreate | `connectStore.revoke` + `dispatchEvent(CustomEvent)` + listener calls `loadNapplet` | ✓ WIRED | Lines 964–991; Dev 2 fix (snapshot before iteration) confirmed at line ~982 |
| `apps/demo/src/shell-host.ts` `createConfigService` | `configBundle.publishValues` → subscribed napplets | `_configServiceBundle?.publishValues(...)` in `setDemoConfigValue` | ✓ WIRED | `setDemoConfigValue` mutates `demoConfigFixtures` then calls `publishValues`; `__publishConfigValues__` test hook at line 1018 calls this path |
| `packages/runtime/src/runtime.ts` | config NUB dispatch | `nubDispatch.registerNub('config', configAdapter)` at line 1129 | ✓ WIRED | Dev 1 fix — without this the service was registered but messages were silently dropped |
| `.github/workflows/build.yml` | `scripts/audit-csp.mjs` | `run: pnpm audit:csp` at line 42 | ✓ WIRED | Step ordering confirmed: Build (34) → Audit CSP (37) → Type-check (44) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/demo/napplets/config-demo/src/main.ts` | `values` (from `config.subscribe` callback) | `createConfigService.publishValues` → `ServiceHandler.handleMessage` → `send(push)` | Yes — `demoConfigFixtures` object in `shell-host.ts`; `setDemoConfigValue` mutates + fans out via `_configServiceBundle?.publishValues(...)` | ✓ FLOWING |
| `apps/demo/vite.config.ts` CSP middleware | `origins` (from `grants` Map) | `POST /__connect-grants` body → `grants.set(key, origins.sort())` | Yes — populated by `syncGrantsToVite` in `main.ts` on grant/revoke | ✓ FLOWING |
| `tests/e2e/nub-config.spec.ts` | `#config-demo-values` content | `__publishConfigValues__` test hook → `setDemoConfigValue` → `publishValues` → napplet subscription | Yes — E2E-24 passed (67 total, 5 new) | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 11 napplet directories exist | `ls apps/demo/napplets/ \| wc -l` | 11 | ✓ PASS |
| audit:csp script present and wired | `grep '"audit:csp"' package.json` | match at line 6 | ✓ PASS |
| No meta-CSP in any napplet dist | `grep -rni 'http-equiv.*CSP' apps/demo/napplets/*/dist/index.html` | 0 matches | ✓ PASS |
| No config.set handler (anti-feature) | `grep "config.set" packages/services/src/config-service.ts` | 1 match in comment only (anti-feature note) | ✓ PASS |
| M-04 clean: no dismiss-allow | `grep "resolve(true)" apps/demo/src/consent-modal.ts` | 0 matches | ✓ PASS |
| configurePreviewServer wired (C-05) | `grep -c "configurePreviewServer" apps/demo/vite.config.ts` | 2 | ✓ PASS |
| 67/0/0 E2E recorded in ITERATION-LOG | `grep "67 passed" 39-ITERATION-LOG.md` | present at lines 5, 152, 181, 245 | ✓ PASS |

Step 7b: Full E2E run skipped (requires running preview server) — results recorded in 39-ITERATION-LOG.md from canonical iteration loop confirming 67 passed / 0 failed / 0 skipped.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONNECT-01 | 39-01 | connect-store singleton + ShellBridge.connectStore | ✓ SATISFIED | `connect-store.ts` exists; `shell-bridge.ts` getter wired; `index.ts` re-exports |
| CONNECT-02 | 39-03 | Vite serveNappletCsp plugin (dev + preview) | ✓ SATISFIED | `vite.config.ts` both hooks wired; `POST /__connect-grants` endpoint |
| CONNECT-03 | 39-04 | Consent modal DOM + registerConsentHandler | ✓ SATISFIED | `consent-modal.ts` full implementation; registered in `main.ts` |
| CONNECT-04 | 39-04 | Iframe destroy+recreate on revocation | ✓ SATISFIED | `shell:connect-revoked` listener in `main.ts`; Dev 2 fix (loop prevention) |
| CONNECT-05 | 39-01, 39-03 | `pnpm audit:csp` + GitHub Actions step | ✓ SATISFIED | `scripts/audit-csp.mjs`; `package.json` script; `build.yml` step |
| CONNECT-06 | 39-01 | Hash-upgrade invalidates prior grants (composite key) | ✓ SATISFIED | `connectKey(dTag, aggregateHash)` makes this structural; JSDoc documents it |
| CONNECT-07 | 39-05 | `docs/policies/SHELL-CONNECT-POLICY.md` | ✓ SATISFIED | File exists; source SHA 641e865; kehto cross-refs; Production Deployment Gap section |
| CONFIG-01 | 39-02 | createConfigService factory with full wire protocol | ✓ SATISFIED | `config-service.ts` 380 lines; 5 message types handled; `publishValues` fan-out |
| CONFIG-02 | 39-01 | `config:read` capability + resolve.ts dispatch case | ✓ SATISFIED | `capabilities.ts` line 36; `resolve.ts` line 270 `case 'config'` |
| CONFIG-03 | 39-04 | config-demo napplet + runtime service registration | ✓ SATISFIED | 11th napplet built; `nubDispatch.registerNub('config', ...)` wired (Dev 1 fix) |
| CONFIG-04 | 39-02 | Scope boundary documented (no config.set anti-feature) | ✓ SATISFIED | Top-of-file JSDoc in `config-service.ts`; `NUB-STORAGE` anti-overlap explicit |
| E2E-21 | 39-05 | connect-consent.spec.ts (2 tests) | ✓ SATISFIED | File exists; 2 tests; serial mode; Vite state reset in beforeEach |
| E2E-22 | 39-05 | connect-revocation.spec.ts (1 test) | ✓ SATISFIED | File exists; 1 test; iframe replacement assertion |
| E2E-23 | 39-05 | connect-csp-preview.spec.ts (1 test) | ✓ SATISFIED | File exists; 1 test; baseURL :4174 assertion |
| E2E-24 | 39-05 | nub-config.spec.ts (1 test) | ✓ SATISFIED | File exists; 1 test; `__publishConfigValues__` hook used |

**15/15 REQ-IDs satisfied.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | All anti-features clean per grep sweeps |

Specific anti-feature sweeps confirmed clean:
- `grep -rni 'http-equiv.*Content-Security-Policy' apps/demo/napplets/*/dist/index.html` → 0 matches (C-03)
- `grep "config.set" packages/services/src/config-service.ts` → 1 match in JSDoc comment only, not wire handling
- `grep "resolve(true)" apps/demo/src/consent-modal.ts` → 0 matches (M-04)
- `grep -c "configurePreviewServer" apps/demo/vite.config.ts` → 2 (C-05 coverage)

---

### Human Verification Required

#### 1. Consent Modal Visual Appearance

**Test:** Boot `pnpm --filter @kehto/demo dev`, trigger a `connect`-type consent request via the shell, observe the modal DOM renders at fixed center overlay with z-index 10000.
**Expected:** Full-screen dark overlay; dialog box with origin list; Allow/Deny buttons; auto-deny timer displayed; cleartext warning row for `http://` origins.
**Why human:** DOM overlay visual correctness, z-index stacking relative to iframes, and timer countdown cannot be asserted programmatically without a running server.

#### 2. `#config-demo-update-btn` Live Toggle

**Test:** In the running demo, click the "toggle config (demo)" button in the shell UI.
**Expected:** `#config-demo-values` in the config-demo iframe updates from `"dark"` to `"light"` (or vice versa) within ~500ms.
**Why human:** E2E-24 uses `__publishConfigValues__` test hook instead; the button's `display:none` state and the live DOM toggle path are not covered by automated specs.

---

### Notable Deviations Recorded in ITERATION-LOG

Three bugs were found and fixed during the Plan 39-05 iteration loop:

1. **Dev 1 (fb81401):** `createConfigService` was registered in `serviceRegistry` but `nubDispatch.registerNub('config', ...)` was never called — all `config.*` messages were silently dropped. Fix: added `handleConfigMessage()` + `nubDispatch.registerNub('config', configAdapter)` in `packages/runtime/src/runtime.ts:1129`.

2. **Dev 2 (c764e7d):** Infinite loop in `shell:connect-revoked` listener — iterating a live Map while `loadNapplet()` appended new entries. Fix: snapshot entries before mutation in `apps/demo/src/main.ts`.

3. **Dev 3 (80ccc90):** Three E2E spec corrections — `shell-ui-state-surfaces.spec.ts` expected 10 napplets (now 11); `nub-config.spec.ts` clicked a hidden button (now uses `__publishConfigValues__` hook); `connect-consent.spec.ts` had Vite in-memory grant bleed between serial tests (fixed by adding Vite reset in `beforeEach`).

All three deviations were resolved before the canonical iteration loop recorded 67/0/0.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
