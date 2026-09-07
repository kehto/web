---
status: resolved
trigger: "Resolve kehto/web#267 in a new PR"
created: 2026-09-07
---

# Debug: keys action ownership

## Symptoms and authority

- Two windows registering the same app-local action ID silently replace each other's binding. An unregister from the old owner then deletes the other window's binding. Both document and hostBridge backends reproduce it.
- Checked NAP-KEYS PR #9 at napplet/naps@cecb64257e0ac29926bb746832a477c553ab307c, naps/NAP-KEYS.md before implementation. Complete binding lists are per napplet; unregister carries only actionId; correlation IDs and original action IDs must be preserved. The draft describes duplicate errors but leaves identifier uniqueness scope implicit.
- Bounded policy: identity of a registration is the trusted host window ID plus its app-local action ID. Same-window re-registration preserves existing rebind behavior. Cross-window IDs do not collide. No wire changes or napplet-provided window claims.

## Plan

1. Add failing public-API regressions for both backends: duplicate IDs, cross-window unregister, event routing, independent destroy/reload, same-owner rebind, and collision-resistant composite identities.
2. Key internal action/subscription records by owner and action; keep per-window action indexes and original wire IDs. Replace global index deletion with owner-local deletion, preserving chord parsing, reserved keys, error rollback, and forwarding behavior.
3. Update matching docs and services changeset; review separately and verify build, type-check, full unit tests, docs, lint/static analysis, then browser tests after builds finish.
4. Commit, push, and open a new PR against main. Do not include #266 changes or merge either PR.

## Current focus

- Root cause: registries and host unsubscribe handles use actionId alone; unregister ignores caller windowId.
- Fix: collision-resistant JSON tuple keys for registries and unsubscribe handles, explicit original actionId on entries, and owner-local index deletion. Public types and wire payloads are unchanged.
- Next: push and open the verified independent PR; no merge requested.

## Evidence

- Red: 34 ownership cases across both backends produced 21 failures and 13 passes on the baseline, reproducing cross-window binding loss and teardown/dispatch defects.
- Green: 69 focused tests pass (36 new, 33 existing), including additional failed host-subscription isolation cases.
- Build: 32 tasks passed. Type-check: 17 tasks passed. Unit tests: 1,759 tests across 148 files passed. Docs: strict TypeDoc, VitePress, and all nine public package docs passed.
- Pinned aislop 0.12.0: 100/100, no findings. Root lint command exits successfully but contains no package tasks; the pinned scan supplies actual lint/static analysis. Whitespace check clean.
- The original issue reproduction, with assertions unchanged, passes against the built services package in both document and hostBridge configurations. Each window retains its own binding and first-window unregister leaves the second intact.
- The README Electron adapter now keeps a per-chord callback set. Executed its actual TypeScript example after transpilation with an in-memory globalShortcut stand-in: shared dispatch, scoped unsubscribe, and final native-registration cleanup pass. Real Electron/OS integration was not run.
- Independent read-only review approved the implementation and spec-policy documentation with no blocking findings.
- Full Playwright suite passed 84/84 Chromium tests after all builds completed. NAP-KEYS PR #9 head was rechecked and remains cecb64257e0ac29926bb746832a477c553ab307c. Result: conformant with the explicit Kehto ownership policy for the draft's implicit uniqueness scope.
