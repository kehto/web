---
quick_id: 260619-u3p
slug: implement-napplet-web-cache-strategy
status: in_progress
created_at: 2026-06-19T19:40:27.899Z
source: /home/sandwich/.codex/attachments/b14bcf75-9d29-4fdf-847a-34b5fe4e8027/pasted-text-1.txt
---

# Implement Napplet Web Cache Strategy - Context

## Locked Objective

Implement the accepted napplet web cache strategy documented in
`docs/concepts/napplet-web-cache-strategy.md`, then verify and ship the change
through a PR.

## Hard Requirements

- Treat `docs/concepts/napplet-web-cache-strategy.md` as the source of truth.
- Use Cache Storage as the primary artifact cache.
- Do not use localStorage.
- Do not make IndexedDB the primary cache; avoid IndexedDB entirely unless a
  narrow metadata fallback proves unavoidable.
- Preserve NIP-5D/NIP-5A verification as authoritative: cache hits must never
  bypass manifest signature, aggregate hash, or blob hash checks.
- Separate immutable blob/aggregate caching from mutable coordinate freshness.
- Implement sensible quota-based pruning and LRU/refcount eviction as described
  in the strategy.
- Degrade cleanly to network-only loading when Cache Storage or storage
  estimates are unavailable.
- Keep runtime/shell boundaries intact and avoid protocol changes.

## Current Architecture

- `packages/nip/src/5d/index.ts` owns NIP-5D manifest resolution. Its
  `resolveNapplet()` pipeline verifies the manifest signature, recomputes the
  aggregate, fetches and verifies every blob, and returns verified `indexHtml`.
- `apps/playground/src/napplet-resolver.ts` owns the playground host lookup:
  NIP-65 relay list discovery, selected relay manifest lookup, Blossom blob
  fetch, then `resolveNapplet()` verification.
- `apps/playground/src/shell-host.ts` injects verified HTML into an opaque-origin
  `iframe.srcdoc` and registers runtime identity from the computed
  `(dTag, aggregateHash)`.
- `packages/runtime` and `packages/shell` do not need protocol changes for this
  cache. The cache should stay an optional loader optimization below runtime
  message dispatch.

## Implementation Boundary

Add an optional artifact-cache adapter to `@kehto/nip/5d` and use it from the
playground resolver. The adapter must be safe to omit, so hosts without Cache
Storage continue through the current network-only path.

## Verification Targets

- Cache miss populates verified blob and aggregate records.
- Cache hit still verifies the manifest signature, aggregate hash, and blob hash.
- Verification failure refuses cached bytes and never renders unverified HTML.
- Coordinate freshness is separate from immutable aggregate/blob retention.
- Quota pruning removes unreferenced blobs and non-active aggregates by LRU.
- Missing Cache Storage or missing storage estimates degrades to network-only
  loading.

