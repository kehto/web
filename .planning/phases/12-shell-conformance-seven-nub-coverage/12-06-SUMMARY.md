---
phase: 12-shell-conformance-seven-nub-coverage
plan: 06
subsystem: services,runtime
tags: [media, nub, nip-5d, stub-service, dispatch]
dependency_graph:
  requires:
    - "@napplet/nub-media peer dep (Phase 11 NUB-01)"
    - "Runtime dispatch switch (Phase 12 baseline)"
    - "ServiceHandler interface (@kehto/runtime)"
  provides:
    - "createMediaService factory (@kehto/services)"
    - "MediaServiceOptions type (@kehto/services)"
    - "handleMediaMessage dispatch branch (@kehto/runtime)"
    - "media.session.create.result envelope (runtime + service)"
  affects:
    - "packages/services/src/index.ts barrel (adds media exports)"
    - "packages/runtime/src/runtime.ts dispatch switch (adds case 'media')"
tech-stack:
  added: []
  patterns:
    - "factory-returning-ServiceHandler (mirrors notification-service)"
    - "switch-on-full-message-type (avoids dotIdx prefix-stripping pitfall)"
    - "runtime fallback emits result when no service registered"
key-files:
  created:
    - "packages/services/src/media-service.ts"
    - "packages/services/src/media-service.test.ts"
  modified:
    - "packages/services/src/index.ts"
    - "packages/runtime/src/runtime.ts"
decisions:
  - "Dispatch inside createMediaService switches on the full message.type (e.g. 'media.session.create'), not on the action-suffix — avoids the dotIdx.slice pitfall noted in the plan context."
  - "media-service coexists with legacy audio-service.ts. audio-service continues to track audio:* ifc topics for shell UI; media-service is the canonical @napplet/nub-media NIP-5D envelope path. JSDoc in media-service.ts documents the coexistence."
  - "Runtime fallback emits media.session.create.result even when no media service is registered — guarantees napplets always receive a reply envelope for the one media.* request type that expects one."
  - "Expanded MediaServiceOptions beyond the plan's minimum (onSessionCreate + onState) to also include onSessionDestroy, onSessionUpdate, onCapabilities — zero functional risk, enables host shells to observe the full session lifecycle without rewriting the handler."
metrics:
  duration_minutes: 3
  completed: 2026-04-17
  tasks_completed: 2
  files_touched: 4
  commits: 3
  tests_added: 10
---

# Phase 12 Plan 06: Media NUB Dispatch + Stub Service Summary

Added the `media` NUB domain end-to-end at stub level. Shipped `createMediaService` in `@kehto/services` covering all 5 napplet->shell `media.*` request types from `@napplet/nub-media`, and wired `case 'media':` + `handleMediaMessage` into the runtime dispatch switch so envelopes route through the service registry (with a fallback result emitter when no service is registered). Closes NUB-06, DRIFT-RT-03, and DRIFT-SVC-04.

## What Shipped

### New files

- **`packages/services/src/media-service.ts`** — `createMediaService(options?)` returns a `ServiceHandler` that dispatches on the full `message.type` literal (not the action-suffix). Handlers:
  - `media.session.create` -> emits `media.session.create.result { id, sessionId }` (echoes client-provided sessionId)
  - `media.session.update`, `media.session.destroy`, `media.state`, `media.capabilities` -> fire-and-forget, zero envelopes sent
  - Unknown `media.*` action -> emits `<type>.error { id, error }` so napplets are never left hanging
  - Host callbacks: `onSessionCreate`, `onState`, `onSessionDestroy`, `onSessionUpdate`, `onCapabilities`

- **`packages/services/src/media-service.test.ts`** — 10 vitest cases covering:
  1. Descriptor shape (`name: 'media'`, semver version)
  2. `media.session.create` produces the spec-correct result envelope
  3. `onSessionCreate` callback receives windowId/sessionId/metadata
  4. Four fire-and-forget actions emit zero envelopes
  5. `onState` callback fires for `media.state`
  6. Unknown action produces `<type>.error`
  7. ACL-denied request produces `<type>.error` with the runtime-composed denial shape

### Modified files

- **`packages/services/src/index.ts`** — Added `createMediaService` + `MediaServiceOptions` barrel exports under a "Media Service (NIP-5D media NUB — stub)" section alongside the keys-service block (Plan 12-05 landed concurrently in Wave 2).

- **`packages/runtime/src/runtime.ts`** — Added `handleMediaMessage(windowId, msg)` helper and `case 'media': return handleMediaMessage(windowId, envelope);` branch to the main dispatch switch. Handler delegates to `serviceRegistry['media']` when a service is registered; otherwise falls back to emitting `media.session.create.result` for that single request type (the other four media.* request types are fire-and-forget per spec and silently dropped).

## Runtime Dispatch Change

Before (4-way switch):
```
switch (domain) {
  case 'relay':   return handleRelayMessage(...);
  case 'signer':  return handleSignerMessage(...);  // DRIFT-RT-06 — slated for deletion in Plan 12-03
  case 'storage': return handleStorageMessage(...);
  case 'ifc':     return handleIfcMessage(...);
  default:        return;
}
```

After (5-way switch with media):
```
switch (domain) {
  case 'relay':   return handleRelayMessage(...);
  case 'signer':  return handleSignerMessage(...);  // DRIFT-RT-06 — slated for deletion in Plan 12-03
  case 'media':   return handleMediaMessage(...);   // ← new
  case 'storage': return handleStorageMessage(...);
  case 'ifc':     return handleIfcMessage(...);
  default:        return;
}
```

Other Wave 2 plans (12-03 identity, 12-04 ifc.channel, 12-05 keys, 12-07 notify) will each add their own case in the same switch when they commit — no conflict, the switch is append-only at the case level.

## ACL Gate

The runtime's envelope-level ACL enforcement (`resolveCapabilitiesNub` -> `enforceNub`) sits upstream of `handleMediaMessage`, so `media:control` denial produces a `<type>.error` envelope before the service is invoked. The test harness reproduces the runtime-composed denial shape in `media-service.test.ts` via a small `dispatchWithEnforcer` helper so the ACL-denial contract is tested against the exact envelope shape napplets will see.

`resolveCapabilitiesNub`'s `media:control` branch itself is Plan 12-10's scope (NUB-10 + SPEC-03); this plan exercises only the runtime/service dispatch half.

## Coexistence: audio-service.ts vs media-service.ts

`packages/services/src/audio-service.ts` remains untouched. It operates on `ifc.emit` events whose topic starts with `audio:` (legacy shell-UI audio source registry). `media-service.ts` is the canonical `@napplet/nub-media` NIP-5D envelope path and handles the new `media.*` domain. Both can be registered simultaneously via `runtime.registerService('audio', ...)` and `runtime.registerService('media', ...)`. The media-service JSDoc header documents this coexistence explicitly.

## DRIFT markers

- **DRIFT-RT-03** (dispatch missing `case 'media'`): absence-site marker — audit doc cited `packages/runtime/src/runtime.ts:744-749` as the gap, not a literal source comment. Gap now closed by the new `case 'media':` branch. `grep -n "DRIFT-RT-03" packages/runtime/src/runtime.ts` returns 0 matches.
- **DRIFT-SVC-04** (no `media-service.ts` reference handler): closed by creating `packages/services/src/media-service.ts`. `grep -rE "DRIFT-RT-03|DRIFT-SVC-04" packages/runtime/src packages/services/src` returns 0 matches.
- Audit document annotation (updating `docs/v1.2-NIP-5D-AUDIT.md` rows) is Plan 12-10's scope per the plan's frontmatter.

## Deferred

- **Shell -> napplet push path**: `media.command` (user-triggered control), `media.controls` (shell capability advertisement). Tracked as DRIFT-SHELL-08; lands when the shell per-domain media proxy is built (Plan 12-11 scope).
- **Real MediaSession API backend**: Host apps wire real playback via `runtime.registerService('media', realHandler)`. The stub is the baseline; no wiring to `navigator.mediaSession` in this plan.

## Tests

- `pnpm --filter @kehto/services test` — 79 passed (79 total), including 10 new media-service cases
- `pnpm --filter @kehto/services build` — success
- `pnpm --filter @kehto/runtime build` — success
- `pnpm --filter @kehto/services type-check` — success (no errors)

## Deviations from Plan

None — plan executed as written, with a small expansion:

**1. [Enhancement] Expanded MediaServiceOptions callback surface**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified only `onSessionCreate` and `onState` callbacks; the other three request types (`update`, `destroy`, `capabilities`) had no hook for host shells to observe.
- **Change:** Added `onSessionUpdate`, `onSessionDestroy`, `onCapabilities` callbacks. All optional. Zero functional risk — no behavior change when unset. Lets host shells observe the full session lifecycle without wholesale handler replacement.
- **Files modified:** `packages/services/src/media-service.ts`
- **Commit:** `832e673`

This is additive, backwards-compatible, and keeps the ServiceHandler stub useful for shells that want lightweight session tracking without registering their own implementation.

## Commits

1. `4c4042c` — test(12-06): add failing tests for media NUB service
2. `832e673` — feat(12-06): implement stub media NUB service
3. `28b91ff` — feat(12-06): wire media domain dispatch in runtime

## Self-Check

Verifying claims against disk and git:

- `packages/services/src/media-service.ts` — FOUND
- `packages/services/src/media-service.test.ts` — FOUND
- `packages/services/src/index.ts` — exports createMediaService + MediaServiceOptions (confirmed via grep)
- `packages/runtime/src/runtime.ts` — contains `case 'media':` (1 match) and `handleMediaMessage` (2 matches)
- `DRIFT-RT-03` in `packages/runtime/src/runtime.ts` — 0 matches
- `DRIFT-RT-03|DRIFT-SVC-04` in `packages/runtime/src packages/services/src` — 0 matches
- Commit `4c4042c` — FOUND in git log
- Commit `832e673` — FOUND in git log
- Commit `28b91ff` — FOUND in git log

## Self-Check: PASSED
