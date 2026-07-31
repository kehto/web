---
status: resolved
trigger: "Resolve hyprgate/web#329 in Kehto without a local upstream-package shim"
created: "2026-07-31"
updated: "2026-07-31"
---

# Hyprgate INTENT authority mismatch

## Symptoms

- NAP-INTENT master requires a universal structured `IntentResult` for every
  `intent.invoke.result`, including denial paths.
- Archetype routing and payload convention are orthogonal N:M dimensions.
- Kehto main already emits the required universal intent denial results, but
  rejects a convention whose URI archetype token differs from the manifest
  role slug.

## Current Focus

- hypothesis: Kehto can correct its own runtime and manifest handling without
  patching the still-defective published Napplet packages.
- test: Add local runtime, manifest-parser, and catalog regression coverage.
- expecting: Valid orthogonal metadata is accepted by Kehto and every local
  invoke result includes `ok`, `archetype`, `action`, and `handled`.
- next_action: resolved

## Evidence

- 2026-07-31: Read hyprgate/web#329 and all three comments; its no-shim stance
  prohibits local declaration augmentation, plugin patches, manifest rewrites,
  and wire adapters.
- 2026-07-31: Checked napplet/naps master NAP-INTENT at
  5ac0490461ca6fec2f0d2e45b4835cf9bc08de24 and napplet/web main at
  03ad65b66413e5798536ef48695ffc4c2508f2c3.
- 2026-07-31: Kehto main already emits universal local `intent.invoke.result`
  denial carriers and its catalog adapter accepts N:M metadata. The manifest
  parser and playground validation were the remaining local equality guards.
- 2026-07-31: Local full E2E cannot acquire its harness at port 4173 because a
  running Cordn workspace occupies it. The current main CI run
  30489834150 is green; focused regressions, build, type-check, full unit,
  docs, and AI-quality gates pass locally.

## Resolution

- root_cause: Kehto's manifest parser and playground build preflight treated a
  convention URI's archetype token as the routing archetype, contrary to
  NAP-INTENT's explicit orthogonal N:M rule.
- fix: Retain strict slug and queryless convention syntax validation, while
  removing the token-equality rejection and protecting the behavior with
  parser, playground, and static conformance regressions.
- verification: `pnpm build`, `pnpm type-check`, `pnpm test:unit` (1,534
  tests), `pnpm docs:check`, and `aislop` 100/100 pass. Full E2E is blocked
  locally by the external port occupant described above.
- files_changed: packages/nip/src/5d/index.ts,
  apps/playground/napplets/shared-vite-config.ts, tests, RUNTIME-SPEC.md.
