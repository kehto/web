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
    - packages/paja/src/host-page.ts
status: complete
---

# Phase 107 Plan 03: Paja host intent workflow Summary

**Paja reviews intent links in a persistent native dialog, launches through the verified ephemeral source, and keeps accepted delivery distinct from terminal completion.**

## Delivered host behavior

- Incoming review has editable URI and JSON payload, compatible-handler selection, default opt-in, target explanation, and Launch/Retry/Choose another/Cancel controls. It remains visible through resolving, accepted, delivered, and failed states.
- Explicit pointers are re-resolved and checked against the exact advertised convention before the launcher is created. Their authorization is scoped to the authenticated launcher catalog sender and selected opaque catalog ID.
- Recommendations resolve only after Launch; the host verifies named kind 35129 publisher/`d` identity and exact convention, asks for an ordinary install/use choice, and never changes defaults implicitly. An applicable stored default or an explicit handler/chooser skips recommendation discovery.
- Incoming links hydrate persisted pointers into verified catalog facts before showing review, without restoring tabs or navigating frames; one stale saved pointer does not block the others.
- The browser controller reports delivered/terminal completion through host review progress without adding a second canonical source result. Launcher teardown remains independent of retained target work.
- Review Launch has an explicit click listener and symmetric disposal; the regression proves it invokes host launch work and exposes Accepted progress.
- Verified tabs retain ordinary Copy app link sharing and expose Create intent link only when verified manifest contracts exist; the builder is opened only with that already-verified target.

## Stable browser selectors

- Review: `#paja-intent-link-dialog`, `#paja-intent-link-uri`, `#paja-intent-link-payload`, `#paja-intent-link-handler`, `#paja-intent-link-save-default`, `#paja-intent-link-status`.
- Actions: `#paja-intent-link-launch`, `#paja-intent-link-retry`, `#paja-intent-link-choose`, `#paja-intent-link-use-handler`, `#paja-intent-link-cancel`.
- Default persistence: localStorage `kehto.paja.intent-defaults.v1`, keyed by intent archetype to opaque catalog ID.

## Verification

- Passed: `pnpm --filter @kehto/paja build`.
- Passed: `pnpm exec vitest run packages/paja/src/browser-intent-controller.test.ts packages/paja/src/browser-adapter-intent.test.ts packages/paja/src/intent-launcher.test.ts packages/paja/src/browser-runtime-tabs.test.ts` — 4 files, 21 tests, including default-before-recommendation regression coverage.
- Passed: `git diff --check`.

## Handoff

- Browser E2E remains owned by the parallel browser executor.
- This slice is uncommitted by parent instruction.
