---
id: 260628-ipk
slug: finish-pr-103-nip-5d-injected-namespace-
status: complete
date: 2026-06-28
---

# Summary

Finished the PR #103 closeout against the live NIP-5D text in
`nostr-protocol/nips#2303` after merged `dskvr/nips#4`, then reconciled it
with the published inject-compatible napplet package line released on
2026-06-28.

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
- Consumed the current published napplet packages:
  `@napplet/core@0.23.0`, `@napplet/nap@0.23.0`,
  `@napplet/shim@0.24.0`, `@napplet/sdk@0.20.2`, and
  `@napplet/vite-plugin@0.10.1`.
- Removed the temporary playground `shell` transition domain from injected
  prelude output; demos now preflight required domains through
  `window.napplet.<domain>` presence.
- Updated package metadata, demo fixtures, docs, and guard tests to use the
  current peer range and to reject stale `shell.supports()` preflight usage.
- Reconciled Paja with the current upstream NAP domain set by treating `dm` as
  deferred runtime coverage and `shell` as handshake-only compatibility.

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
- Post-release stale package scan passed with no old napplet package pins.
- Post-release old shim path scan found only explicit legacy/negative guardrails
  for `window.napplet.shell.supports()`.
- Continuation audit against the live upstream `5D.md` head
  (`dskvr/nips@6ca56324a3764a17141e681225f0aaa0ad45a5b6`) found and fixed one
  stale `@napplet/vite-plugin@0.8.1` reference in `RUNTIME-SPEC.md`; the docs
  now name the current `0.10.1` release.

## Remaining Baseline

`aislop@0.9.3 scan --include ...` does not narrow scope in this checkout and
falls back to the full 211-file repo scan. The full scan still reports
pre-existing warnings outside PR #103, matching the prior branch baseline.
