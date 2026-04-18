---
phase: 21-fixture-napplets-layer-a-specs
plan: 02
subsystem: testing
tags: [vite, typescript, napplet, sdk, fixtures, e2e, playwright]

# Dependency graph
requires:
  - phase: 21-01
    provides: legacy fixture napplets deleted; fixtures dir clean for new SDK-based fixtures
  - phase: 16-harness-triage-playwright-infrastructure
    provides: harness driver globals (__loadNapplet__, __getNubMessage__, etc.)
provides:
  - 6 SDK-based fixture napplets (nub-identity, nub-ifc, nub-notify, nub-relay, nub-storage, nub-theme)
  - turbo.json build:napplets outputs widened to include tests/fixtures/napplets/*/dist/**
  - Built dist/ for each fixture, ready for harness serveNapplets middleware
affects: [21-03, 21-04, 21-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture napplet pattern: package.json + tsconfig.json + vite.config.ts + index.html + src/main.ts (5 files per fixture)"
    - "D-04 AUTH-gate pattern: first SDK call (storage.getItem or identity.getPublicKey) gates handshake; #nub-status flips to 'authenticated' after resolve/reject"
    - "Anti-feature enforcement: zero window.addEventListener('message') in fixture src; zero banned terms (window.nostr, signer-service, BusKind, kind 29001/29002, core-compat)"
    - "JSDoc anti-feature comments use neutral phrasing to avoid false-positive anti-term grep matches (extends Phase 18 decision)"
    - "nub-theme fixture is OUTBOUND/AUTH-ONLY: storage.getItem probe; spec drives theme via __injectEnvelope__ (SDK has no theme namespace)"

key-files:
  created:
    - tests/fixtures/napplets/nub-identity/package.json
    - tests/fixtures/napplets/nub-identity/tsconfig.json
    - tests/fixtures/napplets/nub-identity/vite.config.ts
    - tests/fixtures/napplets/nub-identity/index.html
    - tests/fixtures/napplets/nub-identity/src/main.ts
    - tests/fixtures/napplets/nub-ifc/package.json
    - tests/fixtures/napplets/nub-ifc/tsconfig.json
    - tests/fixtures/napplets/nub-ifc/vite.config.ts
    - tests/fixtures/napplets/nub-ifc/index.html
    - tests/fixtures/napplets/nub-ifc/src/main.ts
    - tests/fixtures/napplets/nub-notify/package.json
    - tests/fixtures/napplets/nub-notify/tsconfig.json
    - tests/fixtures/napplets/nub-notify/vite.config.ts
    - tests/fixtures/napplets/nub-notify/index.html
    - tests/fixtures/napplets/nub-notify/src/main.ts
    - tests/fixtures/napplets/nub-relay/package.json
    - tests/fixtures/napplets/nub-relay/tsconfig.json
    - tests/fixtures/napplets/nub-relay/vite.config.ts
    - tests/fixtures/napplets/nub-relay/index.html
    - tests/fixtures/napplets/nub-relay/src/main.ts
    - tests/fixtures/napplets/nub-storage/package.json
    - tests/fixtures/napplets/nub-storage/tsconfig.json
    - tests/fixtures/napplets/nub-storage/vite.config.ts
    - tests/fixtures/napplets/nub-storage/index.html
    - tests/fixtures/napplets/nub-storage/src/main.ts
    - tests/fixtures/napplets/nub-theme/package.json
    - tests/fixtures/napplets/nub-theme/tsconfig.json
    - tests/fixtures/napplets/nub-theme/vite.config.ts
    - tests/fixtures/napplets/nub-theme/index.html
    - tests/fixtures/napplets/nub-theme/src/main.ts
  modified:
    - turbo.json

key-decisions:
  - "JSDoc anti-feature comments in fixture src must use neutral phrasing (e.g. 'NO raw postMessage, NO bus-kind references') to avoid false-positive anti-term grep matches — extends Phase 18 decision"
  - "nub-theme fixture is OUTBOUND/AUTH-ONLY: @napplet/sdk has no theme namespace; fixture uses storage.getItem probe for AUTH; Layer-A spec drives theme via __injectEnvelope__"
  - "nub-ifc fixture uses synchronous ipc.on() call (not async) because the SDK subscribe call is a side-effect registration, not a promise"

patterns-established:
  - "Fixture napplet: 5-file package per NUB domain; all 6 follow identical package.json/tsconfig.json/vite.config.ts shape"
  - "Anti-term grep: JSDoc/comment lines excluded from functional code scan; patterns confirmed 0 violations in fixture src"

requirements-completed: [E2E-09]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 21 Plan 02: Fixture Napplets Layer-A Specs — Scaffold & Build Summary

**Six SDK-based fixture napplets (nub-identity/ifc/notify/relay/storage/theme) scaffolded, built clean to dist/, and registered in pnpm workspace; turbo.json build:napplets extended to track fixture dist outputs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-18T10:31:45Z
- **Completed:** 2026-04-18T10:35:15Z
- **Tasks:** 3 of 3
- **Files modified:** 31 (30 fixture files + turbo.json edit)

## Accomplishments

- Created 30 fixture files (5 per domain x 6 domains): package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts for all 6 NUB-domain fixtures
- Updated turbo.json `build:napplets` outputs to include `tests/fixtures/napplets/*/dist/**` alongside existing `apps/demo/napplets/*/dist/**`
- All 6 fixtures build clean to `dist/index.html` via `pnpm build` (20/20 tasks successful, 0 errors)
- `pnpm type-check` passes for the entire monorepo (8/8 tasks, all cached)
- Anti-term grep: zero `window.addEventListener('message')` violations; zero banned-term occurrences in fixture src
- pnpm workspace recognizes all 6 `@kehto/fixture-nub-*` packages

## Task Commits

1. **Task 1: Scaffold 6 fixture napplet directories with package boilerplate** - `df4adec` (feat)
2. **Task 2: Create index.html for each of the 6 fixtures with required DOM sentinels** - `182c0d2` (feat)
3. **Task 3: Create src/main.ts for each of the 6 fixtures (SDK-only, anti-feature clean)** - `d3ecc82` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

### nub-identity
- `tests/fixtures/napplets/nub-identity/package.json` - `@kehto/fixture-nub-identity` workspace package
- `tests/fixtures/napplets/nub-identity/tsconfig.json` - strict ES2022 + DOM config
- `tests/fixtures/napplets/nub-identity/vite.config.ts` - `nappletType: 'fixture-nub-identity'`
- `tests/fixtures/napplets/nub-identity/index.html` - sentinels: `#nub-status`, `#nub-pubkey`, `#nub-profile-name`
- `tests/fixtures/napplets/nub-identity/src/main.ts` - `identity.getPublicKey` + `identity.getProfile` probe

### nub-ifc
- `tests/fixtures/napplets/nub-ifc/package.json` - `@kehto/fixture-nub-ifc`
- `tests/fixtures/napplets/nub-ifc/tsconfig.json` / `vite.config.ts`
- `tests/fixtures/napplets/nub-ifc/index.html` - sentinels: `#nub-status`, `#nub-ifc-log`, `#nub-ifc-emit-btn`
- `tests/fixtures/napplets/nub-ifc/src/main.ts` - `ipc.on('nub-ifc-test')` subscribe; button emits via `ipc.emit`

### nub-notify
- `tests/fixtures/napplets/nub-notify/package.json` - `@kehto/fixture-nub-notify`
- `tests/fixtures/napplets/nub-notify/tsconfig.json` / `vite.config.ts`
- `tests/fixtures/napplets/nub-notify/index.html` - sentinels: `#nub-status`, `#nub-notif-id`
- `tests/fixtures/napplets/nub-notify/src/main.ts` - `notify.send` on init; sets notification id sentinel

### nub-relay
- `tests/fixtures/napplets/nub-relay/package.json` - `@kehto/fixture-nub-relay`
- `tests/fixtures/napplets/nub-relay/tsconfig.json` / `vite.config.ts`
- `tests/fixtures/napplets/nub-relay/index.html` - sentinels: `#nub-status`, `#nub-event-id`, `#nub-encrypt-btn`, `#nub-recipient`
- `tests/fixtures/napplets/nub-relay/src/main.ts` - `relay.publish` kind:1 on init; `#nub-encrypt-btn` click triggers `relay.publishEncrypted`

### nub-storage
- `tests/fixtures/napplets/nub-storage/package.json` - `@kehto/fixture-nub-storage`
- `tests/fixtures/napplets/nub-storage/tsconfig.json` / `vite.config.ts`
- `tests/fixtures/napplets/nub-storage/index.html` - sentinels: `#nub-status`, `#nub-storage-value`
- `tests/fixtures/napplets/nub-storage/src/main.ts` - `storage.setItem` + `storage.getItem` round-trip; sets `#nub-storage-value`

### nub-theme
- `tests/fixtures/napplets/nub-theme/package.json` - `@kehto/fixture-nub-theme`
- `tests/fixtures/napplets/nub-theme/tsconfig.json` / `vite.config.ts`
- `tests/fixtures/napplets/nub-theme/index.html` - sentinels: `#nub-status`, `#nub-theme-bg`
- `tests/fixtures/napplets/nub-theme/src/main.ts` - `storage.getItem` AUTH probe only; spec drives theme via `__injectEnvelope__`

### Modified
- `turbo.json` - `build:napplets` outputs widened: added `tests/fixtures/napplets/*/dist/**`

## Verification Command Outputs

**Build output (key lines):**
```
Tasks:    20 successful, 20 total
Cached:    13 cached, 20 total
Time:    1.784s
```

**Type-check:**
```
Tasks:    8 successful, 8 total
Cached:    8 cached, 8 total
Time:    46ms >>> FULL TURBO
```

**Anti-term grep:**
- `window.addEventListener('message')` occurrences: 0
- `window.nostr|signer-service|BusKind|kind === 2900[12]|core-compat` occurrences: 0

**turbo.json before/after diff:**
```diff
 "build:napplets": {
   "dependsOn": ["^build"],
-  "outputs": ["apps/demo/napplets/*/dist/**"]
+  "outputs": [
+    "apps/demo/napplets/*/dist/**",
+    "tests/fixtures/napplets/*/dist/**"
+  ]
 },
```

## Decisions Made

1. **JSDoc neutral phrasing:** The nub-identity fixture's initial JSDoc listed banned terms by name (window.nostr, signer-service, BusKind) causing 1 anti-term grep violation. Fixed per Phase 18 decision: use neutral phrasing ("NO raw postMessage, NO bus-kind references, NO signer service"). This extends the established convention to fixture files.

2. **nub-theme is OUTBOUND/AUTH-ONLY:** @napplet/sdk has no theme namespace (only type re-exports). Fixture uses `storage.getItem('nub-theme-auth-probe')` as the AUTH gate — denial is acceptable since it still proves AUTH handshake completed. Layer-A spec drives all theme behavior via `__injectEnvelope__`.

3. **nub-ifc uses synchronous ipc.on():** The SDK `ipc.on()` call is a synchronous side-effect (registers subscription, sends ifc.subscribe envelope); it does not return a Promise. Status is set to 'authenticated' synchronously after the call, not inside a .then(). This differs from storage/notify/relay which are async.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comment contained literal banned terms causing anti-term grep false positive**
- **Found during:** Task 3 verification
- **Issue:** `nub-identity/src/main.ts` JSDoc line `NO window.nostr, NO BusKind, NO signer-service` matched the anti-term grep pattern, yielding 1 violation instead of 0
- **Fix:** Replaced with neutral phrasing: `NO raw postMessage, NO NIP-01 envelopes, NO bus-kind references, NO signer service` — extends the Phase 18 decision to fixture files
- **Files modified:** `tests/fixtures/napplets/nub-identity/src/main.ts`
- **Committed in:** d3ecc82 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — false-positive anti-term in JSDoc comment)
**Impact on plan:** Minor wording change only; no logic change. Anti-term grep clean after fix.

## Issues Encountered

None - plan executed cleanly after the JSDoc phrasing fix.

## Known Stubs

None — all 6 fixtures have functioning SDK call logic. nub-theme is intentionally OUTBOUND/AUTH-ONLY (documented in plan and JSDoc; not a stub — this is the correct design: spec drives theme delivery).

## Next Phase Readiness

- Plans 21-03 and 21-04 (Layer-A specs) are unblocked: all 6 fixture napplets loadable via `window.__loadNapplet__('nub-<domain>')` at `http://localhost:4173/napplets/nub-<domain>/`
- `pnpm build` produces `dist/index.html` for each domain — harness `serveNapplets` middleware can serve them
- turbo.json outputs tracking ensures fixtures are included in build cache invalidation

---
*Phase: 21-fixture-napplets-layer-a-specs*
*Completed: 2026-04-18*

## Self-Check: PASSED

- All 30 fixture files (5 per domain x 6 domains) confirmed on disk
- All 3 task commits confirmed in git log (df4adec, 182c0d2, d3ecc82)
- All 6 `dist/index.html` build artifacts confirmed present
