---
phase: 28-layer-a-upgrade-docs-polish
plan: 01
subsystem: testing
tags: [playwright, e2e, keys-service, media-service, harness, nub-protocol]

# Dependency graph
requires:
  - phase: 26-real-keys-backend
    provides: createKeysService() real document-level chord listener (KEYS-01..03)
  - phase: 27-real-media-backend
    provides: createMediaService() navigator.mediaSession mirror (MEDIA-01..03)
provides:
  - __registerService__ 'real' factory-key branch in harness.ts (keys + media)
  - nub-keys.spec.ts rewritten as real-backend Layer-A spec (keys.registerAction.result + keys.action push)
  - nub-media.spec.ts rewritten as real-backend Layer-A spec (media.session.create.result + navigator.mediaSession mirror)
  - envelopeLog captures both inbound AND outbound NIP-5D envelopes
  - Skip-marker audit: zero test.describe.skip / test.skip in tests/e2e/**
affects: [28-02-PLAN.md, 28-03-PLAN.md, future-harness-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'real' factory-key magic string in __registerService__ for zero-arg real-service swap-in"
    - "envelopeLog hoisted to capture outbound NIP-5D envelopes from service send callbacks"
    - "expect.poll for navigator.mediaSession.metadata.title reads to absorb bridge timing"

key-files:
  created: []
  modified:
    - tests/e2e/harness/harness.ts
    - tests/e2e/harness/package.json
    - tests/e2e/nub-keys.spec.ts
    - tests/e2e/nub-media.spec.ts

key-decisions:
  - "envelopeLog hoisted before proxy setup so getIframeWindow wrapper can record outbound NIP-5D envelopes (service send callback results) into the same Map as inbound envelopes — enables __getNubMessage__ to retrieve both directions"
  - "@kehto/services added to tests/e2e/harness/package.json dependencies — Vite requires explicit workspace dep for ESM import resolution (plan said 'no package.json edit required' but Vite bundler requires it)"
  - "outbound NIP-5D envelope capture added to getIframeWindow proxy (not createPostMessageProxy) so windowId is available for envelopeLog keying"

patterns-established:
  - "Rule 1: envelopeLog must capture outbound envelopes for real-backend assertions (stubs used window globals; real backends send via service send callback)"
  - "Rule 3: Vite harness build requires @kehto/services in package.json dependencies for ESM import resolution"

requirements-completed: [E2E-14]

# Metrics
duration: 6min
completed: 2026-04-19
---

# Phase 28 Plan 01: Layer-A Real-Backend Spec Upgrade Summary

**Upgraded nub-keys.spec.ts + nub-media.spec.ts from stub-scope to real-backend Layer-A coverage via __registerService__('name', 'real') factory-key branch; extended envelopeLog to capture outbound NIP-5D service-send envelopes so result assertions work without window globals.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-19T18:20:42Z
- **Completed:** 2026-04-19T18:27:12Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `tests/e2e/harness/harness.ts`: Extended `__registerService__` with a single `'real'` factory-key branch — `__registerService__('keys', 'real')` instantiates `createKeysService()`, `__registerService__('media', 'real')` instantiates `createMediaService()`; existing eval path preserved untouched
- `tests/e2e/nub-keys.spec.ts`: Rewrites STUB SCOPE NOTICE stub spec to real-backend Layer-A spec; asserts `keys.registerAction.result` envelope from real service + `keys.action` push from synthetic `document.dispatchEvent(KeyboardEvent)` chord match
- `tests/e2e/nub-media.spec.ts`: Rewrites STUB SCOPE NOTICE stub spec to real-backend Layer-A spec; asserts `media.session.create.result` envelope + `navigator.mediaSession.metadata.title` mirror after session.create AND session.update; skip-marker audit across tests/e2e/** returns zero matches

## Task Commits

1. **Task 1: Extend harness.ts __registerService__ with 'real' factory-key branch** - `2eb80ec` (feat)
2. **Task 2: Rewrite nub-keys.spec.ts as real-backend Layer-A spec** - `58480f3` (feat)
3. **Task 3: Rewrite nub-media.spec.ts as real-backend Layer-A spec + skip audit** - `dcf33c6` (feat)

## Files Created/Modified

- `tests/e2e/harness/harness.ts` — Added `@kehto/services` import; hoisted `envelopeLog` to capture outbound envelopes; extended `getIframeWindow` wrapper to record outbound NIP-5D object envelopes; added `'real'` factory-key branch in `__registerService__`
- `tests/e2e/harness/package.json` — Added `@kehto/services: workspace:*` to dependencies (required for Vite ESM resolution)
- `tests/e2e/nub-keys.spec.ts` — Full rewrite: deleted STUB SCOPE NOTICE + stub body; uses `__registerService__('keys', 'real')`; asserts `.result` envelope + `keys.action` push on synthetic `KeyboardEvent`
- `tests/e2e/nub-media.spec.ts` — Full rewrite: deleted STUB SCOPE NOTICE + stub body; uses `__registerService__('media', 'real')`; asserts `.result` envelope + `navigator.mediaSession.metadata.title` mirror (session.create + session.update)

## Decisions Made

- **envelopeLog hoisted and outbound capture added**: The original `envelopeLog` only captured inbound (napplet→shell) envelopes. Real service handlers send result envelopes via the `send` callback → `hooks.sendToNapplet` → `originRegistry.getIframeWindow(windowId).postMessage(msg)`. The `getIframeWindow` proxy now captures non-array NIP-5D object messages into `envelopeLog` keyed by windowId, enabling `__getNubMessage__` to retrieve both inbound requests AND outbound response envelopes.
- **@kehto/services added to harness package.json**: The plan noted "no package.json edit required" but the Vite bundler fails to resolve workspace `@kehto/services` without an explicit dependency declaration in the consumer's package.json. Adding `"@kehto/services": "workspace:*"` fixes the Vite rollup resolution error.
- **getIframeWindow proxy, not createPostMessageProxy**: The outbound capture must go in the `getIframeWindow` wrapper (which has `windowId` in scope) rather than in `createPostMessageProxy` (which only knows the Window reference). This lets us key the outbound envelope into `envelopeLog[windowId]` directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @kehto/services to tests/e2e/harness/package.json**
- **Found during:** Task 1 (extend harness.ts __registerService__)
- **Issue:** Vite build failed with "Rollup failed to resolve import '@kehto/services'" — the plan stated no package.json edit required, but Vite requires explicit workspace dependency declarations to resolve ESM imports
- **Fix:** Added `"@kehto/services": "workspace:*"` to `tests/e2e/harness/package.json` dependencies; ran `pnpm install`
- **Files modified:** `tests/e2e/harness/package.json`
- **Verification:** `pnpm --filter @test/harness build` exits 0; `pnpm build` exits 0
- **Committed in:** `58480f3` (Task 2 commit, alongside envelopeLog fix)

**2. [Rule 1 - Bug] Hoisted envelopeLog + extended getIframeWindow proxy to capture outbound NIP-5D envelopes**
- **Found during:** Task 2 (nub-keys.spec.ts run — keys.registerAction.result timeout)
- **Issue:** `keys.registerAction.result` (shell→napplet via service send callback) was never captured in `envelopeLog` — the original proxy only captured NIP-01 array-format messages; NIP-5D object messages sent by service handlers went uncaptured. The old stub specs worked around this by using `window.__lastKeysReq` / `window.__lastMediaReq` globals set inside the stub handler body itself. Real backends have no such globals.
- **Fix:** (a) Hoisted `envelopeLog` declaration to before the proxy setup block so it's in scope for the `getIframeWindow` wrapper; (b) Extended the `getIframeWindow` wrapper's inner proxy to also record non-array NIP-5D object messages (with `type: string`) into `envelopeLog` keyed by `windowId`; (c) Removed the now-duplicate `envelopeLog` declaration from its original location and replaced with a comment.
- **Files modified:** `tests/e2e/harness/harness.ts`
- **Verification:** `pnpm exec playwright test tests/e2e/nub-keys.spec.ts --reporter=list` exits 0; both `keys.registerAction.result` and `keys.action` push envelopes captured
- **Committed in:** `58480f3` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking [Rule 3], 1 bug [Rule 1])
**Impact on plan:** Both fixes required for correctness — the harness extension was functionally incomplete without outbound envelope capture; the package.json fix was a build prerequisite. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — both specs now assert real-backend behavior (not shape-only stubs). E2E-14 requirement closed.

## Next Phase Readiness

- 28-02-PLAN.md (DOCS-05): Append Keys Service + Media Service sections to `packages/services/README.md` — no blocking dependencies on 28-01 code; can proceed immediately
- 28-03-PLAN.md (DOCS-06 + iteration loop): Create `apps/demo/README.md`; run fresh `pnpm clean && pnpm build && pnpm test:e2e`; record 28-ITERATION-LOG.md; expected result: 49 passed / 0 failed / 0 skipped (in-place spec rewrites, no net count delta)

---
*Phase: 28-layer-a-upgrade-docs-polish*
*Completed: 2026-04-19*
