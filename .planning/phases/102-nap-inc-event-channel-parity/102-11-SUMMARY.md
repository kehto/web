---
phase: 102-nap-inc-event-channel-parity
plan: 11
subsystem: playground
tags: [playground, notifications, notify, inc, playwright]
requires:
  - phase: 102-09
    provides: exact opaque INC routing with runtime-attested event senders
  - phase: 102-10
    provides: direct notify service handling without INC compatibility routes
provides:
  - Active playground notification UI uses direct notify.* envelopes and labels.
  - Bot and chat demos no longer emit retired notification INC topics.
  - Browser notification specs reject topic-form and synthetic INC output.
affects: [102-12, active-surface-conformance, playground]
tech-stack:
  added: []
  patterns: [Direct service-domain notification examples, exact opaque INC transport]
key-files:
  created: []
  modified:
    - apps/playground/napplets/bot/src/main.ts
    - apps/playground/napplets/chat/src/main.ts
    - apps/playground/src/flow-animator.ts
    - apps/playground/src/main-notifications.ts
    - tests/e2e/demo-notification-service.spec.ts
    - tests/e2e/notify-lifecycle.spec.ts
key-decisions:
  - Keep bot and chat focused on their INC chat behaviors; do not use INC as a notification-service side channel.
  - Model active notification UI and browser evidence exclusively with direct notify.* envelopes.
patterns-established:
  - Browser notification assertions must reject retired service topic output and synthetic inc.event envelopes.
requirements-completed: [BASE-05, INC-03, INC-04]
coverage:
  - id: D1
    description: Active playground notification paths use direct notify.* labels and service envelopes.
    requirement: BASE-05
    verification:
      - kind: other
        ref: pnpm --filter @kehto/playground build
        status: pass
      - kind: e2e
        ref: pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --workers=1
        status: unknown
    human_judgment: true
    rationale: Browser execution is blocked locally because Chromium is unavailable.
  - id: D2
    description: Bot and chat retain primary demo behavior without retired notification INC side effects.
    requirement: INC-03
    verification:
      - kind: other
        ref: rg retired service INC-prefix scan over active playground sources
        status: pass
    human_judgment: false
  - id: D3
    description: Notification animation and browser specs exclude synthetic INC events.
    requirement: INC-04
    verification:
      - kind: other
        ref: pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --list
        status: pass
      - kind: e2e
        ref: pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --workers=1
        status: unknown
    human_judgment: true
    rationale: Browser execution is blocked locally because Chromium is unavailable.
metrics:
  duration: 4m
  completed: 2026-07-23
status: complete
---

# Phase 102 Plan 11: Playground notification INC retirement Summary

Active playground demos now keep INC as opaque convention transport while notification UI, labels, and browser expectations use direct `notify.*` envelopes only.

## Performance

- **Duration:** 4m
- **Started:** 2026-07-23T18:22:37Z
- **Completed:** 2026-07-23T18:26:10Z
- **Tasks:** 1/1
- **Files modified:** 6

## Accomplishments

- Removed optional notification-topic emissions from bot and chat without altering their chat and rule-storage flows.
- Removed legacy service-prefix classification from the flow animator and changed active UI cues to direct `notify.*` labels.
- Added browser assertions for direct notification lifecycle output, excluding retired service topics and synthetic `inc.event` envelopes.

## NAP Authority Checked

- `napplet/naps` draft PR #89 exact head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, `naps/NAP-INC.md`: INC topics remain exact opaque transport identities and every delivered `inc.event` requires a runtime-attested sender dTag.
- `napplet/naps` draft PR #90 exact head `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `projections/web.md`: convention normalization is a pre-wire binding concern, not a service-prefix route.

The local clones do not contain those draft commits, so their scoped requirements were checked through the phase's pinned authority record and 102-10 summary. This plan is conformant with those scoped requirements: it introduces no senderless event, no service-owned INC prefix, and no runtime routing change.

## Verification

- `pnpm --filter @kehto/playground build` — passed.
- `pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --list` — passed (7 focused browser tests discovered).
- Active-source retired-prefix scan for `audio:`, `notifications:`, and `inc.event` — passed.
- `pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --workers=1` — not run: Chromium is unavailable at `/usr/bin/chromium`.
- `git diff --check` — passed.
- AI-slop gate — not run: the `aislop` executable is unavailable locally and no package was installed.

## Task Commits

1. **Task 1: Migrate active playground notification behavior and tests (RED)** — `afcbc4b` (`test`)
2. **Task 1: Migrate active playground notification behavior and tests (GREEN)** — `07b87cd` (`feat`)

## Files Created/Modified

- `apps/playground/napplets/bot/src/main.ts` — preserves bot chat/rule behavior without notification-topic emissions.
- `apps/playground/napplets/chat/src/main.ts` — preserves message and relay demos without notification-topic emissions.
- `apps/playground/src/flow-animator.ts` — animates notification service traffic only for direct-domain envelopes.
- `apps/playground/src/main-notifications.ts` — renders and logs canonical dotted notification messages.
- `tests/e2e/demo-notification-service.spec.ts` — checks direct notification node controls without compatibility output.
- `tests/e2e/notify-lifecycle.spec.ts` — checks direct toaster lifecycle without synthetic INC output.

## Decisions Made

- Keep direct `notify.*` service examples separate from INC convention transport.
- Retain bot/chat's core INC flows but remove optional host-notification side effects entirely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed one remaining retired toast cue label**
- **Found during:** Task 1 source conformance scan
- **Issue:** `main-notifications.ts` still rendered a retired topic-form toast cue after the main label migration.
- **Fix:** Replaced it with the direct `notify.create` cue.
- **Files modified:** `apps/playground/src/main-notifications.ts`
- **Verification:** Active-source retired-prefix scan passed.
- **Committed in:** `07b87cd`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary completeness correction; no scope expansion.

## Issues Encountered

- Focused Playwright execution cannot launch because Chromium is absent at `/usr/bin/chromium`; no browser or package installation was attempted.
- The configured AI-slop executable is not installed locally; no package installation was attempted.

## Known Stubs

None.

## Next Phase Readiness

- 102-12 can sweep docs independently; active playground sources no longer contain the retired notification-service INC compatibility path.
- Re-run the focused Playwright command in an environment with Chromium before final release verification.

---
*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*

## Self-Check: PASSED

- Confirmed all six modified implementation/test files and the summary exist.
- Confirmed task commits `afcbc4b` and `07b87cd` exist in git history.
