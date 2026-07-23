---
phase: 102-nap-inc-event-channel-parity
plan: 10
subsystem: services
tags: [nap-inc, notifications, media, service-routing]
requires:
  - 102-01
provides:
  - Direct-only notification service handling
  - No legacy audio INC compatibility surface
affects:
  - 102-11
  - 102-12
tech_stack:
  added: []
  patterns:
    - Direct service-domain routing
    - Opaque INC topic handling
key_files:
  created:
    - .planning/phases/102-nap-inc-event-channel-parity/102-10-SUMMARY.md
  modified:
    - packages/services/src/notification-service.ts
    - packages/services/src/notification-service.test.ts
    - packages/services/src/notify-service.ts
    - packages/services/src/index.ts
    - packages/services/src/types.ts
    - packages/services/src/media-service.ts
    - packages/services/package.json
  deleted:
    - packages/services/src/audio-service.ts
decisions:
  - Notification services ignore every inc.emit input; only direct notify.* envelopes can trigger service behavior.
  - The legacy audio topic service and its public types are removed; canonical media behavior remains direct-domain based.
metrics:
  duration: 2m 53s
  completed: 2026-07-23
  tasks_completed: 2
  files_changed: 8
status: complete
---

# Phase 102 Plan 10: Retire legacy services INC compatibility Summary

Services now leave opaque INC traffic solely to the INC runtime, retain direct notification handling, and remove the unused legacy audio service surface.

## What Changed

- Replaced INC-prefix notification tests with direct `notify.*` behavior coverage and inert `inc.emit` regression vectors.
- Removed `notifications:*` parsing and senderless fabricated `inc.event` responses from the notification service.
- Removed the legacy `audio:*` service implementation, exports, public aliases, and package metadata; media remains an independent direct-domain service.
- Updated direct-service commentary so it no longer describes INC topic compatibility.

## NAP Authority Checked

- `napplet/naps` draft PR #89 exact head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, `naps/NAP-INC.md`: `inc.emit` has no result, `inc.event` requires runtime-attested sender dTag, and topics are exact opaque identities.
- `napplet/naps` draft PR #90 exact head `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `projections/web.md`: convention normalization occurs before wire delivery; the shell receives stable identity and payload fields.

The resulting services behavior is conformant with those scoped requirements: services do not route INC topics or fabricate senderless events.

## Verification

- `pnpm exec vitest run packages/services/src/notification-service.test.ts` — 11 passed.
- `pnpm --filter @kehto/services type-check` — passed.
- `pnpm --filter @kehto/services build` — passed.
- `git diff --check` — passed.
- Confirmed no active services source retains the audio compatibility export, audio type aliases, or an `inc.event` producer.

The repository's configured AI-slop gate could not run because the `aislop` executable is absent from the installed workspace. Recorded in `.planning/WINDOWS.md` as an open `unrun-verify` item; no dependency was installed.

## Decisions Made

- Keep direct `notify.*` handling isolated from INC transport semantics.
- Remove the legacy audio API rather than replacing it with another convention-topic compatibility layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected strict assertion casts in the new notification regression tests**
- **Found during:** Task 2 verification
- **Issue:** TypeScript rejected assertions that narrowed `NappletMessage` directly to an object with required `id` fields.
- **Fix:** Narrowed through `unknown`, retaining the runtime assertions while satisfying strict type checking.
- **Files modified:** `packages/services/src/notification-service.test.ts`
- **Commit:** `46b424b`

## Self-Check: PASSED

- Confirmed all declared retained service files exist and `packages/services/src/audio-service.ts` is deleted intentionally.
- Confirmed commits `a1c8317`, `e3d8d81`, `46b424b`, and `02d2125` exist in git history.
