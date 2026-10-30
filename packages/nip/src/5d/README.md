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

### Source and presentation media

Checked against NIP-5D PR #2303 at `dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d`
(§Source, §Presentation media). Every field below is informational: a
malformed or repeated tag is ignored and never prevents playback.

| Tag | Manifest field | Rule |
|-----|----------------|------|
| `source` | `source` | one tag, two elements; `http`, `https`, `ssh`, `git` or NIP-34 `nostr://` URL, or scp-like `[user@]host:path`; local paths and `file` URLs are ignored (`isSourceLocation`) |
| `source-commit` | `sourceCommit` | one full lowercase-hex Git commit ID (40 or 64 chars); ignored without a usable `source` |
| `source-archive` | `sourceArchive` | one tag: HTTPS URL without credentials or fragment, 64-char sha256, MIME type; verify the digest before use |
| `screenshot` | `screenshots` | any number, manifest order preserved; NIP-92 `key value` fields with exactly one `x`; optional `m` (`image/png`, `image/jpeg`, `image/webp`), `dim`, `size`, `alt` |
| `preview` | `preview` | at most one; same fields plus `duration`; optional `m` must be `video/*`; several `preview` tags ignore the preview |

Spec-gap decision: an HTTP(S) `source` may name a repository or an archive and
Kehto cannot tell them apart from the location, so any accepted `source` keeps
an otherwise valid `source-commit`.

Declarations are not verified media. Before rendering fetched bytes a host MUST
check the SHA-256, decode screenshots as PNG, JPEG or WebP (previews as video)
and confirm a declared `m` matches the decoded format.
`verifyPresentationMediaBytes(bytes, media, kind)` applies the hash, container
and `m` checks and returns the recognised format or `undefined`; it is a header
check, so a host still relies on the browser decoder and keeps placeholder
artwork for anything that fails to decode. Unusable entries never suppress
other screenshots or block discovery or playback.

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
| `parseSourceMetadata(tags)`, `isSourceLocation(value)` | `source`, `sourceCommit`, `sourceArchive` after the NIP-5D ignore rules |
| `parsePresentationMedia(tags)` | ordered usable `screenshots` and the single `preview` declaration |
| `sniffPresentationMediaFormat(bytes)` | PNG/JPEG/WebP/WebM/MP4 container recognition from leading bytes |
| `verifyPresentationMediaBytes(bytes, media, kind)` | hash + container + declared `m` checks; recognised format or `undefined` |
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

NIP-5D verification accepts root (`15129`), named (`35129`) and snapshot (`5129`) manifests. Roots and snapshots have no `d` tag; snapshots are identified by signed event ID. Every kind uses the same signature and artifact-byte verification. Paja accepts root coordinates with an empty NIP-19 `naddr` identifier and exact `nevent` references for all three kinds.
