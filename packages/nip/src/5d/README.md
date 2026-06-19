# `@kehto/nip/5d` — NIP-5D napplet manifest resolution

Resolve content-addressed [NIP-5D](https://github.com/dskvr/nips/blob/nip/5d/5D.md)
napplets: parse the manifest event, verify its signature, verify the
[NIP-5A](https://github.com/nostr-protocol/nips/pull/2287) aggregate (also at
`@kehto/nip/5a`), fetch and verify each blob from Blossom, and assemble the
verified `/index.html`.

The napplet's identity is the `(dTag, aggregateHash)` tuple **computed from the
verified bytes** — never accepted from a host or gateway. Any failure throws a
`NappletResolutionError`; the caller must fail closed and never render unverified
bytes.

## Kinds

| Constant | Kind | Type |
|----------|------|------|
| `NAPPLET_KIND_SNAPSHOT` | `5129` | snapshot (regular) |
| `NAPPLET_KIND_ROOT` | `15129` | root (replaceable) |
| `NAPPLET_KIND_NAMED` | `35129` | named (addressable, has `d`) |

Distinct kinds keep napplets out of nsite gateway resolution.

## API

| Export | Description |
|--------|-------------|
| `NAPPLET_KINDS`, `isNappletManifestKind(kind)` | the three kinds + a guard |
| `parseNappletManifest(event)` | event → `{ dTag, paths, aggregateHash, servers, requires, title?, description? }` |
| `verifyManifestSignature(event)` | verify the manifest's Nostr signature |
| `verifyBlobHash(bytes, sha256)` | `true` iff bytes hash to `sha256` |
| `fetchBlob(servers, sha256, fetchBytes)` | fetch a blob from Blossom by hash, re-verifying it (servers untrusted) |
| `resolveNapplet({ event, fetchBlob, cache? })` | full pipeline → `ResolvedNapplet` (computed identity + verified `indexHtml`), optionally reading/writing verified artifacts through Cache Storage |
| `openNappletArtifactCache(options?)` | feature-detect and open the browser Cache Storage artifact cache, returning `undefined` for network-only fallback |
| `CacheStorageNappletArtifactCache` | Cache Storage adapter for verified blobs, aggregate metadata, coordinate freshness, LRU/refcount pruning, and active aggregate pins |
| `NappletResolutionError` | typed failure (`code`: `invalid-signature` \| `invalid-manifest` \| `aggregate-mismatch` \| `blob-hash-mismatch` \| `blob-unavailable` \| `missing-index`) |

```ts
import { resolveNapplet } from '@kehto/nip/5d';

const napplet = await resolveNapplet({ event, fetchBlob });
// napplet.dTag, napplet.aggregateHash are computed from verified bytes
iframe.sandbox.add('allow-scripts');        // never allow-same-origin
iframe.srcdoc = napplet.indexHtml;          // opaque origin preserved
```

The gateway, if used, is only an accelerator: `resolveNapplet` re-verifies every
blob hash and the aggregate, so a lying server or gateway is rejected.

## Optional artifact cache

Hosts that run in a secure browser context can opt into the Cache Storage based
artifact cache:

```ts
import { openNappletArtifactCache, resolveNapplet } from '@kehto/nip/5d';

const cache = await openNappletArtifactCache();
const napplet = await resolveNapplet({ event, fetchBlob, cache });
```

The cache is only an optimization. `resolveNapplet()` still verifies the
manifest signature and aggregate on every call, and cached blob bytes are
re-hashed before use. If Cache Storage cannot be opened, or a host requires
storage estimates and the browser cannot provide them, `openNappletArtifactCache`
returns `undefined`; pass that through to keep network-only loading.

The adapter stores verified blob responses, aggregate metadata, coordinate
freshness, and its JSON index in the same versioned Cache Storage namespace. It
prunes by refcount and least-recently-used aggregate order, while in-memory
active aggregate pins prevent eviction of a currently running napplet unless the
hard budget is exceeded.
