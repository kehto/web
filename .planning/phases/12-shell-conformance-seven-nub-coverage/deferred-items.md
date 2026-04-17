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
