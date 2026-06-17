# @kehto/nip

A tree-shakable bundle of **unique** Nostr NIP utilities for napplet runtimes —
the NIPs that `nostr-tools` does *not* ship but that relay-aware runtimes
commonly need. Each NIP lives in its own folder at its own subpath, so consumers
import only what they use; the package is `sideEffects: false`, so bundlers drop
any NIP that isn't referenced.

## NIPs

| Subpath | NIP | What it provides |
|---------|-----|------------------|
| [`@kehto/nip/5a`](./src/5a/README.md) | NIP-5A | aggregate hash compute/verify over `path` tags (`computeAggregateHash`, `verifyAggregate`) |
| [`@kehto/nip/5d`](./src/5d/README.md) | NIP-5D | content-addressed napplet manifest resolution — parse, verify sig + aggregate + Blossom blobs (`resolveNapplet`) |
| [`@kehto/nip/51`](./src/51/README.md) | NIP-51 | lists & sets parser — mute/bookmarks/relay-sets/emoji-sets/… (`parseList`) |
| [`@kehto/nip/65`](./src/65/README.md) | NIP-65 | relay-list (kind 10002) parsing + outbox/inbox resolution (`createNip65Registry`) |
| [`@kehto/nip/66`](./src/66/README.md) | NIP-66 | kind-30166 relay-discovery aggregator (`createNip66Aggregator`) |
| [`@kehto/nip/89`](./src/89/README.md) | NIP-89 | app-handler discovery (kind 31989/31990) (`parseHandlerInformation`) |

Each subpath has its own README with full API docs and examples (linked above).
More unique NIPs are added as their own subpath (`@kehto/nip/<n>`) over time.

## Selection criteria

A NIP earns a place here only if it is:

1. **Unique** — not already provided by `nostr-tools` (re-wrapping `nip04`,
   `nip19`, `nip25`, `nip44`, `nip57`, … would be a no-op package).
2. **Broadly needed** — likely required by many runtimes, not just one app.
3. **Substantive** — handles a real common case in a widely-compatible way, with
   no framework coupling and no module-global state.

## Usage

```ts
// Import only the NIP you need — nothing else is bundled.
import { createNip65Registry } from '@kehto/nip/65';

const registry = createNip65Registry();
registry.ingest(kind10002Event);
const outbox = registry.resolveOutboxRelays([authorPubkey]);
```

A convenience barrel re-export is also available at the package root
(`@kehto/nip`), but prefer subpath imports for the smallest bundles.

## Conventions

Every NIP module is:

- **Pure / framework-agnostic** — no Svelte/React, no DOM assumptions, no relay
  library baked in. Relay pools, signers, and decryptors are injected via small
  interfaces.
- **Multi-instance safe** — stateful helpers are closure-scoped factories
  (`create*`), never module globals, so multiple runtimes in one process never
  alias each other.
- **Fully documented** — all public exports carry JSDoc with `@param`,
  `@returns`, and `@example`.

## Adding a NIP

1. Create `src/<n>/index.ts` implementing the NIP utility (framework-agnostic, no
   module-global state, inject relay/pool/crypto concerns via interfaces).
2. Add `src/<n>/index.test.ts` with unit tests and `src/<n>/README.md` with API docs.
3. Add `src/<n>/index.ts` to the `tsup` `entry` array and a `./<n>` entry to
   `exports` in `package.json`.
4. Re-export it from `src/index.ts` for the barrel, and add the
   `@kehto/nip/<n>` alias to the repo `vitest.config.ts`.
5. Add a row to the table above.
