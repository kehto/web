# @kehto/nip

## 0.4.0

### Minor Changes

- bdb15b6: Add an optional Cache Storage artifact cache for NIP-5D napplet resolution.
  Cache hits still re-run manifest signature, aggregate, and blob hash
  verification; hosts can fall back to network-only loading when browser storage
  support is unavailable.

## 0.3.0

### Minor Changes

- ecd1ab3: feat(nip): parse the NAAT archetype axis + source tag from NIP-5D manifests (ARCH-01)

  `parseNappletManifest` now reads two additional manifest tags into structured
  fields on `NappletManifest`:

  - **`archetypes`** — every `["archetype","<slug>","<NAP-N>"]` tag becomes an
    entry `{ slug, nap? }`, preserving tag order. The optional `nap` (3rd tag
    element) is the recommended default wire protocol. The field is always present
    and defaults to `[]` when no archetype tag exists.
  - **`source`** — the optional upstream source URL from the `source` tag, omitted
    when absent.

  This is strictly additive and backward-compatible: every existing field, parse
  path, and throw path is unchanged. The archetype axis is the foundation NAP-INTENT
  uses to derive a napplet's archetype availability from its signed manifest rather
  than host-injected catalog data.

- 5015a33: feat(nip): add NIP-5A aggregate hash and NIP-5D napplet resolution

  Two new subpaths for content-addressed napplet loading:

  - **`@kehto/nip/5a`** — NIP-5A aggregate hash. `computeAggregateHash` (sorted
    `"<sha256> <abs-path>\n"` lines → sha256 hex), `pathEntriesFromTags`,
    `aggregateTagValue`, and `verifyAggregate` (recompute vs the
    `["x","<hex>","aggregate"]` tag).
  - **`@kehto/nip/5d`** — NIP-5D napplet manifest resolution. Kind constants
    `35129` (named) / `15129` (root) / `5129` (snapshot), `parseNappletManifest`,
    `verifyManifestSignature`, `verifyBlobHash`, `fetchBlob` (Blossom-by-hash,
    servers untrusted), and `resolveNapplet` — the full verify-signature → verify
    aggregate → fetch+verify blobs → assemble `/index.html` pipeline. A napplet's
    identity `(dTag, aggregateHash)` is computed from the verified bytes; any
    failure throws a typed `NappletResolutionError`.

## 0.2.0

### Minor Changes

- f5e3089: feat(nip): add NIP-65, NIP-51, and NIP-89 utilities

  Three new unique-NIP subpaths join `@kehto/nip/66`, each chosen because
  `nostr-tools` ships no equivalent and relay-aware runtimes commonly need them.
  Each NIP now lives in its own folder (`src/<n>/`) with its own README; the
  existing NIP-66 module was moved to `src/66/` to match (its public
  `@kehto/nip/66` subpath is unchanged).

  - **`@kehto/nip/65`** — NIP-65 relay lists. `parseNip65RelayList` plus a
    closure-scoped `createNip65Registry` for outbox/inbox relay resolution
    (the outbox model). Pure parser; no module-global state.
  - **`@kehto/nip/51`** — NIP-51 lists & sets. A single `parseList` handles every
    standard list (10000–10101) and set (30000–30030) — mute, bookmarks, relay
    sets, follow sets, emoji sets, curation sets — with `getTagValues` accessors
    and an injected-NIP-44-decryptor path (`decryptPrivateItems`) for private
    items, keeping the package crypto-free.
  - **`@kehto/nip/89`** — NIP-89 app-handler discovery. `parseHandlerInformation`
    (kind 31990), `parseHandlerRecommendation` (kind 31989), `handlesKind`, and
    `buildHandlerUrl` for `<bech32>` / `<raw>` URL-template expansion.

  All three are framework-agnostic, fully JSDoc'd, and covered by unit tests.
