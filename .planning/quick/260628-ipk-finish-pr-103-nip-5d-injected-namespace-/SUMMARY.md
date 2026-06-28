---
id: 260628-ipk
slug: finish-pr-103-nip-5d-injected-namespace-
status: complete
date: 2026-06-28
---

# Summary

Finished the PR #103 closeout against the live NIP-5D text in
`nostr-protocol/nips#2303` after merged `dskvr/nips#4`.

## Changes

- Updated runtime, policy, shell, playground, and migration docs so injected
  `window.napplet.<domain>` presence is the current NIP-5D availability model.
- Marked `window.napplet.shell.supports()` as compatibility behavior for current
  shim/demo code, not normative NIP-5D availability.
- Added AGENTS guardrails requiring playground NIP-5D loader changes to prove
  verified `srcdoc` provenance and keep injected bootstraps outside signed
  artifact bytes.
- Reconciled `origin/main` into PR #103 and kept both PR #102 and PR #103 quick
  task rows in `.planning/STATE.md`.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts tests/unit/playground-gateway-guard.test.ts` passed, 15 tests.
- `pnpm type-check` passed; this runs `pnpm build` first.
- `pnpm docs:check` passed.
- `pnpm test:unit` passed, 95 files / 1233 tests.
- `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts --workers=1` passed, 2 tests.
- `pnpm test:e2e` passed, 69 tests.
- `git diff --check` passed.
- Conflict-marker scan and stale old-model phrase scan passed.
- `pnpm dlx aislop@0.9.3 scan --changes` passed 100/100 on the clean working tree.

## Remaining Baseline

`aislop@0.9.3 scan --include ...` does not narrow scope in this checkout and
falls back to the full 211-file repo scan. The full scan still reports
pre-existing warnings outside PR #103, matching the prior branch baseline.
