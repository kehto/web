# Napplet Web Cache Strategy

## Status

Recommended implementation path. This is not a protocol requirement for every
napplet runtime; it is the Kehto host-side strategy for making repeated napplet
loads faster without weakening content-addressed loading.

Reader: host-runtime implementers. After reading this, they should be able to
choose the browser storage layer, implement cache keys, and set eviction rules
without reaching for IndexedDB or localStorage as the primary cache.

## Decision

Use the Cache Storage API as the primary web cache for verified napplet
artifacts. Store cache metadata as small JSON `Response` objects inside the same
named cache. Do not use localStorage. Do not use IndexedDB for the primary
artifact cache.

The cache is an optimization only. The runtime still derives napplet identity
from verified NIP-5D manifest data and verified NIP-5A file hashes. A cache hit
must never replace signature, aggregate, or blob-hash verification.

Use `navigator.storage.estimate()` to size the cache budget. Request persistent
storage only as an optional host policy, not as a correctness requirement. Treat
Storage Buckets as a feature-detected enhancement when they are available, and
fall back to the ordinary origin bucket when they are not.

## Why Cache Storage

Cache Storage fits napplet artifacts better than IndexedDB or localStorage:

- It stores request/response pairs, which maps naturally to manifest snapshots,
  verified blobs, assembled HTML, and index JSON.
- It is available from windows and workers, so Kehto does not need a service
  worker just to read or write the cache.
- It works in modern secure browser contexts across the engines Kehto needs to
  target.
- It avoids string-only localStorage limits and avoids making IndexedDB schema
  management part of the loader contract.

The tradeoff is that Cache Storage does not expire entries on its own and does
not honor HTTP cache headers for the application cache. Kehto must own the index,
freshness rules, and deletion policy.

## Cache Shape

Open one versioned cache, for example `kehto:napplet-artifacts:v1`. Use synthetic
same-origin request URLs as keys. These keys are cache identifiers, not network
routes.

Store four record classes:

| Class | Keyed by | Contents | Freshness |
|-------|----------|----------|-----------|
| Blob | SHA-256 | Verified file bytes | Immutable; no TTL |
| Aggregate | `(dTag, aggregateHash)` | Verified assembled HTML plus manifest summary | Immutable; no TTL |
| Coordinate | author + kind + `d` | Latest known aggregate for a replaceable manifest | Short TTL; revalidate before launch |
| Index | cache version | JSON metadata for size, refs, access time, pins, and schema version | Rewritten after changes |

Write order matters:

1. Resolve the manifest from relays or a gateway.
2. Verify the manifest signature.
3. Recompute and verify the aggregate.
4. Fetch each file by hash and verify its SHA-256.
5. Write verified blob responses.
6. Write the aggregate record.
7. Update the coordinate and index records last.

If the index is missing or corrupt, rebuild it from cache keys when possible.
If rebuilding cannot prove a record, delete the ambiguous entry and resolve from
network again.

## Freshness Rules

Separate immutable content from mutable coordinates.

Blob and aggregate records are immutable because they are addressed by verified
hashes. They can remain until eviction.

Named and root napplet coordinates are mutable because a replaceable event may
point to a new aggregate. Cache the coordinate for fast reloads, but revalidate
it before launching when it is older than the freshness window.

Recommended defaults:

| Data | Default |
|------|---------|
| Replaceable coordinate foreground TTL | 15 minutes |
| Replaceable coordinate background TTL | 1 hour |
| Snapshot coordinate TTL | No TTL; event ID is immutable |
| Failed resolution retry floor | 30 seconds |
| Manifest event retention | 30 days after last access |
| Verified aggregate retention | Until size eviction |

The loader may render a cached aggregate immediately only when host policy
allows stale-while-revalidate behavior. If a revalidation finds a newer
aggregate, future launches should use the newer aggregate; an already-running
napplet should not be hot-swapped unless the host has an explicit update flow.

## Eviction Policy

Kehto should enforce its own budget before the browser reaches origin-level
pressure. Browser eviction can delete all origin storage at once, so app-level
eviction is the only way to keep cache behavior predictable.

Recommended budget:

| Budget | Rule |
|--------|------|
| Known quota | `min(128 MiB, 10% of estimated quota)` |
| Unknown quota | 32 MiB |
| Hard ceiling | `min(256 MiB, 20% of estimated quota)` |
| Single napplet aggregate | 16 MiB default; host opt-in above that |
| Minimum free headroom | prune when estimated origin usage exceeds 80% of quota |

Recommended pruning order:

1. Delete corrupt, partially written, or schema-incompatible records.
2. Delete failed-resolution negative-cache entries older than their retry floor.
3. Delete unreferenced blobs.
4. Delete non-pinned aggregates by least-recently-used order.
5. Delete older aggregates for the same coordinate before deleting the current
   aggregate.
6. Delete pinned current aggregates only when the hard ceiling is exceeded and
   no unpinned entries remain.

Do not evict an aggregate used by a currently running session. Mark it active in
memory, not in persistent storage, so a crash or tab close cannot leave permanent
pins.

Every successful launch should update `lastAccessed` for the aggregate and its
blob references. Every failed write should trigger one prune-and-retry cycle.
If the retry still fails, continue with an uncached launch and report a
non-fatal cache write failure to host diagnostics.

## Storage Buckets

When `navigator.storageBuckets` exists, a host may open a relaxed bucket for
napplet artifacts. Use the bucket only if the browser exposes the storage API
needed by the cache implementation. The Storage Buckets explainer includes
bucket-local Cache Storage, but current Chromium documentation still calls out
IndexedDB as the implemented bucket entry point.

Do not make Storage Buckets mandatory. They are useful for future eviction
control, but ordinary origin-level Cache Storage remains the compatibility path.

## OPFS and IndexedDB

OPFS is a reasonable later optimization for very large artifact sets or
worker-heavy streaming paths. It is not the first implementation target because
Cache Storage already stores the response-shaped objects Kehto needs, and OPFS
still shares the same origin quota and browser eviction model.

IndexedDB should stay a fallback of last resort, and only for metadata if Cache
Storage metadata-in-cache proves too awkward in a specific browser. If that
fallback is ever enabled, cap it very low and keep artifact bytes in Cache
Storage or OPFS.

localStorage is not appropriate for this cache. It is synchronous, string-only,
not suited to binary artifacts, and already used for small host preferences in
some contexts. It should not become part of napplet artifact loading.

## Service Worker Role

A service worker is optional.

Kehto can implement the primary cache from the host window because Cache Storage
is exposed outside service workers. This matches the current resolver shape,
where the host resolves and verifies bytes before rendering a sandboxed iframe.

Use a service worker only if the host wants URL navigation to gateway-like
routes to be served from cache. In that design, the service worker still serves
only records that the host has already verified and indexed. It must not fetch
and trust opaque responses as napplet bytes.

## Security Invariants

- Cached bytes are untrusted until their hash is checked.
- A cached aggregate is addressed by the computed `(dTag, aggregateHash)` tuple.
- Mutable coordinates never outrank relay or gateway revalidation policy.
- Cache records are partitioned by napplet identity; one napplet cannot observe
  another napplet's cached resources through a NAP service.
- Browser eviction is treated as a cold-start event, not as data loss.
- Private browsing, disabled storage, opaque origins, or insecure origins must
  degrade to network-only loading.

## Rejected Paths

| Path | Reason |
|------|--------|
| HTTP browser cache only | It does not give Kehto a verifiable index, portable eviction policy, or identity-aware partitioning. |
| localStorage | Wrong data model and synchronous string storage; unsuitable for artifacts. |
| IndexedDB primary cache | Viable but unnecessary; adds schema and transaction complexity when Cache Storage already fits response-shaped artifacts. |
| OPFS first | Useful for large-file optimization, but it does not improve the core eviction model enough to justify the first implementation. |
| Storage Buckets required | Better eviction expression, but not yet universal enough to be the baseline. |

## Implementation Checklist

- Feature-detect `window.caches`; otherwise use network-only loading.
- Open a versioned Cache Storage namespace.
- Store the cache index as a JSON response in the namespace.
- Cache only verified blobs and verified aggregate records.
- Keep coordinate freshness separate from immutable blob freshness.
- Measure origin quota with `navigator.storage.estimate()` when available.
- Enforce the soft budget before the browser reaches origin pressure.
- Prune by refcount and LRU, never by deleting active sessions.
- Treat missing cache data as a cold start.
- Log cache write failures as diagnostics, not launch failures.

## References

- [MDN Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [MDN CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [MDN Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN StorageManager estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)
- [Chrome Storage Buckets overview](https://developer.chrome.com/docs/web-platform/storage-buckets)
- [MDN Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
