# `@kehto/nip/5d` — NIP-5D napplet manifest resolution

Resolve signed [NIP-5D](https://github.com/dskvr/nips/blob/nip/5d/5D.md)
manifests and verify the self-contained `/index.html` blob against the event's
single `x` hash. Identity is `(dTag, artifactHash)`, computed from verified bytes.
`aggregateHash` remains a compatibility alias in existing host/cache/ACL APIs.

Current events use `content` for the plain-text description, `z` roles, `i`
accepted intents and parameter names, `R` required domains, and `O` optional
domains. The parser preserves ordered parameter names and projects only intents
whose URI role has a matching `z` declaration into `{ slug, convention, params }`
contracts. Invalid advertisements are ignored. Declarations grant no authority.
The intent catalog uses `manifest.catalogId`: named kind/publisher/d-tag, root
kind/publisher, or snapshot kind/event-ID identity. This is separate from the
existing artifact/cache identity and includes nameless root/snapshot handlers.
This follows NAP-INTENT PR #106 at `fc121fc264615482143eda86125863d2e1f741a2`.
Malformed or unsupported icons are ignored; Kehto retains generic artwork and
does not render unverified icon URLs. Snapshot lineage is metadata, never a
resolution dependency. HTML metadata cannot override the signed event.

Legacy `path` + `["x", hash, "aggregate"]` events remain supported by
`legacy-manifest.ts`. Only that adapter parses `requires`, `description`, and
paired `archetype` tags or verifies NIP-5A aggregates. Format selection is explicit;
validation failures never retry another schema. Removing the adapter and its
selection branch retires legacy events without rewriting loaders or caches.
See [migration policy](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).

Any verification failure throws `NappletResolutionError`; never render unverified
bytes. Both formats retain signature, blob-tamper, cache, and host regressions.

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
| `parseNappletManifest(event)` | event → `normalized identity, paths, required/optional domains, roles, intents, and metadata` |
| `getNappletCatalogId(event)` | opaque publisher/kind-safe intent catalog identity from a verified event |
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
blob hash (and the aggregate for legacy events), so a lying server or gateway is rejected.

## Optional artifact cache

Hosts that run in a secure browser context can opt into the Cache Storage based
artifact cache:

```ts
import { openNappletArtifactCache, resolveNapplet } from '@kehto/nip/5d';

const cache = await openNappletArtifactCache();
const napplet = await resolveNapplet({ event, fetchBlob, cache });
```

The cache is only an optimization. `resolveNapplet()` still verifies the
manifest signature and content identity on every call, and cached blob bytes are
re-hashed before use. If Cache Storage cannot be opened, or a host requires
storage estimates and the browser cannot provide them, `openNappletArtifactCache`
returns `undefined`; pass that through to keep network-only loading.

The adapter stores verified blob responses, aggregate metadata, coordinate
freshness, and its JSON index in the same versioned Cache Storage namespace. It
prunes by refcount and least-recently-used aggregate order, while in-memory
active aggregate pins prevent eviction of a currently running napplet unless the
hard budget is exceeded.
