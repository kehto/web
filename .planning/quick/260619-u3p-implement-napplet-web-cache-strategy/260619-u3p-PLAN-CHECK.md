---
quick_id: 260619-u3p
slug: implement-napplet-web-cache-strategy
status: pass
checked_at: 2026-06-19T19:44:00Z
---

# Plan Check

## Strategy Conformance

- Cache Storage is the primary storage layer; no localStorage or IndexedDB is in
  the plan.
- The cache is an optimization only: manifest signature and aggregate checks
  still run before writes, and blob hashes still run on cache hits.
- Blob and aggregate entries are immutable and hash-addressed; coordinates are
  mutable and TTL-bound.
- Quota sizing and pruning follow the accepted strategy: storage estimates when
  available, unknown-quota fallback, LRU aggregate eviction, unreferenced blob
  deletion, and active-session protection.
- Missing Cache Storage or failed cache open keeps the existing network-only
  loader path.

## Architecture Conformance

- The implementation belongs under `@kehto/nip/5d`, where NIP-5D resolution and
  verification already live.
- The playground host may opt into the adapter, but runtime and shell message
  protocols remain untouched.
- The plan preserves the existing `srcdoc` opaque-origin render path and
  computed `(dTag, aggregateHash)` identity registration.

## Risk Notes

- Browser Cache Storage is absent in the Node test environment, so tests need a
  small in-memory Cache/CacheStorage test double.
- `@kehto/nip` is tree-shakable; keep the adapter optional and avoid top-level
  reads of browser globals.
- If docs change, run `pnpm docs:check`; otherwise the strategy doc already
  covers the implementation contract.

