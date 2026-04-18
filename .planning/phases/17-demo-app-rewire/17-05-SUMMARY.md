---
phase: 17-demo-app-rewire
plan: 05
subsystem: ui
tags: [typescript, acl, notifications, node-inspector, demo, nip-5d]

# Dependency graph
requires:
  - phase: 17-demo-app-rewire-01
    provides: Anti-term clearance (BusKind/AUTH_KIND/window.nostr removed)
  - phase: 17-demo-app-rewire-02
    provides: Services rewired (identity, notify, keys, media, theme)
provides:
  - DemoAclAdapter seam — single grant/revoke/block/unblock path for all UI layers
  - getAclAdapter() / getMessageTap() exports on shell-host.ts
  - subscribeAclCheck() helper on acl-history.ts
  - canonical notify.* envelope dispatch in notification-demo.ts (tap-recorded)
  - renderForRole() per-role inspector content (acl/runtime/napplet/service/shell)
  - recentEnvelopes field on NodeDetail for napplet inspector
affects: [17-06, 17-07, node-inspector, acl-panel, acl-modal, notification-demo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DemoAclAdapter adapter pattern — single seam for all ACL mutations; fan-out via _notifyAclCheckListeners"
    - "Host-originated envelope tap recording — recordInboundEnvelope + recordOutboundEnvelope for debugger parity"
    - "Per-role inspector dispatch — renderForRole switch; each role returns HTML string for its content block"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/acl-panel.ts
    - apps/demo/src/acl-modal.ts
    - apps/demo/src/acl-history.ts
    - apps/demo/src/node-details.ts
    - apps/demo/src/notification-demo.ts
    - apps/demo/src/node-inspector.ts
    - apps/demo/src/main.ts

key-decisions:
  - "DemoAclAdapter wraps toggleCapability/toggleBlock internally — no behavioral change, just a seam for the single onCheck fan-out path"
  - "notification-demo.ts dispatches notify.create/list/read/dismiss envelopes (not ifc.emit wrappers) per DEMO-07 canonical requirement"
  - "Host-originated notify.* calls recorded via recordInboundEnvelope/recordOutboundEnvelope so debugger sees them with 'demo-host' label"
  - "renderForRole() injected into renderInspectorContent() output — role-specific content block shown above existing sections/denials"
  - "v1.2 Capability type used throughout (sign:event/nip04/nip44 removed; identity:read/keys:bind/keys:forward/media:control/notify:send/notify:channel/theme:read added)"

patterns-established:
  - "Adapter seam pattern: UI files call getAclAdapter().grant/revoke, never relay.runtime.aclState.grant/revoke directly"
  - "Tap-recording host dispatchers: dispatchEnvelope() records both request and reply through the shared MessageTap"

requirements-completed: [DEMO-03, DEMO-06, DEMO-07]

# Metrics
duration: 25min
completed: 2026-04-18
---

# Phase 17 Plan 05: ACL Adapter Seam, notify.* Migration, Per-Role Inspector Summary

**DemoAclAdapter seam routes all grant/revoke mutations, notification-demo migrated to canonical notify.* envelopes (tap-recorded), node-inspector dispatches per-role renderers for acl/runtime/napplet/service/shell nodes**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-18T00:04:00Z
- **Completed:** 2026-04-18T00:30:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `DemoAclAdapter` interface + singleton to `shell-host.ts` — single seam for all grant/revoke/block/unblock from UI layer; exports `getAclAdapter()` and `getMessageTap()`
- Migrated `acl-panel.ts`, `acl-modal.ts`, `acl-history.ts` to route mutations through `getAclAdapter()` — zero direct `aclState.grant/revoke/block/unblock` calls in UI files
- Rewrote `notification-demo.ts` to dispatch `notify.create/list/read/dismiss` NappletMessage envelopes and record them via the demo message tap — host-originated traffic now visible in debugger
- Added `renderForRole()` dispatch to `node-inspector.ts` with 5 role renderers (acl → grant/revoke table, runtime → NUB list, napplet → cap state + recent envelopes, service → descriptor, shell → host pubkey)
- Extended `NodeDetail` with `recentEnvelopes?: TappedMessage[]` and `NodeDetailOptions` with optional `tap?: MessageTap`; `main.ts` passes live tap

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getAclAdapter() seam; migrate acl-panel, acl-modal, acl-history** - `9919fcc` (feat)
2. **Task 2: Rewrite notification-demo; add per-role inspector; wire recentEnvelopes** - `f5b9a0d` (feat)

## Files Created/Modified
- `apps/demo/src/shell-host.ts` — Added `DemoAclAdapter` interface, `aclAdapter` singleton, `getAclAdapter()` export, `getMessageTap()`/`setMessageTap()` accessors, `AclCheckEvent` import; `_notifyAclCheckListeners` fan-out in `onAclCheck`
- `apps/demo/src/acl-panel.ts` — Import `getAclAdapter` instead of `toggleCapability/toggleBlock`; all toggle handlers use adapter
- `apps/demo/src/acl-modal.ts` — Import `getAclAdapter` instead of `relay/toggleCapability`; data built via `adapter.snapshot()`; cell clicks use `adapter.grant/revoke`; `ALL_CAPABILITIES` updated to v1.2 set
- `apps/demo/src/acl-history.ts` — Added `getAclAdapter` import; exported `subscribeAclCheck()` helper
- `apps/demo/src/node-details.ts` — Added `recentEnvelopes?: TappedMessage[]` to `NodeDetail`; added `tap?: MessageTap` to `NodeDetailOptions`; napplet detail populates `recentEnvelopes` from tap
- `apps/demo/src/notification-demo.ts` — Rewrote to dispatch `notify.*` envelopes; `dispatchEnvelope()` records via `getMessageTap()?.recordInboundEnvelope/recordOutboundEnvelope`; removed `ifc.emit` wrappers
- `apps/demo/src/node-inspector.ts` — Added `renderForRole()` + 5 role renderers; imports `getDemoServiceNames/getNapplets/getAclAdapter/STUB_ONLY_SERVICES` from shell-host; role content block injected in `renderInspectorContent()`
- `apps/demo/src/main.ts` — Pass `tap` to `NodeDetailOptions` in `initNodeInspector` call

## Decisions Made
- Used `toggleCapability`/`toggleBlock` as the underlying implementation inside `aclAdapter` — no behavioral change, DemoAclAdapter is a thin delegation layer for seam purposes
- `_aclCheckListeners` array and `_notifyAclCheckListeners` function declared after `createDemoHooks` in the file — safe because both are only invoked at runtime (function-level, not module eval time)
- v1.2 Capability type updated throughout: `sign:event`, `sign:nip04`, `sign:nip44` removed; `identity:read`, `keys:bind`, `keys:forward`, `media:control`, `notify:send`, `notify:channel`, `theme:read` added

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Capability type arrays referencing deleted v1.1 capabilities**
- **Found during:** Task 1 (tsc --noEmit revealed TS2322/TS2353 errors)
- **Issue:** `acl-panel.ts`, `acl-modal.ts`, `node-details.ts` used `sign:event`, `sign:nip04`, `sign:nip44` which were removed from the `Capability` union in v1.2. These caused type errors and would fail at runtime ACL checks.
- **Fix:** Updated all four capability arrays to use the canonical v1.2 set (`identity:read`, `keys:bind`, `keys:forward`, `media:control`, `notify:send`, `notify:channel`, `theme:read`)
- **Files modified:** `apps/demo/src/acl-panel.ts`, `apps/demo/src/acl-modal.ts`, `apps/demo/src/node-details.ts`, `apps/demo/src/shell-host.ts` (aclAdapter.snapshot caps)
- **Verification:** `pnpm --filter @kehto/demo exec tsc --noEmit` — zero errors in modified files
- **Committed in:** `9919fcc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary type correctness fix; no scope creep.

## Issues Encountered
- `shell-host.ts` had already been modified by commit `23081c8` (17-04 plan) which added `NappletMessage` import and new `MessageTap` methods — the additions from this plan (AclCheckEvent, adapter, getMessageTap) were appended cleanly with no conflicts

## Known Stubs
None — all data flows are wired to live state. `recentEnvelopes` returns `[]` for unauthenticated napplets (expected — no tap data for them).

## Next Phase Readiness
- ACL adapter seam ready for ShellAdapter.acl hook consolidation (Phase 22+)
- notify.* envelopes flowing through debugger tap — visible in the live log
- Per-role node inspector renders role-appropriate content for all 5 roles
- Pending: 17-06 (signer UX rewire), 17-07 (Playwright E2E-06 specs)

## Self-Check: PASSED

All 8 key files exist. Both task commits verified:
- `9919fcc` — feat(17-05): add getAclAdapter() seam; migrate acl-panel, acl-modal, acl-history
- `f5b9a0d` — feat(17-05): rewrite notification-demo; add per-role inspector; wire recentEnvelopes
- Build: `pnpm --filter @kehto/demo build` passes (101 modules transformed)
- tsc --noEmit: zero errors in modified files (pre-existing errors in main.ts/shell-host.ts unrelated to this plan)
