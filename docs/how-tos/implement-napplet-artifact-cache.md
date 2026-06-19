# How-to: Implement a Napplet Artifact Cache

Use this when a browser host wants repeated NIP-5D napplet loads to reuse
verified artifact bytes without weakening content-addressed loading.

This is a host optimization, not a protocol requirement. If Cache Storage is
unavailable, the resolver should keep loading from Blossom or the gateway and
still fail closed on verification errors.

## Requirements

- Run in a secure browser context where `globalThis.caches` is available.
- Resolve a signed NIP-5D manifest event before calling `resolveNapplet()`.
- Fetch blob bytes through an untrusted `fetchBlob` callback; the resolver
  re-hashes every byte before use.
- Render the resulting HTML in an opaque-origin iframe (`sandbox="allow-scripts"`
  without `allow-same-origin`).

## Open the cache

Use `openNappletArtifactCache()` from `@kehto/nip/5d`. It returns a
`CacheStorageNappletArtifactCache` when Cache Storage can be opened, or
`undefined` when the host should fall back to network-only loading.

```ts
import {
  openNappletArtifactCache,
  resolveNapplet,
  type NappletCacheDiagnostic,
} from '@kehto/nip/5d';

const diagnostics: NappletCacheDiagnostic[] = [];

const cache = await openNappletArtifactCache({
  requireStorageEstimate: true,
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
});

const napplet = await resolveNapplet({
  event,
  cache,
  fetchBlob: async (sha256Hex, servers) => {
    for (const server of servers) {
      const response = await fetch(`${server}/${sha256Hex}`, { cache: 'no-store' });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    }
    throw new Error(`blob unavailable: ${sha256Hex}`);
  },
});
```

`requireStorageEstimate: true` is useful for hosts that prefer deterministic
cache budgeting. When the browser does not expose `navigator.storage.estimate()`
the opener reports `storage-estimate-unavailable` and returns `undefined`, so
the same `resolveNapplet()` call proceeds without cache writes.

Leave `requireStorageEstimate` unset when a host is comfortable with the default
unknown-quota budget.

## Pass the cache to the resolver

`resolveNapplet()` owns the trust boundary:

1. It verifies the manifest signature.
2. It recomputes the NIP-5A aggregate.
3. It reads cached blobs by SHA-256 when present.
4. It re-hashes cached bytes before using them.
5. It fetches missing or invalid blobs from the caller's `fetchBlob`.
6. It writes verified blobs and aggregate metadata only after the complete
   resolution succeeds.

Do not write unverified responses into the cache yourself. If a cached blob
fails its hash check, `resolveNapplet()` deletes that blob and fetches it again.

## Tune budgets

The default cache namespace is `kehto:napplet-artifacts:v1`. The adapter stores
verified blobs, aggregate records, mutable coordinate metadata, and its JSON
index inside that namespace.

Override the budget options only when the host has a product-specific storage
policy:

```ts
const cache = await openNappletArtifactCache({
  unknownBudgetBytes: 16 * 1024 * 1024,
  softCeilingBytes: 64 * 1024 * 1024,
  hardCeilingBytes: 128 * 1024 * 1024,
  onDiagnostic: reportCacheDiagnostic,
});
```

The cache prunes unreferenced blobs and least-recently-used aggregate records.
Running napplets are protected by in-memory active aggregate pins unless the
hard ceiling is exceeded.

## Handle diagnostics

Cache diagnostics are non-fatal. Treat them as host telemetry and continue with
the resolved napplet or a network-only retry path.

| Diagnostic | Meaning |
|------------|---------|
| `cache-open-failed` | Cache Storage could not be opened. |
| `cache-read-failed` | A cache read failed; the resolver can fetch from network. |
| `cache-write-failed` | A verified resolution could not be written after prune retry. |
| `cache-delete-failed` | An invalid or pruned blob could not be deleted. |
| `cache-prune-failed` | Budget pruning failed. |
| `storage-estimate-unavailable` | Storage estimates are missing or failed. |

## Keep the security invariants

- Treat cached bytes as untrusted until `resolveNapplet()` checks their hashes.
- Never use the cache as the source of napplet identity; identity remains the
  verified `(dTag, aggregateHash)` tuple.
- Treat missing or evicted cache records as a cold start.
- Do not grant a napplet access to another napplet's cached artifact bytes
  through a NAP service.
- Keep iframe rendering opaque-origin even when the artifact came from cache.

## Reference

- Strategy: [Napplet Web Cache Strategy](../concepts/napplet-web-cache-strategy.md)
- Package docs: [`@kehto/nip`](../packages/nip.md)
- Generated API:
  [`openNappletArtifactCache`](../api/functions/_kehto_nip..openNappletArtifactCache.html),
  [`CacheStorageNappletArtifactCache`](../api/classes/_kehto_nip..CacheStorageNappletArtifactCache.html),
  [`NappletArtifactCache`](../api/interfaces/_kehto_nip..NappletArtifactCache.html)
