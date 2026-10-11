# @kehto/nip

Tree-shakable bundle of framework-agnostic Nostr NIP utilities — the NIPs that
`nostr-tools` does not ship but relay-aware runtimes commonly need. Each NIP
lives in its own folder at its own subpath (e.g. `@kehto/nip/5d`); the barrel
re-exports them and `sideEffects: false` lets bundlers drop any NIP a consumer
does not import.

> **Alpha status:** This utility can support Kehto and other napplet runtimes.
> Its integration points may change while NIP-5D runtime implementations evolve.

## Install

```bash
pnpm add @kehto/nip nostr-tools
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/nip/package.json`, `packages/nip/src/index.ts` |
| Version | `0.6.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Side effects | `false` |

## Peer Dependencies

| Package | Range |
|---------|-------|
| `nostr-tools` | `>=2.23.3 <=2.x` |

## Primary APIs

| Subpath | NIP | Exports |
|---------|-----|---------|
| `@kehto/nip/5a` | NIP-5A aggregate verification | `computeAggregateHash`, `verifyAggregate`, `pathEntriesFromTags`, `aggregateTagValue` |
| `@kehto/nip/5d` | NIP-5D napplet manifest resolution | `resolveNapplet`, `parseNappletManifest`, `getNappletCatalogId`, `fetchBlob`, `verifyManifestSignature`, `verifyBlobHash`, `openNappletArtifactCache`, `CacheStorageNappletArtifactCache` |
| `@kehto/nip/51` | NIP-51 lists & sets | `parseList`, `getTagValues`, `decryptPrivateItems`, `isListKind`, `isSetKind`, `listKindName`, `LIST_KINDS`, `SET_KINDS` |
| `@kehto/nip/65` | NIP-65 relay lists | `parseNip65RelayList`, `selectWriteRelays`, `selectReadRelays`, `createNip65Registry` (outbox/inbox resolution) |
| `@kehto/nip/66` | NIP-66 relay discovery | `createNip66Aggregator`, `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions` |
| `@kehto/nip/89` | NIP-89 app handlers | `parseHandlerInformation`, `parseHandlerRecommendation`, `handlesKind`, `buildHandlerUrl` |

Each subpath ships its own `README.md` with full API docs and examples.

## NIP-5D Artifact Cache

`@kehto/nip/5d` includes the host-side resolver used by the playground to verify
NIP-5D manifests and Blossom artifact bytes (legacy: NIP-5A aggregates) before rendering a
napplet. Browser hosts can pass an optional `NappletArtifactCache` to
`resolveNapplet()`; the included `CacheStorageNappletArtifactCache` stores only
verified blobs and aggregate metadata in Cache Storage.

Use [`openNappletArtifactCache()`](../api/functions/_kehto_nip..openNappletArtifactCache.html)
to feature-detect Cache Storage and fall back to network-only loading when the
browser cannot open a cache. The cache is an optimization: cached blobs are
still re-hashed before use, and writes happen only after the signature,
content identity, and every blob hash have been verified.

Implementation guide:
[Implement a napplet artifact cache](../how-tos/implement-napplet-artifact-cache.md).

## Selection criteria

A NIP earns a place here only if it is **unique** (not already provided by
`nostr-tools` — re-wrapping `nip04`/`nip19`/`nip25`/`nip44`/`nip57`/… would be a
no-op), **broadly needed** across runtimes, and **substantive** (a real common
case, no framework coupling, no module-global state).

## Scope Boundaries

- Ships unique NIP utilities only; each NIP is importable from its own subpath so unused NIPs tree-shake away.
- All stateful helpers are closure-scoped factories (`create*`) — multi-instance safe, never module globals.
- Crypto and relay concerns are injected (pool adapters, NIP-44 decryptors), so the package carries no crypto or relay-library dependency.
- The NIP-5D artifact cache is host-owned and optional; it does not make Cache Storage a correctness requirement.
- Does not bundle bootstrap relay policy, NIP-77 sync, OPFS cache priming, or Kehto runtime dependencies.

## API Reference

- Generated module: <a href="../api/modules/_kehto_nip.html" target="_self"><code>docs/api/modules/_kehto_nip.html</code></a>
- NIP-5D module: <a href="../api/modules/_kehto_nip.5d.html" target="_self"><code>docs/api/modules/_kehto_nip.5d.html</code></a>
- Artifact cache opener: <a href="../api/functions/_kehto_nip..openNappletArtifactCache.html" target="_self"><code>openNappletArtifactCache</code></a>
- Cache adapter class: <a href="../api/classes/_kehto_nip..CacheStorageNappletArtifactCache.html" target="_self"><code>CacheStorageNappletArtifactCache</code></a>

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](../migrations/NIP-5D-EVENT-SCHEMA.md).

## NIP-5D archetype manifest contracts

Kehto follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`.
Current manifests declare roles with `z` and contracts with
`["i", "napplet:<role>/<action>", ...parameterNames]`. Only an intent whose
role is also declared by `z` is eligible. Invalid advertisements are ignored;
they do not invalidate otherwise valid artifact metadata.

`resolveNapplet()` exposes `manifest.archetypes` as ordered
`{ slug, convention, params }` entries. Parameter names describe text fields,
not types or required values. Legacy paired archetype tags retain empty params.
`manifest.catalogId`, also available through `getNappletCatalogId(event)`, is
publisher/kind-safe: named events use kind, publisher and literal d-tag; roots
use kind and publisher; snapshots use kind and event ID. Callers treat this ID
as opaque. The existing dTag/artifact hash remains separate artifact metadata.

NIP utilities verify these facts; services and hosts select and run handlers.
