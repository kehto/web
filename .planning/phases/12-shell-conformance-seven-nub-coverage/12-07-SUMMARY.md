---
phase: 12-shell-conformance-seven-nub-coverage
plan: 07
subsystem: services,runtime
tags: [notify, nub, nip-5d, stub-service, dispatch]
dependency_graph:
  requires:
    - "@napplet/nub-notify peer dep (Phase 11 NUB-01)"
    - "Runtime dispatch switch (Phase 12 baseline)"
    - "ServiceHandler interface (@kehto/runtime)"
  provides:
    - "createNotifyService factory (@kehto/services)"
    - "NotifyServiceOptions type (@kehto/services)"
    - "handleNotifyMessage dispatch branch (@kehto/runtime)"
    - "notify.send.result + notify.permission.result envelopes (runtime + service)"
  affects:
    - "packages/services/src/index.ts barrel (adds notify exports)"
    - "packages/runtime/src/runtime.ts dispatch switch (adds case 'notify')"
tech-stack:
  added: []
  patterns:
    - "factory-returning-ServiceHandler (mirrors audio/media/keys services)"
    - "switch-on-full-message-type (e.g. 'notify.send' not 'send')"
    - "runtime fallback emits result when no service registered"
    - "explicit coexistence with legacy ifc-emit notification-service.ts"
key-files:
  created:
    - "packages/services/src/notify-service.ts"
    - "packages/services/src/notify-service.test.ts"
    - "packages/runtime/src/notify-dispatch.test.ts"
  modified:
    - "packages/services/src/index.ts"
    - "packages/runtime/src/runtime.ts"
    - ".planning/REQUIREMENTS.md"
decisions:
  - "notify-service.ts is a NEW file — legacy notification-service.ts (ifc-emit topic path, operates on notifications:* topics) is left untouched. Both can be registered simultaneously under different service names ('notify' vs 'notifications'). JSDoc header on notify-service.ts documents the coexistence explicitly."
  - "Dispatch switches on the full message.type literal (e.g. 'notify.send') rather than an action-suffix slice, matching the media-service pattern established in Plan 12-06 and avoiding the dotIdx prefix-stripping pitfall."
  - "Runtime fallback path emits notify.send.result + notify.permission.result even when no 'notify' service is registered — the two notify.* request types that expect a reply always produce one. dismiss/badge/channel.register are fire-and-forget per @napplet/nub-notify and silently dropped on the fallback path."
  - "Shell -> napplet push types (notify.action, notify.clicked, notify.dismissed, notify.controls) are explicitly NOT emitted by this stub — deferred to a future plan owned by the shell per-domain proxy work (Plan 12-11 or later)."
  - "defaultGrant option starts at true for the stub so napplets observe permission granted by default; host apps plug real permission prompts via runtime.registerService('notify', realHandler) or by constructing the stub with defaultGrant:false."
metrics:
  duration_minutes: 5
  completed: 2026-04-17
  tasks_completed: 2
  files_touched: 6
  commits: 4
  tests_added: 18
---

# Phase 12 Plan 07: Notify NUB Dispatch + Stub Service Summary

Added the `notify` NUB domain end-to-end at stub level. Shipped `createNotifyService` in `@kehto/services` covering all 5 napplet->shell `notify.*` request types from `@napplet/nub-notify`, and wired `case 'notify':` + `handleNotifyMessage` into the runtime dispatch switch so envelopes route through the service registry (with a fallback emitter for `notify.send.result` and `notify.permission.result` when no service is registered). Closes NUB-07, DRIFT-RT-04, and DRIFT-SVC-05 (source-side).

## What Shipped

### New files

- **`packages/services/src/notify-service.ts`** — `createNotifyService(options?)` returns a `ServiceHandler` that dispatches on the full `message.type` literal. Handlers:
  - `notify.send` -> emits `notify.send.result { id, notificationId }` (shell-assigned id via `options.generateId` or a `shell-<n>` counter)
  - `notify.dismiss`, `notify.badge`, `notify.channel.register` -> fire-and-forget, zero envelopes sent
  - `notify.permission.request` -> emits `notify.permission.result { id, granted }` (granted defaults to `true`, overridable via `options.defaultGrant`)
  - Unknown `notify.*` action -> emits `<type>.error { id, error }`
  - Host callback: `onSend(windowId, msg)` fired synchronously for notify.send

- **`packages/services/src/notify-service.test.ts`** — 12 vitest cases covering:
  1. Descriptor shape (`name: 'notify'`, semver version)
  2. `notify.send` produces the spec-correct result envelope with a non-empty notificationId
  3. `options.generateId` overrides the default counter
  4. `options.onSend` receives windowId + payload
  5. Three fire-and-forget actions (`dismiss`, `badge`, `channel.register`) emit zero envelopes
  6. `notify.permission.request` produces result with `granted:true` by default
  7. `notify.permission.request` honors `defaultGrant:false`
  8. Unknown `notify.*` action produces `<type>.error`
  9. ACL-denied request produces `<type>.error` with the runtime-composed denial shape and the service is never invoked
  10. `onWindowDestroyed` is a no-op (does not throw)

- **`packages/runtime/src/notify-dispatch.test.ts`** — 6 vitest cases covering:
  1. Registered `notify` service receives `notify.send` envelopes
  2. Registered `notify` service receives `notify.permission.request` envelopes
  3. Registered `notify` service receives fire-and-forget `notify.dismiss` with no runtime-composed reply
  4. Fallback (no service): `notify.send` -> runtime emits `notify.send.result` so napplets see a reply
  5. Fallback: `notify.permission.request` -> runtime emits `notify.permission.result { granted: true }`
  6. Fallback: `notify.dismiss` / `notify.badge` / `notify.channel.register` emit zero envelopes

### Modified files

- **`packages/services/src/index.ts`** — Added `createNotifyService` + `NotifyServiceOptions` barrel exports under a "Notify Service (NIP-5D notify NUB — stub)" section, with a cross-reference comment noting coexistence with `createNotificationService` above (legacy ifc-emit path).

- **`packages/runtime/src/runtime.ts`** — Added `handleNotifyMessage(windowId, msg)` helper and `case 'notify': return handleNotifyMessage(windowId, envelope);` branch to the main dispatch switch. Handler delegates to `serviceRegistry['notify']` when a service is registered; otherwise falls back to emitting `notify.send.result` (with `shell-${Date.now()}` notificationId) or `notify.permission.result` (`granted: true`). The other three `notify.*` request types are fire-and-forget per spec and silently dropped on the fallback path.

- **`.planning/REQUIREMENTS.md`** — Marked NUB-07 checkbox as complete and filled its traceability-table row with `12 (Plan 12-07)`.

## Runtime Dispatch Change

The Wave 2 parallel plans all append `case '<domain>':` branches into the same switch. After 12-07 landed, the switch reads (the 12-03 identity case and the 12-05/06 keys/media cases were committed concurrently by their own executors):

```
switch (domain) {
  case 'relay':   return handleRelayMessage(...);
  case 'signer':  return handleSignerMessage(...);  // DRIFT-RT-06 — still present; deletion is Plan 12-03's scope
  case 'keys':    return handleKeysMessage(...);    // Plan 12-05
  case 'media':   return handleMediaMessage(...);   // Plan 12-06
  case 'notify':  return handleNotifyMessage(...);  // ← this plan
  case 'storage': return handleStorageMessage(...);
  case 'ifc':     return handleIfcMessage(...);
  default:        return;
}
```

## ACL Gate

The runtime's envelope-level ACL enforcement (`resolveCapabilitiesNub` -> `enforceNub`) sits upstream of `handleNotifyMessage`, so `notify:send` / `notify:channel` denial produces a `<type>.error` envelope before the service is invoked. The test harness reproduces the runtime-composed denial shape in `notify-service.test.ts` via an in-test enforcer stub, asserting both the envelope shape and that the service is never invoked on denial.

`resolveCapabilitiesNub`'s notify branch itself is Plan 12-10's scope (NUB-10 + SPEC-03). Today `notify.*` envelopes reach `handleNotifyMessage` without ACL enforcement because `resolveCapabilitiesNub` does not yet recognize the notify domain; this plan exercises only the runtime/service dispatch half, not the ACL mapping.

## Coexistence: notification-service.ts vs notify-service.ts

`packages/services/src/notification-service.ts` remains untouched. It operates on `ifc.emit` events whose topic starts with `notifications:` (legacy shell-UI notification state registry). `notify-service.ts` is the canonical `@napplet/nub-notify` NIP-5D envelope path and handles the new `notify.*` domain. Both can be registered simultaneously:

```ts
runtime.registerService('notifications', createNotificationService(opts)); // legacy ifc-emit
runtime.registerService('notify',        createNotifyService(opts));       // NIP-5D nub
```

The notify-service JSDoc header documents this coexistence explicitly so future contributors don't accidentally rename/delete one thinking it supersedes the other.

## DRIFT markers

- **DRIFT-RT-04** (dispatch missing `case 'notify'`): an absence-site marker — the audit doc (`docs/v1.2-NIP-5D-AUDIT.md`) cited the gap at `packages/runtime/src/runtime.ts:744-749` without a literal source comment. Gap now closed by the new `case 'notify':` branch. `grep -n "DRIFT-RT-04" packages/runtime/src/runtime.ts` returns 0 matches (and always has).
- **DRIFT-SVC-05** (no `notify-service.ts` reference handler): closed by creating `packages/services/src/notify-service.ts`. `grep -rE "DRIFT-RT-04|DRIFT-SVC-05" packages/runtime/src packages/services/src` returns 0 matches.
- Audit document annotation (updating `docs/v1.2-NIP-5D-AUDIT.md` rows) is Plan 12-10's scope per the plan's frontmatter.

## Deferred

- **Shell -> napplet push path**: `notify.action` (user clicked an action button), `notify.clicked` (user clicked the notification body), `notify.dismissed` (shell- or user-initiated dismissal), `notify.controls` (shell capability advertisement). Tracked alongside the shell per-domain notify-proxy work (Plan 12-11 or later).
- **Real Notification API backend**: Host apps wire real notifications via `runtime.registerService('notify', realHandler)`. The stub is the baseline; no wiring to `Notification` / service workers / OS notification channels in this plan.
- **Real permission prompt**: The stub returns `granted: true` (or the `defaultGrant` option) deterministically. A real permission-prompt UX is the host shell's responsibility.

## Tests

- `pnpm exec vitest run packages/services/src/notify-service.test.ts packages/runtime/src/notify-dispatch.test.ts` — 18 passed (18 total)
- `pnpm --filter @kehto/services build` — success
- `pnpm --filter @kehto/runtime build` — success
- `pnpm --filter @kehto/services type-check` — success
- `pnpm --filter @kehto/runtime type-check` — success

## Deviations from Plan

**1. [Parallel-wave artifact] Task 2 commit `ceed933` inadvertently contained signer-service deletions instead of runtime.ts changes**
- **Found during:** Task 2 commit
- **Issue:** Plan 12-07 runs in Wave 2 in parallel with Plans 12-03/04/05/06. My runtime.ts edits (adding `handleNotifyMessage` + `case 'notify':`) were staged at T0, but another Wave 2 executor (Plan 12-05) also ran `git add packages/runtime/src/runtime.ts` just before my commit — producing a race where my runtime.ts diff went into commit `8651067` (12-05's keys dispatch commit, which co-staged both files) and my own commit `ceed933` ended up capturing the signer-service file deletions that were staged by Plan 12-03's concurrent work.
- **Fix:** None required — all the intended content landed in git and is functionally correct. The signer-service deletions are legitimate Plan 12-03 work and were staged appropriately. The commit labels are slightly mis-attributed but no work was lost or duplicated. Left as-is per project rules forbidding destructive git operations (no `--amend`, no history rewrite).
- **Files affected:** `packages/runtime/src/runtime.ts` (content in 8651067), `packages/services/src/signer-service.{ts,test.ts}` (deletions in ceed933)
- **Commits:** `8651067` (carries my runtime changes alongside 12-05's), `ceed933` (carries 12-03's signer-service deletions under a 12-07 label)

This is a known hazard of Wave 2 parallel execution against a single source file (runtime.ts). No code correctness impact; noted here for audit transparency.

## Commits

1. `92b2527` — test(12-07): add failing test for notify-service NUB dispatch (RED)
2. `d6750f7` — feat(12-07): implement notify-service + barrel export (GREEN)
3. `ee2599d` — test(12-07): add failing test for notify.* runtime dispatch (RED)
4. `ceed933` — feat(12-07): wire case 'notify' dispatch + handleNotifyMessage (GREEN) *(commit diff captured unrelated signer-service deletions due to parallel wave race — see Deviations)*

Plus `8651067` (a 12-05-labeled commit) also contains this plan's runtime.ts changes due to a concurrent `git add` race. All intended content is in git.

## Self-Check

Verifying claims against disk and git:

- `packages/services/src/notify-service.ts` — FOUND
- `packages/services/src/notify-service.test.ts` — FOUND
- `packages/runtime/src/notify-dispatch.test.ts` — FOUND
- `packages/services/src/index.ts` exports `createNotifyService` + `NotifyServiceOptions` — CONFIRMED via grep
- `packages/runtime/src/runtime.ts` contains `case 'notify':` (1 match) and `handleNotifyMessage` (2 matches)
- `DRIFT-RT-04` in `packages/runtime/src/runtime.ts` — 0 matches
- `DRIFT-RT-04|DRIFT-SVC-05` in `packages/runtime/src packages/services/src` — 0 matches
- `notification-service.ts` unchanged (`git diff packages/services/src/notification-service.ts` produces no output)
- Commit `92b2527` — FOUND in git log
- Commit `d6750f7` — FOUND in git log
- Commit `ee2599d` — FOUND in git log
- Commit `ceed933` — FOUND in git log
- NUB-07 marked complete in REQUIREMENTS.md — CONFIRMED
