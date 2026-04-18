---
phase: 18-napplet-sdk-migration
verified: 2026-04-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 18: Napplet SDK Migration — Verification Report

**Phase Goal:** `bot` and `chat` no longer use raw `window.addEventListener('message')`; both are fully on the `@napplet/sdk` envelope API and exercise live `ifc` + `storage` domain traffic that the demo debugger and Playwright can observe.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `addEventListener('message')` absent from bot/chat src | VERIFIED | Grep returns one comment-only match in chat/src/main.ts:12 (`* NO window.addEventListener...`). Zero live-code matches. |
| 2 | Legacy bus patterns (`EVENT`, `REGISTER`, `BusKind`, `kind===29001/2`) absent from bot/chat src | VERIFIED | Grep returns one comment-only match in chat/src/main.ts:13 (`* NO NIP-01 arrays, NO BusKind...`). Zero live-code matches. |
| 3 | Both napplet builds succeed with built artifacts present | VERIFIED | `apps/demo/napplets/bot/dist/` and `chat/dist/` both contain `index.html` + `assets/*.js`. Built 2026-04-18T02:48Z. |
| 4 | `napplet-auth.spec.ts` and `ifc-roundtrip.spec.ts` exist as substantive Playwright specs | VERIFIED | Both files present under `tests/e2e/`. `napplet-auth.spec.ts` has 2 tests asserting `#chat-status` / `#status-text` reach `'authenticated'` within 10s. `ifc-roundtrip.spec.ts` has 1 test asserting `#messages` contains `[bot]` within 8s after typing `hello`. |
| 5 | `18-ITERATION-LOG.md` documents at least one cycle and final pass | VERIFIED | Iteration 1 block present. Phase Close Gate section documents 20/20 Layer-B tests PASS (green on first iteration). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/demo/napplets/bot/src/main.ts` | SDK-only bot entry point | VERIFIED | Imports `{ ipc, storage }` from `@napplet/sdk`, imports `@napplet/shim`. No raw message listener. Calls `ipc.on('chat:message', ...)`, `ipc.emit('bot:response', ...)`, `storage.getItem/setItem('bot-rules')`. Sets `#status-text = 'authenticated'` after `loadRules()` resolves. |
| `apps/demo/napplets/bot/index.html` | Status DOM hook | VERIFIED | Contains `<span id="status-text">connecting...</span>` — the E2E auth signal selector. |
| `apps/demo/napplets/chat/src/main.ts` | SDK-only chat entry point | VERIFIED | Imports `{ relay, ipc, storage, type EventTemplate }` from `@napplet/sdk`, imports `@napplet/shim`. Calls `ipc.emit('chat:message', ...)`, `ipc.on('bot:response', ...)`, `storage.getItem/setItem('chat-history')`. Sets `#chat-status = 'authenticated'` after `loadHistory()` resolves. |
| `apps/demo/napplets/chat/index.html` | Status div + input + button + messages | VERIFIED | Contains `<div id="chat-status">`, `<div id="messages">`, `<input id="msg-input">`, `<button id="send-btn">`. |
| `tests/e2e/napplet-auth.spec.ts` | E2E-07 napplet-auth Layer-B spec | VERIFIED | 2 tests: chat `#chat-status` and bot `#status-text` both asserted to contain `'authenticated'` via `frameLocator`. Uses `demoBeforeEach` from `./helpers/index.js`. Anti-term console guard on `window.nostr|signer-service|BusKind|AUTH_KIND|kind===29001/2`. |
| `tests/e2e/ifc-roundtrip.spec.ts` | E2E-07 ifc-roundtrip Layer-B spec | VERIFIED | 1 test: types `hello` into `#msg-input`, clicks `#send-btn`, asserts `#messages` contains `[bot]` within 8s. Both napplets gated to `'authenticated'` before round-trip. Uses `demoBeforeEach`. Anti-term guard present. |
| `.planning/phases/18-napplet-sdk-migration/18-ITERATION-LOG.md` | Iteration log with Phase Close Gate | VERIFIED | 1 iteration documented (2026-04-18T00:50Z). All 20 Layer-B tests listed as PASS. Phase Close Gate checklist has 5 checked items and 1 warning (empty `napplet-aggregate-hash` due to missing `VITE_DEV_PRIVKEY_HEX`, noted as functionally acceptable). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bot/src/main.ts` | `ipc.on('chat:message')` | SDK handler after AUTH | VERIFIED | Line 196: `ipc.on('chat:message', handleChatMessage)` |
| `bot/src/main.ts` | `ipc.emit('bot:response')` | SDK emitter for replies | VERIFIED | Lines 129, 173: `ipc.emit('bot:response', [], JSON.stringify({text, timestamp}))` |
| `bot/src/main.ts` | `storage.getItem/setItem('bot-rules')` | Rules persistence | VERIFIED | Lines 81, 94: `storage.getItem(RULES_KEY)` / `storage.setItem(RULES_KEY, ...)` where `RULES_KEY = 'bot-rules'` |
| `chat/src/main.ts` | `ipc.emit('chat:message')` | Send button handler | VERIFIED | Line 102: `ipc.emit('chat:message', [], JSON.stringify({ text, timestamp }))` in `sendMessage()` |
| `chat/src/main.ts` | `ipc.on('bot:response')` | Subscription after SDK init | VERIFIED | Line 145: `ipc.on('bot:response', (payload) => { ... addMessage('[bot] ' + data.text) })` |
| `chat/src/main.ts` | `#chat-status` DOM element | Status update after init | VERIFIED | Lines 32, 141: `statusEl = getElementById('chat-status')`, `statusEl.textContent = 'authenticated'` |
| `napplet-auth.spec.ts` | `demoBeforeEach` helper | Import from `./helpers/index.js` | VERIFIED | Line 11: `import { demoBeforeEach } from './helpers/index.js'`; helper function exists in `tests/e2e/helpers/demo-before-each.ts`. |
| `ifc-roundtrip.spec.ts` | `#chat-frame-container iframe` | `frameLocator` | VERIFIED | Lines 35, 43-44: `page.frameLocator('#chat-frame-container iframe').locator('#msg-input').fill('hello')` |
| `ifc-roundtrip.spec.ts` | `[bot]` reply in `#messages` | `toContainText` | VERIFIED | Line 49: `await expect(messages).toContainText('[bot]', { timeout: 8_000 })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `bot/src/main.ts` | `rules` (Record) | `storage.getItem('bot-rules')` → SDK storage proxy → kehto runtime | Yes — real storage read via SDK proxy; state persisted and reloaded across sessions | FLOWING |
| `bot/src/main.ts` | IPC chat:message | `ipc.on('chat:message', handler)` → shell IFC routing → `handleChatMessage` | Yes — live envelope delivery from chat via shell `ifcSubscriptions` map | FLOWING |
| `chat/src/main.ts` | `#messages` list | `ipc.on('bot:response')` handler → `addMessage('[bot] ' + data.text)` | Yes — live ipc reply from bot rendered into DOM | FLOWING |
| `chat/src/main.ts` | `#chat-status` | `loadHistory()` resolves → `statusEl.textContent = 'authenticated'` | Yes — gated on real SDK/shim AUTH handshake | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — tests require a running preview server at :4174 (external service). Iteration log documents 20/20 Playwright tests passing against a live preview build. Human verification section covers re-running tests.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NAP-01 | 18-01-PLAN.md | `bot` migrated to `@napplet/sdk`; no raw `addEventListener('message')`; exercises `ifc` + `storage` | SATISFIED | `bot/src/main.ts` uses `ipc.on/emit` and `storage.getItem/setItem` exclusively. Zero live-code raw message listeners. |
| NAP-02 | 18-02-PLAN.md | `chat` migrated to `@napplet/sdk`; exercises `ifc` via `ipc.emit` / `ipc.on` | SATISFIED | `chat/src/main.ts` uses `ipc.emit('chat:message')` and `ipc.on('bot:response')`. Storage used for history. |
| E2E-07 (napplet-auth subset) | 18-03-PLAN.md | `napplet-auth.spec.ts` green — both napplets reach authenticated state | SATISFIED | Spec exists, substantive, wired to `demoBeforeEach`. Iteration log records PASS. |
| E2E-07 (ifc-roundtrip subset) | 18-03-PLAN.md | `ifc-roundtrip.spec.ts` green — chat→bot→chat round-trip | SATISFIED | Spec exists, substantive, wired. Iteration log records PASS. |
| E2E-11 | 18-04-PLAN.md | Phase closes only after build→Playwright→fix iteration loop is recorded | SATISFIED | `18-ITERATION-LOG.md` records Iteration 1 with full 20-test results table. Phase Close Gate section present. |

**Note on REQUIREMENTS.md traceability table:** The tracker at line 138 shows `E2E-07 (ifc-roundtrip, napplet-auth) | Phase 18 | Pending`. This is a stale entry — the specs are implemented and iteration log records them green. The requirement text itself at line 66 is marked `[x]` (premature — that checkbox covers all 9 E2E-07 sub-specs, only 2 delivered in Phase 18). No action required for Phase 18 closure; Phase 22 DOCS work will reconcile the traceability table.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `chat/src/main.ts` | 12 | `window.addEventListener('message')` in JSDoc comment | Info | Comment-only; documents what the code does NOT do per Phase 17 decision. Not a live-code anti-pattern. |
| `chat/src/main.ts` | 13 | `BusKind`, `window.nostr` in JSDoc comment | Info | Same as above — anti-feature documentation comment, not functional code. |
| Both dist `index.html` | — | `napplet-aggregate-hash` content is empty string | Warning | `VITE_DEV_PRIVKEY_HEX` not set in build environment. Shell ACL keys on `dTag:''` consistently; E2E suite green confirms functional correctness. Hash populates in environments with signing key configured. Not a blocker. |

No blockers found.

---

### Human Verification Required

The following cannot be verified programmatically because they require a running preview server:

#### 1. Full 20-test Layer-B Playwright Suite

**Test:** Run `pnpm test:e2e` against a `pnpm preview` build (demo at :4174, harness at :4173).
**Expected:** All 20 tests pass including `napplet-auth` (2 tests) and `ifc-roundtrip` (1 test). No regressions in Phase 17 E2E-06 specs.
**Why human:** Requires two preview servers and Playwright browser. Cannot verify from static analysis.

#### 2. Live IFC Round-Trip Debugger Observation

**Test:** Open the demo at :4174, observe the debugger pane while typing in the chat napplet and clicking send.
**Expected:** Envelope entries appear in the debugger showing `ipc.emit` traffic with type strings (not NIP-01 verbs or BusKind constants); bot reply appears in chat UI.
**Why human:** Live debugger display requires browser session; static analysis confirms code paths exist but cannot observe real envelope rendering.

---

### Gaps Summary

No gaps. All 5 must-haves are verified at all applicable levels (existence, substance, wiring, data-flow). No blocker anti-patterns. The only outstanding warning is the empty `napplet-aggregate-hash` in built artifacts, which is a known environment limitation (no `VITE_DEV_PRIVKEY_HEX` in the build context) and confirmed non-blocking by the green E2E iteration.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
