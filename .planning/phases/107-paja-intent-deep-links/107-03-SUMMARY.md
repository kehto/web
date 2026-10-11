---
phase: 107-paja-intent-deep-links
plan: "03"
subsystem: paja-host
tags: [paja, nap-intent, nip-5d, browser]
provides:
  - Native Paja incoming-link review and verified launcher dispatch
  - Verified catalog policy for explicit pointers, defaults, recommendations, and chooser selection
affects: [paja-browser-e2e]
key-files:
  modified:
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-intent-links.ts
    - packages/paja/src/browser-runtime-tabs.ts
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/browser-intent-controller.ts
    - packages/paja/src/browser-intent-host.ts
    - packages/paja/src/host-page.ts
    - packages/services/src/intent-service.ts
    - packages/services/src/catalog-intent-resolver.ts
status: complete
---

# Phase 107 Plan 03: Paja host intent workflow Summary

**Paja reviews intent links in a persistent native dialog, launches through the verified ephemeral source, and keeps accepted delivery distinct from terminal completion.**

## Delivered host behavior

- Incoming review has editable URI and JSON payload, compatible-handler selection, default opt-in, target explanation, and Launch/Retry/Choose another/Cancel controls. It remains visible through resolving, accepted, delivered, and failed states.
- Explicit pointers are re-resolved and checked against the exact advertised convention before the launcher is created. Pointer plus an edited URI recommendation is rejected before resolution. Their authorization is scoped to the authenticated launcher window ID, sender identity, and selected opaque catalog ID; concurrent launchers cannot share a grant.
- Recommendations resolve only after Launch; relay hints are retained in the named 35129 pointer, the host verifies publisher/`d` identity and exact convention, asks for an ordinary install/use choice, and never changes defaults implicitly. A verified compatible installed recommendation is reused without fetching or prompting. An applicable stored default or an explicit handler/chooser skips recommendation discovery.
- Incoming links hydrate persisted pointers into verified catalog facts before showing review, without restoring tabs or navigating frames; one stale saved pointer does not block the others.
- The browser controller reports retained acceptance immediately through a source-window-bound host callback. `sourceWindowId` is internal-only context/dispatch metadata: it never reaches `intent.deliver` or an `intent.invoke.result`. Completion is captured per launcher before its frame is torn down, so a removed source cannot cancel delivery or update another review.
- Review Launch has an explicit click listener and symmetric disposal; cancellation, Escape, retry, and concurrent reviews use a generation guard so stale pointer/recommendation work never invokes later. Choose another sends `handler: choose`, bypassing defaults and recommendations; the user can set or clear persisted defaults only through explicit UI actions.
- Verified tabs retain ordinary Copy app link sharing and expose Create intent link only when verified manifest contracts exist; the builder is opened only with that already-verified target.

## Stable browser selectors

- Review: `#paja-intent-link-dialog`, `#paja-intent-link-uri`, `#paja-intent-link-payload`, `#paja-intent-link-handler`, `#paja-intent-link-save-default`, `#paja-intent-link-clear-default`, `#paja-intent-link-status`.
- Actions: `#paja-intent-link-launch`, `#paja-intent-link-retry`, `#paja-intent-link-choose`, `#paja-intent-link-use-handler`, `#paja-intent-link-cancel`.
- Default persistence: localStorage `kehto.paja.intent-defaults.v1`, keyed by intent archetype to opaque catalog ID.

## Verification

- Passed: `pnpm --filter @kehto/paja build`.
- Passed: `pnpm exec vitest run packages/services/src/catalog-intent-resolver.test.ts packages/services/src/manifest-intent-dispatch.test.ts packages/services/src/intent-service.test.ts packages/paja/src/browser-intent-controller.test.ts` — 4 files, 16 tests, including internal source correlation, no second source result, and source-removal completion coverage.
- Passed: `pnpm --filter @kehto/paja type-check`.
- Passed: `git diff --check`.

## Handoff

- Browser E2E remains owned by the parallel browser executor.
- No unresolved assigned production items remain; browser regression execution is the remaining parallel validation.
- This slice is uncommitted by parent instruction.
