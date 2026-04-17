# Deferred Items — Phase 12

Items encountered during plan execution that are outside the current plan's scope.

## 12-05 keys nub (this plan) — Wave 2 parallel executor issues noticed

**Observed during 12-05 execution.**

### notify-dispatch.test.ts has failing RED tests

- **File:** `packages/runtime/src/notify-dispatch.test.ts`
- **Owner plan:** 12-07 (notify nub dispatch)
- **Symptom:** 5 failing tests asserting `notify.send.result`, `notify.dismiss`, and `notify.permission.result` envelope behavior in runtime dispatch.
- **Cause:** Parallel Wave 2 executor for plan 12-07 committed the RED test (commit `ee2599d`) but the GREEN wiring into `runtime.ts` has not yet landed at the time of 12-05 execution. Service-side GREEN (commit `d6750f7`) already exists under `packages/services/src/notify-service.ts`.
- **Scope note:** Out of scope for 12-05 (keys nub). The 12-07 executor will add `case 'notify':` + `handleNotifyMessage` to `runtime.ts` to close its own RED.
- **Action taken:** None. 12-05's own keys tests + build pass clean.

## 12-05 keys nub — runtime.ts concurrent edit

The `handleKeysMessage` function was appended after `handleMediaMessage` (which the parallel 12-06 executor added). The dispatch switch `case 'keys':` was inserted between `case 'media':` and `case 'storage':` — no conflict with concurrent edits observed.

## 12-03 identity nub — demo topology UI still references 'signer'

- **Files:** `apps/demo/src/node-details.ts:423`, `apps/demo/src/topology.ts:472`, `apps/demo/src/flow-animator.ts:52-137`, `apps/demo/src/main.ts:274`
- **Symptom:** Several demo-UI code paths look up the `'signer'` service node for flow-animation highlighting and topology rendering. After plan 12-03 the demo's `bootShell()` now registers the `'identity'` service instead (not `'signer'`), so the UI highlights a non-existent topology node when animating identity requests.
- **Scope note:** `apps/demo/` is a demo app (not a `packages/*` source), so this is out-of-scope for the NUB-03 contract the plan satisfies. The demo already builds clean after the `createSignerService -> createIdentityService` swap in `shell-host.ts`.
- **Action taken:** None beyond the minimal demo fix (shell-host.ts now registers `identity`). Renaming the UI node constants and flow-matcher strings is a demo-UX follow-up; a later plan can sweep these in one pass.
