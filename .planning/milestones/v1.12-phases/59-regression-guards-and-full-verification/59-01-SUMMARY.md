---
phase: 59-regression-guards-and-full-verification
plan: 01
type: summary
status: completed
completed: 2026-05-22
---

# Phase 59 Summary

## Outcome

Phase 59 completed the v1.12 regression guard and verification gate for NIP-5D Contract Conformance.

## Changes

- Added `tests/unit/nip5d-conformance-guard.test.ts` to guard the active playground napplet source contract:
  - no napplet-visible `window.nostr`
  - no direct `localStorage`, `sessionStorage`, `IndexedDB`, `WebSocket`, `fetch`, `nostr-tools`, or signing primitives
  - every playground napplet has explicit `requires` and hosted `supports()` preflight coverage
  - remaining raw envelopes are confined to the Phase 58 allowlist
- Extended `packages/shell/src/shell-bridge.test.ts` so unknown `MessageEvent.source` senders are silently dropped before runtime dispatch.
- Extended `tests/e2e/gateway-artifact-parity.spec.ts` so all 13 gateway-loaded napplets prove built manifest `requires` values and shell-derived hosted `supports()` behavior.
- Added `tests/e2e/nip5d-contract-conformance.spec.ts` to prove unsupported required NUB capabilities reject at load time before iframe creation.
- Updated stale E2E roster assertions to the current 13-napplet playground contract.
- Updated `vitest.config.ts` to resolve protocol package aliases from repo-local `napplet/packages/*` sources.
- Updated `apps/playground/README.md` to match the Phase 58 capability matrix.
- Relaxed `scripts/audit-gateway-artifacts.mjs` only enough to accept the new `definePlaygroundNappletConfig(name, { requires })` shape while still enforcing route-aligned `dTag`.

## Requirements Closed

- GUARD-01 through GUARD-06
- E2E-35
- E2E-36
- VERIFY-01

## Verification

Final verification passed:

- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit` — 34 files, 560 tests
- `pnpm audit:csp` — 13 napplet artifacts scanned, no meta-CSP
- `pnpm audit:gateway-artifacts` — 13 gateway artifacts checked
- `pnpm test:e2e` — 89 passed
- `git diff --check`
