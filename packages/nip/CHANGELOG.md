# @kehto/nip

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
