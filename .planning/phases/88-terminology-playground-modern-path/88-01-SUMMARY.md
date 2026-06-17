---
phase: 88-terminology-playground-modern-path
plan: 01
subsystem: playground
tags: [napplet, inc, ifc, naps, nubs, shim, vite-plugin, terminology, migration]

# Dependency graph
requires:
  - phase: 85-content-addressed-loading
    provides: srcdoc content-addressed napplet loading + playground single-file artifact pipeline
  - phase: 87-archetype-injection
    provides: playground manual archetype-tag injection in recomputeManifest (vite-plugin does not emit archetype tags)
provides:
  - All 9 playground napplet sources import @napplet/nap/* (no @napplet/nub/* specifiers)
  - bot/chat/feed/profile-viewer migrated ifc→inc (incEmit/incOn, requires:['inc'], inc:NAP-01)
  - shim 0.13 natively owns shell.supports() from capabilities.{domains,protocols}; redundant nubs-reading override removed
  - getMissingRequiredNaps resolves against capabilities.naps (nubs fallback)
  - debugger classifies inc.* envelopes to the inter-napplet audit path
  - 6 nub-* test fixtures migrated to @napplet/nap/* import prefix (directory names unchanged)
affects: [88-02 inc-roundtrip e2e, 88-02 naps-path conformance e2e, 89 NIP-5D spec rewrite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-arg supports(domain, protocol) for numbered NAP protocol checks (shim 0.13 makeSupports signature)"
    - "Shim-owned capability resolution: napplet bootstrap no longer overrides shell.supports"

key-files:
  created:
    - .planning/phases/88-terminology-playground-modern-path/88-01-SUMMARY.md
  modified:
    - apps/playground/napplets/bot/src/main.ts
    - apps/playground/napplets/bot/vite.config.ts
    - apps/playground/napplets/chat/src/main.ts
    - apps/playground/napplets/chat/vite.config.ts
    - apps/playground/napplets/feed/src/main.ts
    - apps/playground/napplets/feed/src/feed-store.ts
    - apps/playground/napplets/feed/vite.config.ts
    - apps/playground/napplets/profile-viewer/src/main.ts
    - apps/playground/napplets/profile-viewer/vite.config.ts
    - apps/playground/napplets/composer/src/main.ts
    - apps/playground/napplets/preferences/src/main.ts
    - apps/playground/napplets/toaster/src/main.ts
    - apps/playground/napplets/shared-vite-config.ts
    - apps/playground/src/demo-hooks.ts
    - apps/playground/src/debugger.ts
    - tests/fixtures/napplets/nub-ifc/src/main.ts
    - tests/fixtures/napplets/nub-identity/src/main.ts
    - tests/fixtures/napplets/nub-notify/src/main.ts
    - tests/fixtures/napplets/nub-relay/src/main.ts
    - tests/fixtures/napplets/nub-storage/src/main.ts
    - tests/fixtures/napplets/nub-theme/src/main.ts

key-decisions:
  - "Installed shim is 0.13 (not the 0.12 the plan assumed); makeSupports reads capabilities.{domains,protocols} via supports(domain, protocol?), NOT a colon-joined 'inc:NAP-01' string. Migrated the protocol checks to the two-arg form supports('inc','NAP-01')."
  - "Vite-plugin stays pinned at 0.4.0 (last inline-compatible); archetype tags are still injected manually in recomputeManifest (Phase 87) — confirmed working in the built profile-viewer manifest."
  - "Both the bootstrap and shim 0.13 post shell.ready; left both (idempotent per SHELL-01)."

patterns-established:
  - "Numbered NAP protocol capability checks use supports('inc', 'NAP-01') two-arg form under shim 0.13/core 0.12"
  - "Playground napplet bootstrap is bootstrap-marker + handshake-nudge only; the real shim owns shell.supports"

# Metrics
duration: 18min
completed: 2026-06-17
---

# Phase 88 Plan 01: Migrate Playground + Fixtures onto @napplet/nap (inc/naps) Summary

**Migrated all 9 playground napplets and 6 nub-* test fixtures from the legacy `@napplet/nub/*` surface to the released `@napplet/nap/*` surface, switched the four inter-napplet-comms napplets to the `inc.*` wire, and let shim 0.13 natively own `shell.supports()` from the conformant `domains`/`protocols` capabilities — all 24 build targets and 13 type-check targets green.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 (Task 1 migration, Task 2 host/bootstrap, Task 3 build gate) + Part B fixtures
- **Files modified:** 21 (15 playground + 6 fixtures)

## Accomplishments
- Zero `@napplet/nub` import specifiers remain in `apps/playground` and `tests/fixtures` (doc-comment mentions only).
- bot/chat/feed/profile-viewer use `incEmit`/`incOn` from `@napplet/nap/inc/sdk`, `requires:['inc',...]`, and `inc:NAP-01`.
- The redundant nubs-reading `supports()` override (plus `patchNapplet` / `Object.defineProperty(window,'napplet')` machinery) was removed from the hosted-shell bootstrap; the real shim 0.13 now sets `shell.supports` from `capabilities.{domains,protocols}` on `shell.init`. The bootstrap still sets `__kehtoHostedShellBootstrap` and posts `shell.ready`.
- `getMissingRequiredNaps` resolves against `capabilities.naps` (nubs fallback); `debugger.ts` classifies `inc.*` to the existing `ifc-send`/`ifc-receive` audit path.
- `pnpm build` (24/24) and `pnpm type-check` (13/13) both green; 9 napplet single-file artifacts + 6 fixture artifacts produced, each napplet artifact carrying the bootstrap marker with zero leftover external assets.

## Task Commits

1. **Task 1: migrate napplet imports + ifc→inc** - `04e6d2a` (refactor)
2. **Task 2: shim owns supports(); host reads naps + classifies inc** - `1aa007b` (refactor)
3. **Part B: migrate nub-* fixture imports** - `3bc1cea` (refactor)

(Task 3 was the build/type-check gate — no source edits required beyond Tasks 1–2; the migration built cleanly with no helper-name drift.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two-arg supports() for numbered protocol checks (shim 0.13 vs plan's assumed 0.12)**
- **Found during:** Task 1 (feed + profile-viewer protocol checks)
- **Issue:** The plan/CONTEXT assumed the installed shim was 0.12 and that `supports('inc:NAP-01')` (single colon-joined arg) reading `capabilities.naps` would resolve true. The **actually installed shim is 0.13**, whose `makeSupports(env)` reads `env.capabilities.{domains,protocols}` and exposes `supports(domain, protocol?)`. A single `'inc:NAP-01'` arg checks `domains.has('inc:NAP-01')` → always false at runtime. The core 0.12 `NamespacedCapability` type is a literal union (`NapDomain | nap:${NapDomain} | perm:${string}`) that does not include `'inc:NAP-01'`. (Type-check would not have caught this because `window.napplet` is untyped `any` in the napplet build scope, but runtime would silently report the protocol as unsupported.)
- **Fix:** Migrated `feed/src/main.ts` and `profile-viewer/src/main.ts` from `REQUIRED_IFC_PROTOCOL='ifc:NAP-01'` + `supports(REQUIRED_IFC_PROTOCOL)` to `REQUIRED_INC_PROTOCOL='NAP-01'` + `supports('inc', REQUIRED_INC_PROTOCOL)` (two-arg). The user-facing missing-capability label stays `inc:NAP-01`.
- **Files modified:** apps/playground/napplets/feed/src/main.ts, apps/playground/napplets/profile-viewer/src/main.ts
- **Commit:** `04e6d2a`
- **Note:** The @kehto shell already emits the conformant `domains`/`protocols` superset alongside `naps`/`nubs` (packages/shell/src/shell-init.ts), so the two-arg form resolves correctly against the live shell. The shell was NOT modified (TERM-05 guard honored).

The plan's other version assumptions (nap@0.11/vite-plugin@0.7) also differed from the installed nap@0.12/vite-plugin@0.4.0, but those were no-ops for this migration: the `inc/sdk` surface and the manual archetype injection both work identically under the installed versions.

## Supports() bootstrap removal

Clean. The shim 0.13 `index.js` auto-posts `shell.ready` on load and, on `shell.init`, sets `window.napplet.shell.supports = makeSupports(env)` from `capabilities.{domains,protocols}` (verified in installed dist). The hand-rolled override was a divergent code path that read the legacy `nubs` array and clobbered the shim's resolver — removing it is a correctness improvement, not a control change. The built `chat/dist/index.html` confirms `patchNapplet`/`fallbackSupports` no longer appear; the `__kehtoHostedShellBootstrap` marker is still injected (verified in all 9 napplet artifacts).

## Verification

- `rg "@napplet/nub" apps/playground tests/fixtures -g '!**/dist/**'` (import specifiers): **ZERO** — only doc-comment/README/CHANGELOG mentions remain.
- `pnpm type-check`: **13/13 green**.
- `pnpm build`: **24/24 green**. Pre-existing chunk-size + dynamic-import advisories and the benign `@kehto/wm#build` turbo outputs warning are unrelated to this migration (out of scope).
- Artifacts: 9 playground napplet single-file `dist/index.html` (each with bootstrap marker, zero external assets) + 6 fixture `dist/index.html`.
- profile-viewer manifest retains `['archetype','profile','NAP-1']` + path/aggregate tags (Phase 87 injection still runs under vite-plugin 0.4.0).
- feed artifact references `napplet.inc` (inc wire installed).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface introduced. Wire-shape change (ifc→inc) only; ACL semantics unchanged (runtime dual-routes inc/ifc).

## Self-Check: PASSED

- SUMMARY.md present.
- Commits `04e6d2a`, `1aa007b`, `3bc1cea` all present in git history.
