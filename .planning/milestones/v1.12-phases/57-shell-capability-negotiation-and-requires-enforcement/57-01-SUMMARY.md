# Phase 57 Plan 01 Summary

**Completed:** 2026-05-22
**Plan:** `57-01-PLAN.md`
**Status:** Complete

## Result

Phase 57 made the playground shell the hosted source of truth for NIP-5D/NUB
capabilities and wired manifest `requires` tags into the gateway load path.

## Changes

- `packages/shell/src/shell-init.ts` now advertises the hosted Kehto NUB set
  from shell policy, including the classified `connect` and `class` extensions
  and excluding out-of-scope `nostrdb`.
- `napplet/packages/shim/src/index.ts` sends `shell.ready`, consumes
  `shell.init`, and replaces hosted `window.napplet.shell.supports()` with
  shell-provided capability state while retaining the static fallback for
  shell-less preview/test contexts.
- `apps/playground/vite.config.ts` exposes manifest `requires` tags in gateway
  metadata.
- `apps/playground/src/shell-host.ts` builds shell capabilities during boot and
  rejects unsupported manifest requirements before assigning `iframe.src`.
- `apps/playground/napplets/shared-vite-config.ts` accepts validated short-name
  `requires` declarations for Phase 58 napplet manifests.
- Unit guards now cover hosted capability inventory, `nub:`/`perm:` lookup
  semantics, gateway metadata `requires`, and pre-navigation checks.

## Requirement Status

- Completed: SUPPORTS-01, SUPPORTS-02, SUPPORTS-03, SUPPORTS-04.
- Completed: REQUIRES-01, REQUIRES-04, REQUIRES-05.
- Completed: EXT-02, EXT-03.

## Deferred

- Adding `requires` declarations to all 13 playground napplets remains Phase 58.
- Built artifact coverage and E2E proof remain Phase 59.
