---
phase: 20-expanded-domain-napplets
plan: "07"
subsystem: testing
tags: [e2e, playwright, relay-subscribe, identity-flow, theme-broadcast, NAP-06, NAP-07, NAP-08, layer-b]

# Dependency graph
requires:
  - phase: 20-expanded-domain-napplets/20-01
    provides: mock-relay-pool.ts with 5 fixture kind:1 events (FIXTURE_EVENTS[0].content = "Welcome to the kehto demo!")
  - phase: 20-expanded-domain-napplets/20-02
    provides: feed napplet with DOM sentinel contract (#feed-status, #feed-list .feed-item)
  - phase: 20-expanded-domain-napplets/20-03
    provides: profile-viewer napplet with DOM sentinel contract (#profile-status, #profile-pubkey, truncatePubkey sentinel)
  - phase: 20-expanded-domain-napplets/20-04
    provides: theme-switcher napplet with #theme-dark-btn + data-active='true' DOM contract
  - phase: 20-expanded-domain-napplets/20-05
    provides: preferences #preferences-theme-applied DOM element + theme.changed listener
  - phase: 20-expanded-domain-napplets/20-06
    provides: demo host demo.publishTheme listener bridging to relay.publishTheme fan-out

provides:
  - relay-subscribe.spec.ts — feed napplet subscribe + receive 5 fixture events E2E assertion
  - identity-flow.spec.ts — profile-viewer identity.getPublicKey read flow E2E assertion
  - theme-broadcast.spec.ts — theme-switcher → preferences round-trip E2E assertion

affects: [20-08-iteration-gate, e2e-11-iteration-gate, v1.3-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layer-B spec pattern: demoBeforeEach + frameLocator + frame.evaluate for button clicks + ANTI_TERM_RE guards"
    - "Serial mode + 60s timeout per spec file to prevent postMessage timing interference"
    - "Dual-path tolerance: accept both 'loaded' and 'denied:' in identity/storage-blocked flows"

key-files:
  created:
    - tests/e2e/relay-subscribe.spec.ts
    - tests/e2e/identity-flow.spec.ts
    - tests/e2e/theme-broadcast.spec.ts
  modified: []

key-decisions:
  - "relay-subscribe spec asserts #feed-list .feed-item count exactly 5 — deterministic because mock pool always emits all FIXTURE_EVENTS"
  - "identity-flow spec tolerates 'loaded' + 'denied:' paths — no default signer in demo; both prove envelope dispatched"
  - "theme-broadcast spec uses frame.evaluate for #theme-dark-btn click (sandboxed cross-origin iframe pattern)"
  - "DARK_BG_HEX='#0a0a0a' and DARK_BG_RGB='rgb(10, 10, 10)' extracted as named constants for assertion clarity"
  - "Step 5 in theme-broadcast spec checks debugger for 'theme broadcast — bg: #0a0a0a' (exact Plan 20-06 log string)"

patterns-established:
  - "Phase 20 Layer-B spec template: imports + test.use baseURL:4174 + mode:serial + ANTI_TERM_RE const + named constants for assertions"
  - "Anti-term exemption matrix documented in SUMMARY for Plan 20-08 (per-napplet window.addEventListener expected counts)"

requirements-completed:
  - NAP-06
  - NAP-07
  - NAP-08

# Metrics
duration: 2min
completed: "2026-04-18"
---

# Phase 20 Plan 07: Layer-B E2E Specs (relay-subscribe, identity-flow, theme-broadcast) Summary

**3 serial-mode Layer-B Playwright specs covering feed relay.subscribe, profile-viewer identity.getPublicKey, and theme-switcher → preferences theme.changed round-trip — all asserting against demo at :4174**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T09:31:06Z
- **Completed:** 2026-04-18T09:32:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created `tests/e2e/relay-subscribe.spec.ts` (69 lines) — asserts feed napplet reaches 'loaded (5)' with exactly 5 .feed-item children and fixture content "Welcome to the kehto demo"
- Created `tests/e2e/identity-flow.spec.ts` (73 lines) — asserts profile-viewer reaches 'loaded'/'denied:' + pubkey sentinel + debugger 'identity.getPublicKey'
- Created `tests/e2e/theme-broadcast.spec.ts` (80 lines) — asserts full theme-switcher → preferences round-trip including body backgroundColor computed style
- All 3 specs follow exact Phase 19 relay-publish.spec.ts template pattern

## Task Commits

1. **Task 1: Create relay-subscribe.spec.ts** - `0517da8` (feat)
2. **Task 2: Create identity-flow.spec.ts** - `48c8f33` (feat)
3. **Task 3: Create theme-broadcast.spec.ts** - `3d70e98` (feat)

**Plan metadata:** (docs commit — see final_commit below)

## Files Created/Modified

- `tests/e2e/relay-subscribe.spec.ts` — Feed napplet subscribe + receive 5 fixture events assertion
- `tests/e2e/identity-flow.spec.ts` — Profile-viewer identity read flow assertion with 'no-pubkey' sentinel tolerance
- `tests/e2e/theme-broadcast.spec.ts` — Theme-switcher → preferences round-trip assertion (DARK_BG_HEX + body bg)

## Assertion Sets Per Spec

### relay-subscribe.spec.ts
1. `#feed-status` contains 'authenticated' (AUTH probe complete)
2. `#feed-status` matches `/^(subscribed|loaded)/` (relay.subscribe dispatched)
3. `#feed-status` contains 'loaded (5)' (EOSE received, 5 events rendered)
4. `#feed-list .feed-item` count equals 5
5. `#feed-list` contains 'Welcome to the kehto demo' (fixture delivery proof)
6. `napplet-debugger` contains 'relay.subscribe' (envelope type visible)
7. ANTI_TERM_RE console + pageerror guards

### identity-flow.spec.ts
1. `#profile-status` contains 'authenticated' (AUTH probe complete)
2. `#profile-status` matches `/^(loaded|denied:)/` (identity.getPublicKey dispatched)
3. If loaded: `#profile-pubkey` is truncated hex `/^[0-9a-f]{8}\.\.\.[0-9a-f]{4}$/i` OR 'no-pubkey' sentinel
4. `napplet-debugger` contains 'identity.getPublicKey' (envelope type visible)
5. ANTI_TERM_RE console + pageerror guards

### theme-broadcast.spec.ts
1. `#theme-status` contains 'authenticated' (theme-switcher AUTH probe complete)
2. `#preferences-status` matches `/^(loaded|denied:)/` (preferences ready)
3. `#theme-dark-btn` has attribute `data-active='true'` after click
4. `napplet-debugger` contains 'theme broadcast — bg: #0a0a0a' (Plan 20-06 host log)
5. `#preferences-theme-applied` text equals '#0a0a0a' (Plan 20-05 observer update)
6. preferences body `getComputedStyle.backgroundColor` equals 'rgb(10, 10, 10)' (Chromium-normalized #0a0a0a)
7. ANTI_TERM_RE console + pageerror guards

## Constants Used

| Constant | Value | Source |
|----------|-------|--------|
| `DARK_BG_HEX` | `'#0a0a0a'` | Plan 20-04 DARK_THEME.colors.background |
| `DARK_BG_RGB` | `'rgb(10, 10, 10)'` | Chromium getComputedStyle normalization of #0a0a0a |
| First fixture content | `'Welcome to the kehto demo'` | Plan 20-01 FIXTURE_EVENTS[0].content (partial match) |
| Pubkey sentinel | `'no-pubkey'` | truncatePubkey('') from Plan 20-03 |
| Truncated hex regex | `/^[0-9a-f]{8}\.\.\.[0-9a-f]{4}$/i` | Plan 20-03 truncatePubkey format |

## Anti-Term Exemption Matrix (for Plan 20-08 iteration verification)

| File | window.addEventListener count | Rule |
|------|------------------------------|------|
| `apps/demo/napplets/feed/src/main.ts` | **0** | No exemption needed; relay.subscribe is native SDK |
| `apps/demo/napplets/profile-viewer/src/main.ts` | **0** | No exemption needed; identity.getPublicKey is native SDK |
| `apps/demo/napplets/theme-switcher/src/main.ts` | **0** | Outbound-only; no global listener installed (Plan 20-04) |
| `apps/demo/napplets/toaster/src/main.ts` | **1** | Plan 19-03 SDK gap exemption (notify.created/notify.listed reply) |
| `apps/demo/napplets/preferences/src/main.ts` | **1** | Plan 20-05 D-USER-02 exemption (theme.changed observer) |
| `apps/demo/src/main.ts` | **1+** | Host file — demo.publishTheme listener exempt (Plan 20-06 + existing MessageTap) |
| `apps/demo/napplets/composer/src/main.ts` | **0** | No exemption; sdk-only |
| `apps/demo/napplets/chat/src/main.ts` | **0** | No exemption; sdk-only |
| `apps/demo/napplets/bot/src/main.ts` | **0** | No exemption; sdk-only |

## Decisions Made

- All 3 specs use `test.setTimeout(60_000)` — consistent with Phase 19 relay-publish.spec.ts pattern for postMessage-heavy specs
- identity-flow spec uses dual-path tolerance (`/^(loaded|denied:)/`) — matches real demo behavior (no NIP-46 signer configured by default)
- theme-broadcast spec uses `frame.evaluate()` for #theme-dark-btn click — consistent with Phase 19-05 decision for sandboxed iframe button interactions
- relay-subscribe spec accepts `/^(subscribed|loaded)/` at Step 2 — mock pool's microtask dispatch may resolve before status update is observed; either proves subscribe happened

## Deviations from Plan

None — plan executed exactly as written. All 3 spec files match the plan's implementation template verbatim.

## Issues Encountered

None.

## Known Stubs

None — all 3 specs assert against real DOM state wired to real SDK calls. No placeholder assertions.

## Next Phase Readiness

- All 3 Layer-B specs are syntactically valid TypeScript
- Plan 20-08 (iteration gate) can now run `pnpm test:e2e` to execute all Phase 17–20 specs and confirm green
- Anti-term exemption matrix documented above for Plan 20-08 grep verification

## Self-Check: PASSED

- FOUND: tests/e2e/relay-subscribe.spec.ts
- FOUND: tests/e2e/identity-flow.spec.ts
- FOUND: tests/e2e/theme-broadcast.spec.ts
- FOUND commit: 0517da8 (Task 1 — relay-subscribe.spec.ts)
- FOUND commit: 48c8f33 (Task 2 — identity-flow.spec.ts)
- FOUND commit: 3d70e98 (Task 3 — theme-broadcast.spec.ts)

---
*Phase: 20-expanded-domain-napplets*
*Completed: 2026-04-18*
