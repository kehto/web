---
phase: 19-core-domain-napplets
plan: 03
subsystem: ui
tags: [napplet, notify, nip-5d, vite, typescript, postMessage]

# Dependency graph
requires:
  - phase: 18-napplet-sdk-migration
    provides: "bot/chat SDK-migration pattern (D-04 init, storage.getItem auth probe, anti-term conventions)"
provides:
  - "@kehto/demo-toaster workspace package: package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts"
  - "notify.create / notify.list / notify.dismiss envelope dispatch via window.parent.postMessage"
  - "7-element DOM contract: #toaster-status, #toaster-title, #toaster-body, #toaster-notify-btn, #toaster-dismiss-all-btn, #toaster-list, #toaster-log"
  - "Single narrowly-guarded message handler for notify.created / notify.listed result envelopes (Plan 19-03 explicit deviation)"
affects:
  - "19-04: must dual-register notification-service under 'notify' for runtime routing + add notify:send to DEMO_CAPABILITIES"
  - "19-05: notify-lifecycle spec asserts against this DOM contract"
  - "19-07: anti-term grep must count/exempt the single message listener in toaster/src/main.ts == 1"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SDK gap workaround: dispatch raw NIP-5D envelopes via window.parent.postMessage when @napplet/sdk does not expose the required contract"
    - "Single narrowly-guarded message handler: source check (event.source === window.parent) + type prefix check (startsWith('notify.'))"
    - "Optimistic local list management: appendListItem on notify.created, clearList after dismiss-all flow"
    - "D-04 auth probe: storage.getItem('toaster-auth-probe') as first SDK call; both resolve and reject confirm AUTH completion"

key-files:
  created:
    - apps/demo/napplets/toaster/package.json
    - apps/demo/napplets/toaster/tsconfig.json
    - apps/demo/napplets/toaster/vite.config.ts
    - apps/demo/napplets/toaster/index.html
    - apps/demo/napplets/toaster/src/main.ts
  modified: []

key-decisions:
  - "Toaster sends notify.create/list/dismiss via window.parent.postMessage (not @napplet/sdk) because the SDK does not expose these methods — explicitly documented as Plan 19-03 deviation"
  - "Single narrowly-guarded message handler listens for notify.created / notify.listed results; guarded on event.source and event.data.type prefix; 19-07 anti-term grep must exempt exactly this one listener"
  - "pendingCreates Map tracks in-flight create requests; notify.created reply uses shell-assigned id (NOT correlation id) so FIFO-oldest pop is best-effort approximation — reliable when sends are sequential (Plan 19-05 pattern)"
  - "Dismiss-all flow: notify.list -> dispatch notify.dismiss per returned id -> clearList() defensively; notification-service does not emit notify.dismissed replies so optimistic removal is the only path"
  - "JSDoc comments use neutral phrasing (no literal window.addEventListener occurrences in comments) to avoid false-positive grep -c counts per Phase 18 anti-feature JSDoc convention"

patterns-established:
  - "SDK gap workaround: raw postMessage + single guarded handler when SDK surface is incomplete"
  - "Neutral JSDoc phrasing for anti-term comments (avoid literal banned terms in comment text)"

requirements-completed: [NAP-05]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 19 Plan 03: Toaster Napplet Summary

**@kehto/demo-toaster buildable napplet dispatching notify.create/list/dismiss NIP-5D envelopes via raw window.parent.postMessage with a single narrowly-guarded message handler (Plan 19-03 SDK gap deviation)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-18T01:22:09Z
- **Completed:** 2026-04-18T01:25:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `@kehto/demo-toaster` workspace package with all 5 required files (package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts)
- Implemented D-04 init pattern: `storage.getItem('toaster-auth-probe')` gates AUTH; `#toaster-status` flips to `'authenticated'`
- Dispatches `notify.create` / `notify.list` / `notify.dismiss` raw NIP-5D envelopes via `window.parent.postMessage`
- Single narrowly-guarded message handler receives `notify.created` / `notify.listed` result envelopes; guarded on `event.source === window.parent` and `event.data.type.startsWith('notify.')`
- ACL denial path handled: `notify.*.error` envelopes set `#toaster-status` to `'denied: <reason>'`
- `pnpm --filter @kehto/demo-toaster build` exits 0; `dist/index.html` contains `napplet-aggregate-hash` meta tag

## SDK Gap (Prominent Section — Plan 19-03 Deviation)

**@napplet/sdk does NOT expose `notify.create` / `notify.list` / `notify.read`.**

- Verified at `/home/sandwich/Develop/napplet/packages/sdk/src/index.ts` lines 352-450: the SDK's `notify` namespace only exposes `send` / `dismiss` / `badge` / `requestPermission` / `onAction` / `onClicked` / `onDismissed` / `onControls` / `registerChannel`.
- The demo's `notification-service` (`packages/services/src/notification-service.ts`) implements the `notify.create` / `notify.list` / `notify.read` / `notify.dismiss` contract — NOT the SDK's `notify.send` contract.
- **Plan 19-03 chose:** Dispatch raw envelopes via `window.parent.postMessage` + listen for replies via a single narrowly-guarded message handler. This is an EXPLICIT, NARROWLY-SCOPED deviation from the v1.3 anti-feature ban on raw message listeners.
- **Plan 19-04 will:** Dual-register `notification-service` under both `'notifications'` (existing topology display name) AND `'notify'` (new routing name) so the runtime's `serviceRegistry['notify']` lookup (`packages/runtime/src/runtime.ts:1000`) routes the toaster's envelopes to the service.
- **Future work (out of scope for v1.3):** Extending `@napplet/sdk`'s `notify` namespace to expose `create` / `list` / `read`, OR migrating `notification-service` to the SDK's `notify.send` contract. No `@kehto/*` protocol changes are permitted in v1.3 per milestone constraint.

## Task Commits

1. **Task 1: Scaffold @kehto/demo-toaster workspace skeleton** - `6e73b0b` (feat)
2. **Task 2: Implement toaster src/main.ts** - `98412e2` (feat)

**Plan metadata:** (pending — final docs commit)

## Files Created/Modified

- `apps/demo/napplets/toaster/package.json` — `@kehto/demo-toaster` with `@napplet/shim`, `@napplet/sdk`, `@napplet/vite-plugin` link deps
- `apps/demo/napplets/toaster/tsconfig.json` — mirrors bot/chat exactly (ES2022, bundler moduleResolution, strict)
- `apps/demo/napplets/toaster/vite.config.ts` — `nip5aManifest({ nappletType: 'demo-toaster' })`
- `apps/demo/napplets/toaster/index.html` — 7 DOM contract IDs + `napplet-napp-type` meta tag + monospace dark theme
- `apps/demo/napplets/toaster/src/main.ts` — 208-line toaster entry: notify envelope dispatch, single message handler, D-04 auth probe

## Decisions Made

- Neutral JSDoc phrasing for anti-term comments: per Phase 18 convention, comment text does not include literal `window.addEventListener('message', ...)` occurrences so `grep -c` counts stay accurate at exactly 1.
- FIFO-oldest `pendingCreates` pop for `notify.created` correlation: notification-service reply carries shell-assigned id (not the request correlation id), so strict correlation is impossible; FIFO is reliable when sends are sequential (Plan 19-05 pattern).

## Deviations from Plan

The Plan 19-03 PLAN.md itself documents one expected deviation:

**[Plan-documented deviation] Single `window.addEventListener('message', ...)` for notify.* result envelopes**
- **Justification:** `@napplet/sdk` does not expose `notify.create` / `notify.list`; the demo's `notification-service` implements the create/list/dismiss contract; raw `window.parent.postMessage` is the only path.
- **Scope:** Exactly ONE listener; guarded on `event.source === window.parent` and `event.data.type.startsWith('notify.')`.
- **JSDoc:** Cites Plan 19-03 + the SDK gap explanation (neutral phrasing preserves grep-c == 1 invariant).
- **19-07 note:** Anti-term grep must count/exempt this single listener for `apps/demo/napplets/toaster/src/main.ts` (assert count == 1 for this file only).

One auto-fix applied during execution (not a plan deviation):

**[Rule 2 - Convention] Neutral phrasing in JSDoc comments**
- **Found during:** Task 2 verification
- **Issue:** Initial JSDoc in file header contained literal `window.addEventListener('message', ...)` in three comment lines, causing `grep -c` to return 4 instead of 1
- **Fix:** Rewrote comment text to use neutral phrasing ("single narrowly-guarded message handler", "single 'message' handler") per Phase 18 anti-feature JSDoc convention
- **Verification:** `grep -c "window.addEventListener('message'" main.ts` returns 1

---

**Total deviations:** 1 plan-documented (SDK gap workaround) + 1 auto-fixed (JSDoc phrasing)
**Impact on plan:** The SDK gap is the core subject of this plan; the JSDoc fix is a correctness fix for the grep-c invariant with no semantic impact.

## Issues Encountered

None beyond the JSDoc phrasing auto-fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `@kehto/demo-toaster` exists and builds; NAP-05 closed at source level.
- DOM contract (`#toaster-status`, `#toaster-list`, etc.) fully implemented; Plan 19-05 notify-lifecycle spec can assert against it.
- **Plan 19-04 must:**
  1. Register `@kehto/demo-toaster` in `DEMO_NAPPLETS` (demo-config.ts or equivalent)
  2. Dual-register `notification-service` under `'notify'` so runtime routing works
  3. Add `'notify:send'` to `DEMO_CAPABILITIES` so the toaster's ACL panel exposes the toggle
- **Plan 19-07 must:** Configure anti-term grep to assert exactly 1 `window.addEventListener('message', ...)` occurrence in `apps/demo/napplets/toaster/src/main.ts` (not 0, not >1).

## Self-Check: PASSED

- FOUND: apps/demo/napplets/toaster/package.json
- FOUND: apps/demo/napplets/toaster/tsconfig.json
- FOUND: apps/demo/napplets/toaster/vite.config.ts
- FOUND: apps/demo/napplets/toaster/index.html
- FOUND: apps/demo/napplets/toaster/src/main.ts
- FOUND: .planning/phases/19-core-domain-napplets/19-03-SUMMARY.md
- FOUND: commit 6e73b0b (Task 1 scaffold)
- FOUND: commit 98412e2 (Task 2 main.ts)

---
*Phase: 19-core-domain-napplets*
*Completed: 2026-04-18*
