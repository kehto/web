# Phase 16: Harness Triage & Playwright Infrastructure - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped)

<domain>
## Phase Boundary

A clean, trustworthy Playwright baseline where every spec reflects the current v1.2 API surface — no legacy specs, no timing pitfalls, and the harness driver exposes all NIP-5D envelope helpers needed by subsequent phases.

This phase is infrastructure-only: tool upgrades, spec deletion, harness driver API extension, test helper creation, Playwright config restructuring, turbo pipeline additions. No user-facing behavior.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use `.planning/research/SUMMARY.md`, `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, and REQUIREMENTS.md (E2E-01..05) to guide decisions.

### Locked Directives (from research + requirements)
- Playwright bump to `^1.54.0` minimum (unlocks `page.consoleMessages()` / `pageErrors()`)
- Delete exactly: `auth-handshake.spec.ts`, `auth.spec.ts`, `signer-delegation.spec.ts`, `acl-matrix-signer.spec.ts`, plus any other spec that references `window.nostr`, `signer-service`, `BusKind`, or kind 29001/29002 injection.
- Extend harness driver with 7 new globals: `__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`. All return structured-clone-safe primitives only (no method references).
- Add `waitForNappletReady(page, frameSelector)` helper + canonical `beforeEach` fixture (`goto('/') → __aclClear__() → __clearLocalStorage__()`). Ban `page.reload()` in ACL-touching specs via a lint rule or documented helper.
- `playwright.config.ts` uses array `webServer` — keep existing harness `:4173`, add demo `:4174`. `turbo.json` gets a `build:napplets` pipeline task so napplet dists are built before Playwright runs.
- Do NOT use `frameLocator` as the sole access path for sandboxed iframes — harness proxy pattern (existing `window.__*` driver globals) is the correct shape.

### Anti-features (hard constraints)
- No new consumers of `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06).
- No `allow-same-origin` on napplet iframe sandbox.
- No CI/CD work.
- No `@napplet/core` as a direct dep on `apps/demo` (risks pnpm dedupe failure).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/e2e/harness/harness.ts` — existing driver-API surface with globals like `__SHELL_READY__`, `__loadNapplet__`, `__TEST_MESSAGES__`, `__aclClear__`, `__clearLocalStorage__`, `__publishEvent__`, `__aclCheck__`. 7 new globals layer alongside these.
- `tests/e2e/acl-enforcement.spec.ts` — canonical `beforeEach` pattern already demonstrates `page.goto('/') → __aclClear__() → __clearLocalStorage__()`. Extract to a shared fixture.
- `tests/e2e/harness/vite.config.ts` — existing `:4173` webServer entry.
- `apps/demo/vite.config.ts` — demo dev server (currently `pnpm dev`); needs a `preview` invocation wired into `pnpm test:serve`-like path for `:4174`.
- `playwright.config.ts` — currently single `webServer`; extend to array.
- `turbo.json` — currently has `build` / `type-check` / `test` tasks; add `build:napplets`.

### Established Patterns
- All `@kehto/*` packages are ESM-only, built with tsup, tested with vitest (unit) + Playwright (e2e).
- pnpm workspace resolves `@napplet/*` via `link:` overrides to `/home/sandwich/Develop/napplet/*`.
- Structured-clone-safe driver globals (return primitives from `page.evaluate`, never live references).

### Integration Points
- New `tests/e2e/helpers/` directory for shared fixtures: `wait-for-napplet-ready.ts`, `acl-beforeEach.ts`, `harness-globals.ts` type definitions.
- `playwright.config.ts` gains a second `webServer` entry for `apps/demo` at `:4174`.
- `turbo.json` gains `build:napplets` as a dependency of `build:demo` (or `test:build` target).

</code_context>

<specifics>
## Specific Ideas

- Keep the Playwright bump minimal — `^1.54.0` only to unlock console APIs; do not chase `^1.55+` unless it exists.
- `waitForNappletReady(page, frameSelector)` should poll for a harness-exposed readiness signal (e.g., a new `__nappletReady__(windowId)` global or the existing `__SHELL_READY__` + a per-napplet assigned flag). Structured-clone-safe return only.
- When deleting legacy specs, include a short commit rationale and note which REQ-ID covers the intended replacement (e.g., `auth.spec.ts` → replaced by `napplet-auth` in Phase 17/18 E2E-07).
- Document in a comment at the top of the new `beforeEach` fixture WHY `page.reload()` is banned (ACL localStorage bleed).

</specifics>

<deferred>
## Deferred Ideas

- Automated ESLint rule enforcing the `page.reload()` ban — doc comment only in v1.3; a real lint rule is a v1.4 concern.
- `@vitest/browser` or `playwright-ct` adoption — explicitly rejected in STACK.md for this milestone.

</deferred>
