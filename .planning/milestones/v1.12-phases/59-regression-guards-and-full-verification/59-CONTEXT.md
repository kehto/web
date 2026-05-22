---
phase: 59-regression-guards-and-full-verification
type: context
status: active
created: 2026-05-22
---

# Phase 59 Context

## Inputs

- Pinned contract: `specs/NIP-5D.md`
- Delta inventory: `.planning/NIP-5D-DELTA-AUDIT.md`
- Phase 56-58 implementation commits:
  - `2f06fad` contract/package-source baseline
  - `17f07a9` shell capabilities/requires enforcement
  - `c8fcabd` playground napplet NUB contracts

## Requirements

- GUARD-01 through GUARD-06
- E2E-35
- E2E-36
- VERIFY-01

## Current Guard Coverage

- `tests/unit/playground-gateway-guard.test.ts` already covers:
  - gateway route loading
  - opaque iframe sandbox with `allow-scripts`
  - no `allow-same-origin`
  - parsed manifest `requires` exposed to `loadNapplet()`
  - pre-navigation missing-requires check ordering
- `packages/runtime/src/dispatch.test.ts` already covers:
  - legacy array drops
  - unknown-domain silent drops
- Phase 59 must add missing coverage for:
  - unknown `MessageEvent.source` at the shell bridge boundary
  - forbidden browser/protocol primitives in active playground napplet source
  - complete source `requires` and `supports()` coverage for all 13 napplets
  - raw-envelope allowlist enforcement
  - E2E missing-requires rejection/warning
  - E2E hosted `supports()` behavior from actual shell capabilities

## Verification Target

The phase is not complete until these pass:

- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm audit:csp`
- `pnpm audit:gateway-artifacts`
- `pnpm test:e2e`
