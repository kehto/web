---
phase: 20-expanded-domain-napplets
verified: 2026-04-17T00:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 20: Expanded Domain Napplets Verification Report

**Phase Goal:** `feed`, `profile-viewer`, and `theme-switcher` napplets are live in the demo, completing the 8-domain end-to-end showcase; all remaining Layer-B domain specs are green.
**Verified:** 2026-04-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `mock-relay-pool.ts` exists with 5 fixture events + subscribe/publish | VERIFIED | File at `apps/demo/src/mock-relay-pool.ts`; `FIXTURE_EVENTS` array has exactly 5 `kind:1` objects; `subscription()` returns observable `{subscribe(fn){...}}` shape; `publish()` stores events in `publishedEvents[]` |
| 2 | 3 new napplet directories exist with full skeletons + built dist | VERIFIED | `apps/demo/napplets/{feed,profile-viewer,theme-switcher}/` each contain `src/main.ts`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, and a `dist/` directory with `assets/` + `index.html` |
| 3 | `preferences/` extended with theme observer + `#preferences-theme-applied` DOM | VERIFIED | `preferences/src/main.ts` installs a narrowly-scoped `window.addEventListener('message')` guarded on `event.data.type === 'theme.changed'`; sets `#preferences-theme-applied` textContent to `bg` hex; `index.html` line 110 has `<span id="preferences-theme-applied"></span>` |
| 4 | `DEMO_NAPPLETS` has 8 entries in `shell-host.ts` | VERIFIED | `DEMO_NAPPLETS` array at line 119 of `apps/demo/src/shell-host.ts` has 8 definitions: chat, bot, composer, preferences, toaster, feed, profile-viewer, theme-switcher |
| 5 | `main.ts` installs `demo.publishTheme` host listener | VERIFIED | `apps/demo/src/main.ts` line 277: `window.addEventListener('message', ...)` with guard `data.type !== 'demo.publishTheme'`; on match calls `relay.publishTheme(themeTyped)` |
| 6 | 3 new specs exist: `tests/e2e/{relay-subscribe,identity-flow,theme-broadcast}.spec.ts` | VERIFIED | All 3 files exist and are substantive: relay-subscribe (76 lines, 6-step pipeline assert), identity-flow (79 lines, 4-step protocol round-trip), theme-broadcast (80 lines, 7-step fan-out + DOM assert) |
| 7 | `20-ITERATION-LOG.md` documents 4 iterations with final 39 passing / 0 failing | VERIFIED | File at `.planning/phases/20-expanded-domain-napplets/20-ITERATION-LOG.md`; documents Iteration 1 (35p/70f), Iteration 2 (35p/2f/68s), Iteration 3 (38p/1f/68s), Iteration 4 (39p/0f/68s). 5 root-cause bugs fixed; Layer-A specs deferred to Phase 21 via `test.describe.skip` |
| 8 | NAP-09 deferral doc comment in `shell-host.ts` documents keys/media as stub-only | VERIFIED | `STUB_ONLY_SERVICES: readonly string[] = ['keys', 'media']` at line 105; NAP-09 COVERAGE GATE block at lines 442–461 documents each deferred domain with reason; JSDoc in `createDemoHooks()` at lines 422–431 logs stub-only activity |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/demo/src/mock-relay-pool.ts` | 5 fixture events + subscribe/publish | VERIFIED | 227 lines; `FIXTURE_EVENTS[5]`; `subscription()` observable shape; `publish()` stores to `publishedEvents[]` |
| `apps/demo/napplets/feed/src/main.ts` | Full feed napplet skeleton | VERIFIED | 109 lines; `relay.subscribe({kinds:[1], limit:5})`, onEvent renders `<li class="feed-item">`, EOSE sets `loaded (N)` status |
| `apps/demo/napplets/feed/dist/` | Built napplet | VERIFIED | `dist/assets/` + `dist/index.html` present |
| `apps/demo/napplets/profile-viewer/src/main.ts` | Full profile-viewer skeleton | VERIFIED | 105 lines; `identity.getPublicKey()` + `identity.getProfile()`; truncated pubkey render; `loaded`/`denied:` status contract |
| `apps/demo/napplets/profile-viewer/dist/` | Built napplet | VERIFIED | `dist/assets/` + `dist/index.html` present |
| `apps/demo/napplets/theme-switcher/src/main.ts` | Full theme-switcher skeleton | VERIFIED | 147 lines; LIGHT/DARK presets; `dispatchTheme()` calls `window.parent.postMessage({type:'demo.publishTheme',...})`; 3 button handlers; `data-active` toggle |
| `apps/demo/napplets/theme-switcher/dist/` | Built napplet | VERIFIED | `dist/assets/` + `dist/index.html` present |
| `apps/demo/napplets/preferences/src/main.ts` | Extended with theme observer + DOM sentinel | VERIFIED | `window.addEventListener('message')` with `theme.changed` guard; sets `document.body.style.backgroundColor` + `#preferences-theme-applied` textContent |
| `apps/demo/napplets/preferences/index.html` | `#preferences-theme-applied` element | VERIFIED | Line 110: `<span id="preferences-theme-applied"></span>` |
| `apps/demo/src/shell-host.ts` | 8-entry DEMO_NAPPLETS + NAP-09 gate | VERIFIED | Lines 119–184: 8 napplet definitions; lines 104–105: STUB_ONLY_SERVICES; lines 442–461: NAP-09 COVERAGE GATE comment |
| `apps/demo/src/main.ts` | `demo.publishTheme` listener | VERIFIED | Lines 277–290: narrowly-scoped message listener; calls `relay.publishTheme()` |
| `tests/e2e/relay-subscribe.spec.ts` | Layer-B spec for NAP-06 / E2E-07 | VERIFIED | 76 lines; 6-step test: AUTH → subscribed → loaded(5) → 5 items → content → debugger label |
| `tests/e2e/identity-flow.spec.ts` | Layer-B spec for NAP-07 / E2E-07 | VERIFIED | 79 lines; 4-step test: AUTH → loaded/denied → pubkey sentinel → debugger label |
| `tests/e2e/theme-broadcast.spec.ts` | Layer-B spec for NAP-08 / E2E-07 | VERIFIED | 80 lines; 7-step test: AUTH → click Dark → data-active → debugger → `#preferences-theme-applied` → body backgroundColor |
| `.planning/phases/20-expanded-domain-napplets/20-ITERATION-LOG.md` | 4 iterations + final green | VERIFIED | 4 iteration cycles; Iteration 4 headline: "39 passed, 0 failed, 68 skipped" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `theme-switcher/src/main.ts` | `apps/demo/src/main.ts` | `window.parent.postMessage({type:'demo.publishTheme'})` | WIRED | `dispatchTheme()` calls `window.parent.postMessage`; `main.ts` listener guards on `data.type !== 'demo.publishTheme'` |
| `apps/demo/src/main.ts` | `relay.publishTheme()` | `ShellBridge.publishTheme` | WIRED | `relay.publishTheme(themeTyped as Parameters<typeof relay.publishTheme>[0])` at line 288 |
| `shell-bridge.publishTheme` | preferences iframe | `originRegistry.getAllWindowIds()` fan-out | WIRED | Iteration 1 fix: changed from `sessionRegistry.getAllEntries()` (broken when all pubkeys are `''`) to `originRegistry.getAllWindowIds()` |
| `preferences/src/main.ts` | `#preferences-theme-applied` | `themeAppliedEl.textContent = bg` | WIRED | Line 141 sets textContent; line 131 retrieves element by id |
| `feed/src/main.ts` | `mock-relay-pool` | `relay.subscribe({kinds:[1], limit:5})` → hooks-adapter → `pool.subscription().subscribe(fn)` | WIRED | Feed calls `relay.subscribe`; pool's `subscription()` returns observable shape; `hooks-adapter.ts` calls `.subscribe(fn)`; microtasks deliver events then EOSE |
| `profile-viewer/src/main.ts` | `identity-service` | `identity.getPublicKey()` → NUB envelope | WIRED | Iteration 1 fix: identity-service now returns `{type:'identity.getPublicKey.result', pubkey:''}` when no signer (previously sent error, causing 30s hang) |
| `apps/demo/src/shell-host.ts` | `mock-relay-pool.ts` | `createMockRelayPool()` in `createDemoHooks()` | WIRED | `relayPool: createMockRelayPool()` at line 487 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `feed/src/main.ts` | `FIXTURE_EVENTS[]` via `onEvent` callback | `mock-relay-pool.ts` `FIXTURE_EVENTS` constant (5 kind:1 events) | Yes — 5 deterministic fixture events delivered via microtask | FLOWING |
| `profile-viewer/src/main.ts` | `pubkey` via `identity.getPublicKey()` | `identity-service.ts` — returns `''` when no signer, real pubkey when signer connected | Yes — always returns result (never hangs) | FLOWING |
| `preferences/src/main.ts` | `bg` string via `theme.changed` message | `shell-bridge.publishTheme` fan-out from `theme-switcher` click | Yes — DARK_THEME preset hex `#0a0a0a` flows to DOM | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — verification is static-only (no running server available). Iteration log provides authoritative dynamic evidence: 39 passing Playwright E2E specs with 0 failures from actual browser runs.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| NAP-06 | `feed` napplet with `relay.subscribe`; renders events; EOSE sets "loaded" | SATISFIED | `feed/src/main.ts` exercises `relay.subscribe({kinds:[1], limit:5})`; `#feed-status` reaches `loaded (5)`; `relay-subscribe.spec.ts` passes |
| NAP-07 | `profile-viewer` with `identity.getPublicKey` + `identity.getProfile`; shows truncated pubkey | SATISFIED | `profile-viewer/src/main.ts` calls both identity APIs; truncated pubkey or `no-pubkey` sentinel rendered; `identity-flow.spec.ts` passes |
| NAP-08 | `theme-switcher` triggers host `publishTheme()`; other napplet reacts to `theme.changed` | SATISFIED | `theme-switcher/src/main.ts` dispatches `demo.publishTheme`; `main.ts` forwards to `relay.publishTheme()`; `preferences` observer updates DOM; `theme-broadcast.spec.ts` passes |
| NAP-09 | All 6 non-stub NUB domains exercised end-to-end; keys + media stub-only with documented reason | SATISFIED | identity (profile-viewer), ifc (chat+bot), notify (toaster), relay (composer+feed), storage (preferences), theme (theme-switcher+preferences); `STUB_ONLY_SERVICES = ['keys','media']` with NAP-09 COVERAGE GATE JSDoc block |
| E2E-07 (relay-subscribe, identity-flow, theme-broadcast) | Layer-B domain specs green for Phase 20 subset | SATISFIED | All 3 specs exist and passed in Iteration 4 (39 passed, 0 failed); iteration log confirms green |
| E2E-11 | Phase closes with recorded build→run→Playwright→fix iteration loop | SATISFIED | `20-ITERATION-LOG.md` documents 4 complete cycles: build results, Playwright summaries, failure analysis, fixes applied |

**Note on REQUIREMENTS.md tracking table:** The table at line 138–140 shows E2E-07 Phase 18/19/20 subsets as "Pending" — this is a stale tracking table that was not updated when E2E-07 was marked complete in the prose checklist (line 66 shows `[x]`). This is a documentation inconsistency, not a code gap. The actual specs pass.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `preferences/src/main.ts` | 132 | `window.addEventListener('message', ...)` | Info | Documented SDK-gap exemption (theme.on not exposed by @napplet/sdk); guarded on `event.source === window.parent` + `data.type === 'theme.changed'`; parallels Phase 19 toaster exemption |
| `toaster/src/main.ts` | 1 | `window.addEventListener('message', ...)` | Info | Pre-existing Phase 19-03 documented exemption — not introduced by Phase 20 |

No blocker anti-patterns. No stub implementations. No hardcoded empty returns in data paths. No TODO/FIXME in new napplet sources. Zero actual anti-term violations (`window.nostr`, `signer-service`, `BusKind`, `kind === 29001/29002`) in napplet live code — confirmed by iteration log anti-term grep matrix at 2026-04-18T10:06Z.

### Human Verification Required

None. All observable behaviors are verifiable from static code inspection and the iteration log's Playwright evidence.

### Gaps Summary

No gaps. All 8 must-haves are verified at Levels 1–4:

- `mock-relay-pool.ts`: exists, substantive (5 fixtures + observable shape), wired (imported in `shell-host.ts` as `createMockRelayPool()`), data flowing (events delivered via microtask to feed napplet)
- All 3 new napplet directories: exist, substantive (full implementations), wired (registered in `DEMO_NAPPLETS`, loaded by `main.ts`), dist built
- `preferences` theme observer: exists, substantive (narrowly-scoped message handler + DOM update), wired (receives fan-out from `relay.publishTheme`), data flowing (`#preferences-theme-applied` updated)
- `DEMO_NAPPLETS` 8-entry count: verified at line 119–184
- `demo.publishTheme` listener: installed and wired to `relay.publishTheme()`
- 3 new e2e specs: exist and are substantive (multi-step assertions, not smoke tests)
- Iteration log: 4 cycles documented; final state 39p/0f/68s
- NAP-09 deferral: `STUB_ONLY_SERVICES`, COVERAGE GATE JSDoc block, and inline comments all present

The one documentation inconsistency (REQUIREMENTS.md tracking table showing E2E-07 Phase 20 subset as "Pending") does not affect phase goal achievement — the prose checklist marks E2E-07 complete and the specs pass.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
