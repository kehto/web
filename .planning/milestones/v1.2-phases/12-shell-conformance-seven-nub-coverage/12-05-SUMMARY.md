---
phase: 12-shell-conformance-seven-nub-coverage
plan: 05
subsystem: runtime-nub-dispatch
tags: [nip-5d, nub-keys, keyboard, hotkeys, service-handler, runtime-dispatch, stub]

# Dependency graph
requires:
  - phase: 11-nub-peer-deps-and-type-imports
    provides: "@napplet/nub-keys types resolvable; peer-dep installed"
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: "12-01 shell surface refactor; 12-02 perm: namespace rename"
provides:
  - "createKeysService factory (stub-level, @kehto/services)"
  - "handleKeysMessage runtime dispatch branch (case 'keys':)"
  - "Fallback path so napplets get spec-correct envelopes even when no 'keys' service is registered"
  - "Wire <-> DOM field-name translation (ctrl/alt/shift/meta <-> ctrlKey/altKey/shiftKey/metaKey)"
affects:
  - "12-10 (ACL capabilities + audit closure) — keys:forward / keys:bind capability mapping consumes this wiring"
  - "12-11 (shell per-domain proxies + keys-forwarder) — DRIFT-SHELL-06 shell->napplet push path"
  - "14 (dispatch refactor) — handleKeysMessage registered via registerNub() instead of switch"

# Tech tracking
tech-stack:
  added: ["@napplet/nub-keys (peer-dep already declared; types-only import)"]
  patterns:
    - "Stub-level service: dispatches + responds with spec-correct envelope, defers real backend to host via registerService('keys', realHandler)"
    - "Runtime fallback path: if no service registered, emit spec-correct envelope anyway so napplets never hang waiting for a .result"
    - "Wire<->DOM field translation happens in one place (keys-service.ts + runtime fallback) — host-side HotkeyAdapter contract stays stable"

key-files:
  created:
    - "packages/services/src/keys-service.ts (144 lines)"
    - "packages/services/src/keys-service.test.ts (192 lines; 8 test cases)"
    - ".planning/phases/12-shell-conformance-seven-nub-coverage/deferred-items.md"
  modified:
    - "packages/services/src/index.ts (+3 lines: createKeysService + KeysServiceOptions exports)"
    - "packages/runtime/src/runtime.ts (+81 lines: handleKeysMessage + case 'keys':)"
    - "packages/runtime/src/dispatch.test.ts (+103 lines: keys handler describe block, 4 tests)"
    - ".planning/REQUIREMENTS.md (NUB-05 marked complete)"

key-decisions:
  - "Stub-level: no real keyboard listener, no binding persistence. Host wires real backend via runtime.registerService('keys', …)."
  - "Fallback path emits spec-correct keys.registerAction.result even without a 'keys' service, so napplets always see a reply envelope."
  - "Wire-shape {ctrl,alt,shift,meta} is translated to DOM-shape {ctrlKey,altKey,shiftKey,metaKey} inside the service + runtime fallback so the existing HotkeyAdapter contract does not need to change."
  - "Shell->napplet push envelopes (keys.bindings, keys.action) are NOT emitted by this plan — deferred to DRIFT-SHELL-06 / shell-side keys-forwarder in Plan 12-11 or a future phase. Scope per NUB-05 is napplet->shell direction only."
  - "No DRIFT-RT-02 marker existed in runtime.ts source — the ID was documented only in audit + planning docs; deletion step in Task 2 was a no-op on source but the audit closure lands in Plan 12-10."

patterns-established:
  - "Stub-service factory pattern for NUB-05/06/07 (keys, media, notify): createXService({ onX? }) -> ServiceHandler; dispatch + minimal echo result + fire-and-forget semantics per spec; no host-state persistence."
  - "Runtime fallback-handler pattern: case 'X': -> handleXMessage with (a) service-registry priority, (b) inline spec-correct fallback response so napplets are never left hanging."

requirements-completed: [NUB-05]

# Metrics
duration: 4min
completed: 2026-04-17
---

# Phase 12 Plan 05: keys NUB dispatch + stub keys-service Summary

**Stub keys NUB handler: runtime `case 'keys':` + `createKeysService` forwarding hotkeys to `hooks.hotkeys.executeHotkeyFromForward` and echoing `registerAction` as `.result` envelopes — closes NUB-05 / DRIFT-RT-02 / DRIFT-SVC-03.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T18:57:47Z
- **Completed:** 2026-04-17T19:02:30Z
- **Tasks:** 2 (both TDD — RED + GREEN)
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

- Shipped `packages/services/src/keys-service.ts` (144 lines) — stub handler for 3 napplet->shell keys.* request types:
  - `keys.forward` — fire-and-forget, invokes `options.onForward` with DOM-shape event
  - `keys.registerAction` — emits `keys.registerAction.result { id, actionId, binding? }`
  - `keys.unregisterAction` — fire-and-forget (no envelope)
- Shipped `keys-service.test.ts` (192 lines, 8 tests, all green) covering field-name translation, binding echo, unregister silence, unknown-method error, and ACL-denial envelope shape.
- Wired `handleKeysMessage` + `case 'keys':` into `packages/runtime/src/runtime.ts`. Service-registry path is primary; fallback path covers `keys.forward` (-> `hooks.hotkeys.executeHotkeyFromForward`) and `keys.registerAction` (-> spec-correct `.result` envelope) so napplets never hang even without a registered service.
- Added 4-test `keys handler` describe block in `packages/runtime/src/dispatch.test.ts` covering the service-registry path and all three fallback behaviors.
- Updated `@kehto/services` barrel to export `createKeysService` + `KeysServiceOptions`.

## Task Commits

Each task was committed atomically with --no-verify (parallel Wave 2 execution):

1. **Task 1 — keys-service.ts + tests**
   - `945fc3c` — test(12-05): add failing tests for keys-service (RED)
   - `862d0d7` — feat(12-05): implement keys-service stub (GREEN)
2. **Task 2 — runtime dispatch wiring**
   - `663b665` — test(12-05): add failing tests for keys.* dispatch in runtime (RED)
   - `8651067` — feat(12-05): wire keys domain dispatch in runtime (GREEN)

**Plan metadata:** (final docs commit — see `<final_commit>` section below)

## Files Created/Modified

**Created:**
- `packages/services/src/keys-service.ts` — stub keys NUB service factory (createKeysService + KeysServiceOptions); 3 napplet->shell request types handled; wire->DOM field translation; no real keyboard backend.
- `packages/services/src/keys-service.test.ts` — 8 vitest cases (descriptor shape, forward translation + no-envelope, forward w/o callback, registerAction w/ defaultKey, registerAction w/o defaultKey, unregisterAction silence, unknown keys.* error, ACL-denial envelope shape).
- `.planning/phases/12-shell-conformance-seven-nub-coverage/deferred-items.md` — notes on parallel-executor observations (notify-dispatch.test.ts RED awaiting 12-07 GREEN).

**Modified:**
- `packages/services/src/index.ts` — appended `createKeysService` + `KeysServiceOptions` exports (also grew a media block from the parallel 12-06 executor; non-conflicting).
- `packages/runtime/src/runtime.ts` — added `handleKeysMessage` (serviceRegistry-first; fallback for forward/registerAction/unregisterAction) and `case 'keys':` dispatch branch between `case 'signer':` (still present, staged for deletion in Plan 12-03) and `case 'media':` (from parallel 12-06).
- `packages/runtime/src/dispatch.test.ts` — appended `describe('keys handler', …)` block with 4 tests.
- `.planning/REQUIREMENTS.md` — `NUB-05` checkbox marked `[x]` via `gsd-tools requirements mark-complete`.

## Decisions Made

- **Stub vs. real backend:** Service is intentionally stub-level per NUB-05 scope (plan 12-05 line 53-55 + CONTEXT.md `deferred` section). Real keyboard listener / binding persistence is a host concern wired via `runtime.registerService('keys', realHandler)`.
- **Fallback parity with spec envelopes:** Runtime fallback emits `keys.registerAction.result` even without a registered 'keys' service so napplets never hang on a missing reply. `keys.unregisterAction` stays fire-and-forget per `@napplet/nub-keys` spec.
- **Field-name translation lives in two symmetric places:** `keys-service.ts` (when a service is registered) and the runtime fallback (when none is). Keeps the host-side `HotkeyAdapter` contract (DOM-shape `ctrlKey/altKey/…`) stable.
- **Shell-side push path (keys.bindings, keys.action) explicitly deferred:** Those belong to DRIFT-SHELL-06 and ship with the shell-side keys-forwarder in Plan 12-11 (or a later phase). This plan is napplet->shell direction only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Out-of-date plan note] DRIFT-RT-02 marker did not exist in source**
- **Found during:** Task 2 (grep step before deletion)
- **Issue:** Plan Task 2 step 3 says "DELETE the DRIFT-RT-02 marker comment wherever it appears (grep first)." A fresh `rg "DRIFT-RT-02" packages/runtime/src/runtime.ts` returned 0 matches. The ID is only mentioned in `.planning/ROADMAP.md`, `.planning/phases/12-shell-conformance-seven-nub-coverage/*`, and `docs/v1.2-NIP-5D-AUDIT.md` — none of which this plan owns for deletion (audit closure is Plan 12-10).
- **Fix:** No deletion needed on source. Task 2's grep-based acceptance criterion (`grep -n "DRIFT-RT-02" packages/runtime/src/runtime.ts` returns 0) was satisfied trivially before the task began.
- **Files modified:** none (for this deviation).
- **Verification:** `grep -rE "DRIFT-RT-02|DRIFT-SVC-03" packages/runtime/src packages/services/src` returns 0 matches.
- **Committed in:** n/a (no code change for this item).

---

**Total deviations:** 1 auto-noted (0 rule-1 bugs, 0 rule-2 missing critical, 1 rule-3 clarification, 0 rule-4 architectural)
**Impact on plan:** No code impact. Plan wording was pessimistic; source was already clean.

## Issues Encountered

- **Parallel Wave 2 executors modified shared files (`runtime.ts`, `index.ts`, `dispatch.test.ts`) during 12-05 execution.** Mitigation: re-read files immediately before each edit. Edits inserted net-new content (append pattern: `case 'keys':` between `case 'signer':` and `case 'media':`; new `keys handler` describe block at the bottom of dispatch.test.ts; new barrel-export block below coordinated-relay). No conflicts observed.
- **Pre-existing failing tests from parallel executors:**
  - `packages/runtime/src/dispatch.test.ts > … > identity handler > identity.getFollows returns result with pubkeys: []` (owned by Plan 12-03, awaiting its runtime GREEN wiring).
  - `packages/runtime/src/notify-dispatch.test.ts` — 5 failing tests (owned by Plan 12-07, awaiting its runtime GREEN wiring; the 12-07 notify-service GREEN already landed but dispatch switch entry is still pending).
  - Logged in `deferred-items.md`; out of scope per Rule: SCOPE_BOUNDARY.

## Verification Evidence

- `pnpm --filter @kehto/services build` — clean ESM + DTS (19.83 KB -> 21.52 KB after media-service grew the barrel).
- `pnpm --filter @kehto/runtime build` — clean ESM + DTS.
- `pnpm --filter @kehto/services type-check` — clean.
- `pnpm --filter @kehto/runtime type-check` — clean.
- `pnpm vitest run packages/services/src/keys-service.test.ts` — 8/8 passing.
- `pnpm vitest run packages/runtime/src/dispatch.test.ts -t "keys handler"` — 4/4 passing.
- `grep -n "DRIFT-RT-02" packages/runtime/src/runtime.ts` — 0 matches.
- `grep -n "case 'keys':" packages/runtime/src/runtime.ts` — 1 match.
- `grep -n "handleKeysMessage" packages/runtime/src/runtime.ts` — 2 matches (definition + dispatch switch).
- `grep -n "executeHotkeyFromForward" packages/runtime/src/runtime.ts` — 3 matches (adapter decl + legacy event path + new keys.forward fallback).
- `grep -n "@napplet/nub-keys" packages/services/src/keys-service.ts` — 5 matches.
- `grep -nE "keys\\.forward|keys\\.registerAction|keys\\.unregisterAction" packages/services/src/keys-service.ts` — 8 distinct matches (3 switch cases + supporting references).
- `grep -rE "DRIFT-RT-02|DRIFT-SVC-03" packages/runtime/src packages/services/src` — 0 matches.

## Next Phase Readiness

**Ready:**
- Plan 12-10 (ACL + audit closure): `keys:forward` / `keys:bind` capability entries in `resolveCapabilitiesNub` can now reach a real handler; audit row closure annotations for DRIFT-RT-02 and DRIFT-SVC-03 can land.
- Plan 12-11 (shell per-domain proxies + keys-forwarder): the shell-side half (window keydown listener -> `keys.forward` envelopes; `keys.bindings` / `keys.action` push path) now has a runtime `case 'keys':` to dispatch against.
- Plan 14 (dispatch refactor): `handleKeysMessage` is small + switch-entry-based — clean to register via `registerNub('keys', handleKeysMessage)` when the switch is dissolved.

**Blockers / Concerns:**
- None for 12-05. (Observed failing tests in 12-03 identity + 12-07 notify are owned by their respective parallel Wave 2 executors — see `deferred-items.md`.)

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Plan: 05*
*Completed: 2026-04-17*

## Self-Check: PASSED

All claimed files exist on disk; all 4 task commits (`945fc3c`, `862d0d7`, `663b665`, `8651067`) exist in `git log`.
