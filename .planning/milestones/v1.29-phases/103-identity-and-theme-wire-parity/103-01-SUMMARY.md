---
phase: 103
plan: 01
subsystem: runtime
tags: [nap-identity, nap-theme, acl, firewall, dispatch]
requires: []
provides:
  - canonical runtime-owned identity/theme result shaping
  - safe identity/theme denial and unavailable-service behavior
affects: [103-02, 103-03, 103-04, 103-05, 103-06]
tech-stack:
  added: []
  patterns: [exact request allowlist, canonical same-domain fallback]
key-files:
  created: [packages/runtime/src/domain-results.ts]
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/domain-handlers.ts
    - packages/runtime/src/identity-handler.ts
    - packages/runtime/src/dispatch.test.ts
decisions:
  - Denied or unavailable theme.get uses a complete non-sensitive normal result without an error field.
  - Unsupported identity/theme inbound messages are ignored before ACL/firewall generic error shaping.
metrics:
  duration: 7m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 01: Runtime Canonical Identity and Theme Results Summary

**Runtime dispatch now preserves correlation IDs while emitting only sanctioned identity/theme result shapes, including one complete fixed theme fallback for denied and unavailable reads.**

## Accomplishments

- Added a dependency-free runtime result factory for the sanctioned `identity.getPublicKey`, `identity.getRelays`, `identity.getProfile`, `identity.getFollows`, and `theme.get` requests.
- Routed ACL and firewall denial paths through the factory before generic error shaping, preserving unrelated-domain behavior.
- Made runtime identity fallbacks return safe results for absent or rejected signer calls; `getPublicKey` always returns an empty-string sentinel on failure.
- Silenced unsupported identity/theme actions, source-sent changes/results, and theme subscription attempts before handler, ACL, or firewall response paths.
- Added exact-envelope and cardinality coverage for signer failure, unavailable reads, theme denials, and unknown actions.

## Verification

- `pnpm exec vitest run packages/runtime/src/dispatch.test.ts` — 95 passed.
- `pnpm --filter @kehto/runtime type-check` — passed.
- `git diff --check` — passed.
- Package and lockfile diff check — no changes.
- `pnpm exec aislop --help` — not run as a quality gate: the local workspace has no `aislop` executable.

## Authority Check

Checked draft NAP-IDENTITY and NAP-THEME at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f` before implementation. The result is conformant for identity’s empty-public-key sentinel and sanctioned result types. The complete error-free theme fallback is the Phase 103 Kehto policy reconciliation: it uses `theme.get.result` without inventing a mixed `theme` + `error` extension permitted neither by the active contract examples nor the project requirements.

## Decisions Made

- Use an exact allowlist at the runtime ingress boundary so unsupported identity/theme source messages cannot trigger generic `.error` envelopes.
- Use the fixed non-sensitive theme default for denied/unavailable reads; runtime remains independent from `@kehto/services` to avoid a dependency cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected strict envelope casts after the expanded test matrix exposed `NappletMessage` union incompatibility.**
- **Found during:** Task 2 verification.
- **Fix:** Narrowed intentional structural envelope casts through `unknown` without changing wire data.
- **Files modified:** `packages/runtime/src/domain-results.ts`, `packages/runtime/src/dispatch.test.ts`.
- **Commit:** `e10b4b6`.

## Known Stubs

None. The empty relay/profile/follow values are NAP-safe runtime fallback values, not UI-facing placeholders.

## Deferred Issues

- The project AI-slop gate could not run because the `aislop` executable is not installed in this workspace.

## Self-Check: PASSED

- Required runtime files exist and task commits `2089fde` and `e10b4b6` are present.
