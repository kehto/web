---
phase: 40-nub-resource-demo-policy
verified: 2026-04-24T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 40: NUB-RESOURCE Reference Service + Demo Napplets + Policy Docs Verification Report

**Phase Goal:** Shell acts as an authenticated fetch proxy for the 10th NUB domain; config-demo and resource-demo napplets are live in the demo (DEMO_NAPPLETS 10 → 12); all three policy docs are complete.
**Verified:** 2026-04-24
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `createResourceService` factory throws on construction if `getConnectGrants` missing (H-03 prevention) | VERIFIED | Factory throws with `/H-03/` message when any of 4 options is absent — confirmed via `node` behavioral spot-check against built dist; 2 guard test cases (a, b) pass in unit suite |
| 2 | resource-demo successful fetch from granted origin + `denied` response for ungranted origin | VERIFIED | `apps/demo/napplets/resource-demo/src/main.ts` dispatches two `resource.bytes` requests; `#resource-demo-granted` populated from decoded JSON; `#resource-demo-denied` populated with `code=denied`; E2E-25 spec passes 2/2 |
| 3 | `resource.cancel` correlates to `resource.bytes` request; emits `canceled` error | VERIFIED | `resource-service.ts` maintains `inFlight: Map<requestId, { controller, windowId }>` and `perWindow` secondary map; `resource.cancel` aborts the stored controller; test (f) and (i) cover both cancel-correlation and `onWindowDestroyed` paths |
| 4 | `DEMO_NAPPLETS` = 12 entries; `CLASS_BY_DTAG` complete; `CANONICAL_NUB_DOMAINS` extended | VERIFIED | `DEMO_NAPPLETS.length === 12` confirmed by node count; `CLASS_BY_DTAG` has `['resource-demo', null]` as 12th entry; `CANONICAL_NUB_DOMAINS` = `[...8 v1.2 domains, 'config', 'resource']` (9 without relay, 10 with) |
| 5 | `docs/policies/` directory with all three policy files, each with canonical source header | VERIFIED | `ls docs/policies/*.md | wc -l` = 3; all 3 files open with HTML `<!--` comment block containing `Source:` + GitHub URL + commit SHA; README Policies section references all 3 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/services/src/resource-service.ts` | createResourceService factory + ResourceServiceOptions | VERIFIED | 368 lines (plan: 180+ min); exports `createResourceService`, `ResourceServiceOptions`; H-03 guard at lines 172–186; in-flight Map + AbortController logic present |
| `packages/services/src/resource-service.test.ts` | 9 unit tests (a–i) | VERIFIED | 280 lines; covers H-03 guard (a, b), full options success (c), denied/granted flows (d, e), cancel correlation (f), invalid-url (g), network-error (h), onWindowDestroyed (i) |
| `packages/acl/src/capabilities.ts` | `'resource:fetch'` in ALL_CAPABILITIES + `CAP_RESOURCE_FETCH` constant | VERIFIED | Line 38: `'resource:fetch'` in ALL_CAPABILITIES; line 70: `export const CAP_RESOURCE_FETCH = 'resource:fetch' as const`; ALL_CAPABILITIES length now 16 |
| `packages/acl/src/resolve.ts` | `resourceMap()` + `case 'resource'` | VERIFIED | `resourceMap()` at line ~185 with asymmetric senderCap/recipientCap logic; `case 'resource':` at line 298 |
| `packages/runtime/src/runtime.ts` | `handleResourceMessage` + `nubDispatch.registerNub('resource', ...)` | VERIFIED | `handleResourceMessage` at line 1081; `registerNub('resource', resourceAdapter)` at line 1147 — Phase 39 Dev 1 lesson held |
| `packages/shell/src/shell-init.ts` | `CANONICAL_NUB_DOMAINS` extended with `'config'` and `'resource'` | VERIFIED | Lines 24–26: array includes `'config', 'resource'`; JSDoc updated to 10-domain |
| `packages/shell/src/index.ts` | Re-exports of all provisional-resource wire types | VERIFIED | Lines 125–134: all 8 types exported (`ResourceBytesRequest`, `ResourceCancelRequest`, `ResourceBytesResult`, `ResourceBytesError`, `ResourceErrorCode`, `ResourceRequestId`, `ResourceInbound`, `ResourceOutbound`); confirmed in `dist/index.d.ts` |
| `.changeset/phase-40-01-resource-service.md` | 4-package changeset (services: minor, acl/runtime/shell: patch) | VERIFIED | File exists; frontmatter lists all 4 packages with correct bump levels |
| `apps/demo/napplets/resource-demo/index.html` | HTML shell with sentinel IDs | VERIFIED | 74 lines; contains `#resource-demo-status`, `#resource-demo-granted`, `#resource-demo-denied`, `#resource-demo-log`; NO `<meta http-equiv="Content-Security-Policy">` |
| `apps/demo/napplets/resource-demo/src/main.ts` | Napplet dispatch logic | VERIFIED | 211 lines (plan: 80+ min); `GRANTED_URL = 'http://localhost:4174/demo-data.json'`; `DENIED_URL = 'https://untrusted.example/'`; dispatches two `resource.bytes` envelopes; dedicated message listener for `resource.*` responses |
| `apps/demo/napplets/resource-demo/package.json` | Standalone package manifest with `@napplet/shim` | VERIFIED | `name: '@kehto/demo-resource-demo'`; `@napplet/shim` + `@napplet/sdk` in dependencies |
| `apps/demo/public/demo-data.json` | Static fixture with `"kehto demo"` | VERIFIED | 6 lines; `{ "name": "kehto demo", "version": "1.7", "items": [1,2,3], "source": "resource-demo granted fetch fixture" }` |
| `apps/demo/src/shell-host.ts` | `createResourceService` registered; `DEMO_NAPPLETS` 12; `CLASS_BY_DTAG` 12 | VERIFIED | `createResourceService` imported at line 30; called at line 657 with all 4 options; `DEMO_NAPPLETS` count = 12; `CLASS_BY_DTAG` has `['resource-demo', null]` at line 278 |
| `apps/demo/src/main.ts` | Auto-grant for `resource-demo` before `nappletInfos` map | VERIFIED | Lines 670–701: auto-grant block calls `grantFn('resource-demo', '', 'http://localhost:4174')` BEFORE `DEMO_NAPPLETS.map(loadNapplet)` — ordering guarantee met; `__grantConnectOrigin__` hoisted to before loadNapplet at lines 598–633 |
| `docs/policies/SHELL-RESOURCE-POLICY.md` | Policy doc with canonical source header | VERIFIED | 246 lines; HTML comment header on lines 1–6 with `Source: https://github.com/napplet/napplet/.../SHELL-RESOURCE-POLICY.md`, `Source commit SHA: 27e1624`, `Copy date: 2026-04-24`; D7 host-app responsibility surface documented |
| `tests/e2e/nub-resource.spec.ts` | 2 Playwright tests: granted + denied | VERIFIED | 68 lines; 2 test cases; `frameLocator('#resource-demo-frame-container iframe')` pattern; asserts `'"kehto demo"'` in `#resource-demo-granted` and `'code=denied'` in `#resource-demo-denied` |
| `tests/e2e/class-invariant.spec.ts` | `ACTIVE_NUB_DOMAINS` extended to 10 | VERIFIED | `NubDomain` union includes `'config' \| 'resource'`; `ACTIVE_NUB_DOMAINS` array = 10 entries; JSDoc updated to "10 active NUB domains" |
| `README.md` | Policies section with all 3 policy links | VERIFIED | Lines 65–67: all 3 SHELL-*-POLICY.md files linked |
| `.planning/phases/40-nub-resource-demo-policy/40-ITERATION-LOG.md` | Phase-close loop with 71/0/0 | VERIFIED | Actual close recorded as `71 passed / 0 failed / 0 skipped`; all 9 REQ-IDs ticked in artifact ledger |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `runtime.ts handleMessage` | `enforce.ts (resource:fetch gate)` | `resolveCapabilitiesNub` returns `senderCap='resource:fetch'` for `resource.bytes` | WIRED | `resourceMap()` in resolve.ts; `case 'resource':` at line 298; enforce.ts unchanged (reads senderCap generically) |
| `runtime.ts handleResourceMessage` | `serviceRegistry['resource'].handleMessage` | `nubDispatch.registerNub('resource', resourceAdapter)` at line 1147 | WIRED | Exact registration confirmed; silence-drop prevention held (Phase 39 Dev 1 lesson) |
| `resource-service.ts createResourceService` | `options.getConnectGrants + options.isOriginGranted` | H-03 construction guard; pre-fetch grant check in `handleBytes` | WIRED | Guard fires on empty/partial options (behavioral spot-check passed); `getConnectGrants` invoked before any fetch call in `handleBytes` |
| `resource-service.ts resource.cancel handler` | `inFlight AbortController map keyed by requestId` | `Map<requestId, { controller, windowId }>` mutations | WIRED | `inFlight.set` on bytes dispatch; `inFlight.get(requestId).controller.abort()` on cancel; `untrackRequest` in finally block |
| `shell-host.ts createDemoHooks` | `createResourceService from @kehto/services` | `services.resource = createResourceService({ hostFetch, isOriginGranted, getConnectGrants, resolveIdentity })` | WIRED | Import at line 30; factory called at line 657 with deferred `_sessionRegistryRef` pattern |
| `apps/demo/src/main.ts demo boot` | `connectStore.grant + /__connect-grants sync` | `__grantConnectOrigin__('resource-demo', '', 'http://localhost:4174')` before `DEMO_NAPPLETS.map` | WIRED | Auto-grant block at lines 670–701; D3 ordering constraint met via hoist |
| `resource-demo/src/main.ts` | `shell via provisional postMessage dispatch` | `window.parent.postMessage({ type: 'resource.bytes', ... })` + focused `resource.*` message listener | WIRED | `dispatchResourceBytes()` function; `window.addEventListener('message', onResourceEnvelope)` with `source === window.parent && type.startsWith('resource.')` guard |
| `nub-resource.spec.ts` | `resource-demo iframe DOM sentinels` | `page.frameLocator('#resource-demo-frame-container iframe').locator('#resource-demo-granted')` | WIRED | Container ID matches `DEMO_NAPPLETS[12].frameContainerId`; sentinel IDs match napplet HTML exactly |
| `docs/policies/SHELL-RESOURCE-POLICY.md header` | `canonical napplet repo source file` | GitHub URL + commit SHA 27e1624 + copy date | WIRED | Header pattern matches SHELL-CONNECT-POLICY.md format; canonical source was available (HTTP 200 at copy time) |
| `class-invariant.spec.ts ACTIVE_NUB_DOMAINS` | `10-domain cross-NUB invariant coverage` | parameterized `for (const domain of ACTIVE_NUB_DOMAINS)` loop | WIRED | 10-entry array confirmed; loop body unchanged (relay:write trigger preserved per design) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `resource-demo/src/main.ts` `#resource-demo-granted` | `env.bodyBase64` (from `resource.bytes.result`) | `createResourceService.handleBytes` → `hostFetch(url)` → `arrayBufferToBase64(await response.arrayBuffer())` → shell → napplet listener | Real HTTP fetch of `apps/demo/public/demo-data.json` | FLOWING |
| `resource-demo/src/main.ts` `#resource-demo-denied` | `env.code`, `env.message` (from `resource.bytes.error`) | `createResourceService.handleBytes` → `isOriginGranted(...)` → false → emits `bytes.error { code: 'denied' }` without calling fetch | Synchronous grant-check result (no network call) | FLOWING |
| `apps/demo/public/demo-data.json` | Static JSON fixture | Vite `public/` directory → served at `/demo-data.json` by demo server | Deterministic fixture content `{ "name": "kehto demo", ... }` | FLOWING |
| `shell-host.ts resolveIdentity` | `_sessionRegistryRef.getEntryByWindowId(windowId)` | Deferred ref assigned after `createShellBridge`; `sessionRegistry` from `@kehto/runtime` | Real session entry lookup from live registry | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| H-03 guard fires on empty options | `node --input-type=module` import from `dist/index.js`; `createResourceService({})` | `PASS — H-03 guard fires on empty options` | PASS |
| H-03 guard fires on partial options | Same import; `createResourceService({ fetch })` | `PASS — H-03 guard fires on partial options` | PASS |
| `createResourceService` exported as function | Check `typeof createResourceService` | `function` | PASS |
| Shell barrel type exports in `.d.ts` | `grep ResourceBytesRequest packages/shell/dist/index.d.ts` | All 8 types present in declaration file | PASS |
| `DEMO_NAPPLETS` count = 12 | `node -e` regex count on shell-host.ts | `12` | PASS |
| `docs/policies/*.md` count = 3 | `ls docs/policies/*.md | wc -l` | `3` | PASS |
| All 3 policy headers have canonical source | `head -5` grep for `Source:` | Found in all 3 files | PASS |
| README references all 3 policy files | `grep SHELL-RESOURCE-POLICY README.md` | Line found | PASS |
| Iteration log records 71/0/0 | `grep "71 passed" 40-ITERATION-LOG.md` | 3 matching lines including actual close | PASS |
| All 9 phase commits exist in git history | `git log --oneline <9 SHAs>` | All 9 commits confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RESOURCE-01 | 40-01 | `createResourceService` factory with H-03 guard; ungranted origins get `denied` | SATISFIED | `resource-service.ts` line 172–186 guard; test (d) confirms fetch never called for denied origin |
| RESOURCE-02 | 40-01 | `'resource:fetch'` in ALL_CAPABILITIES; runtime dispatch extended | SATISFIED | `capabilities.ts` line 38; `resolve.ts` `case 'resource'`; `runtime.ts` `registerNub` line 1147 |
| RESOURCE-03 | 40-01 | `resource.cancel` correlates to in-flight `resource.bytes`; emits `canceled` error | SATISFIED | `inFlight` Map in `resource-service.ts`; cancel handler aborts controller; test (f) passes |
| RESOURCE-04 | 40-02 | resource-demo as 12th napplet; `DEMO_NAPPLETS.length === 12`; `CLASS_BY_DTAG` complete | SATISFIED | `DEMO_NAPPLETS` count = 12; `CLASS_BY_DTAG` has `['resource-demo', null]`; H-05 assertion passes at build |
| RESOURCE-05 | 40-03 | `docs/policies/SHELL-RESOURCE-POLICY.md` with canonical source header | SATISFIED | File exists (246 lines); verbatim canonical mirror from napplet/napplet@27e1624; kehto cross-refs in appendix |
| RESOURCE-06 | 40-01 | Provisional resource wire types re-exported from `@kehto/shell` barrel | SATISFIED | All 8 types present in `packages/shell/src/index.ts` and `dist/index.d.ts` |
| E2E-25 | 40-03 | `nub-resource.spec.ts` with 2 tests (granted + denied) | SATISFIED | File exists (68 lines); 2 tests using `frameLocator`; recorded as passing in 71/0/0 close |
| E2E-20 | 40-03 | `class-invariant.spec.ts` extended from 8 → 10 NUB domains | SATISFIED | `ACTIVE_NUB_DOMAINS` = 10 entries; `NubDomain` union includes `'config' \| 'resource'` |
| DOCS-07 | 40-03 | `docs/policies/` directory with all 3 policy files + README reference | SATISFIED | 3 files confirmed; README lines 65–67 reference all 3 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/demo/napplets/resource-demo/index.html` | 61 | `<h2>granted fetch (localhost:5174)</h2>` — display label still references port 5174 after GRANTED_URL was corrected to 4174 | Info | Display-only label; does not affect protocol correctness or E2E assertion. Sentinel IDs and actual dispatch URL are correct. |

No blocker or warning anti-patterns found. The single informational item is a stale display string in a visible label (the heading text says "localhost:5174" but the actual `GRANTED_URL` and auto-grant were correctly corrected to 4174 — the E2E asserts on sentinel content, not heading text).

---

### Human Verification Required

#### 1. resource-demo Panel Visual Fidelity

**Test:** Open `http://localhost:4174` after `pnpm --filter @kehto/demo preview --port 4174`. Locate the resource-demo napplet card (12th).
**Expected:** "granted fetch" panel contains the parsed JSON object (`"name": "kehto demo"`, `"version": "1.7"`, `items` array); "denied fetch" panel shows `code=denied` with an origin-not-granted message.
**Why human:** Visual layout, panel readability, and correct iframe rendering cannot be fully verified by grep or unit tests. The E2E-25 Playwright spec asserts on text content but not visual presentation, panel overflow, or adjacent layout regressions.

#### 2. regression smoke on pre-Phase-40 napplets

**Test:** While demo is open, click through config-demo, preferences, and one relay napplet.
**Expected:** No visible regressions — existing panels render and respond as before.
**Why human:** Phase 40 modified `apps/demo/src/main.ts` (hoist of connect hooks) and `apps/demo/src/shell-host.ts` (+87 lines). Visual regressions from hoist ordering are not caught by unit or E2E tests.

---

### Gaps Summary

No gaps. All 5 phase success criteria are met:

1. H-03 construction guard — verified via behavioral spot-check and unit tests (a, b).
2. resource-demo granted/denied observable — napplet wired with correct URLs (4174); E2E-25 passes 2/2.
3. `resource.cancel` cancel correlation — in-flight Map + AbortController confirmed; tests (f, i) pass.
4. `DEMO_NAPPLETS` = 12; `CLASS_BY_DTAG` = 12; `CANONICAL_NUB_DOMAINS` = 9 (10 with relay) — all confirmed.
5. `docs/policies/` has 3 policy files with canonical headers; README Policies section references all 3.

The phase close iteration log records 71/0/0 (67 entering + 4 new tests), all 9 phase commits exist in git history, and all REQUIREMENTS.md checkbox entries for this phase are marked `[x]`.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
