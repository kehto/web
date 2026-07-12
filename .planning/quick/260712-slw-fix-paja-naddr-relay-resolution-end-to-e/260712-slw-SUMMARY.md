---
quick_id: 260712-slw
status: complete
description: Fix Paja naddr relay resolution end-to-end
commit: 8ba8e30
completed: 2026-07-12T20:53:57+02:00
---

# Quick Task 260712-slw Summary

Paja runtime pointers now treat embedded NIP-19 relay hints as preferred candidates rather than an exhaustive relay set. The browser appends Paja's effective configured live relay URLs through the existing `getPajaRelayUrls()` gate, so relay-disabled simulation still contributes no fallback connections.

## Implementation

- Preserved pointer hints first, normalized and deduplicated the combined candidate list, and queried it once.
- Added one overall connection/fanout/EOSE deadline plus distinct timeout, relay failure, and all-relays EOSE/no-match diagnostics.
- Kept `resolveNapplet()` as the unchanged fail-closed signature, aggregate, Blossom hash, and verified HTML boundary.
- Added unit coverage for fallback, ordering, deduplication, disabled mode, shared deadline, diagnostics, and forged manifests/blobs.
- Added deterministic Playwright coverage with mocked Nostr relays plus local Blossom bytes, and an opt-in live-vector browser test.
- Updated Paja docs and added a patch changeset for `@kehto/paja`.

## Protocol Sources

- NIP-19 and NIP-65: `nostr-protocol/nips@8f8444d05a8842c40211ded5d10af3521541f865`
- NIP-5D PR #2303: `78efc118278e3ed42201eba9b60530b65835d7ed`
- `napplet/naps` registry: `5fd99465892fbead3888d7146e1737f77b0ed0b4`; no pointer-resolution NAP exists.

## Verification

- `pnpm --filter @kehto/paja test -- runtime-resolver` — 13 files, 81 tests passed.
- `pnpm build` — 32 tasks passed.
- `pnpm type-check` — 17 tasks passed.
- `pnpm test:unit` — 104 files, 1371 tests passed.
- `pnpm test:e2e` — 73 passed, 1 live-only test skipped by default.
- `PAJA_LIVE_POINTER_TEST=1 npx playwright test tests/e2e/paja-runtime-pointer.spec.ts -g "Good Morning"` — live browser test passed.
- `pnpm docs:check` — passed.
- `pnpm lint` — no configured tasks.
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` — 100/100.
- `git diff --check` — passed.

The supplied naddr resolved through the built resolver and served Chromium UI to event `f39dfca7dbaeacbddf294977c5654c912fced30d8b839b32a1910a988ccc1f5a`, aggregate `c922cf30dc1e12b135462057631ba3017cdaeea591725f077c5a20a6d9967b68`, and 170797 verified HTML bytes containing `Good Morning Protocol` in iframe `srcdoc`.

## Remaining Risk

The live proof depends on external Nostr relay and Blossom availability; deterministic browser coverage protects behavior when those services are unavailable.
