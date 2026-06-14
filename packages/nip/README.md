# @kehto/nip

A tree-shakable bundle of unique Nostr NIP utilities for napplet runtimes. Each
NIP lives at its own subpath so consumers import only what they use; the package
is `sideEffects: false`, so bundlers drop any NIP that isn't referenced.

## NIPs

| Subpath | NIP | What it provides |
|---------|-----|------------------|
| `@kehto/nip/66` | NIP-66 | kind-30166 relay-discovery aggregator (`createNip66Aggregator`) |

More unique NIPs are added as their own subpath (`@kehto/nip/<n>`) over time.

## Usage

```ts
// Import only the NIP you need — nothing else is bundled.
import { createNip66Aggregator } from '@kehto/nip/66';

const aggregator = createNip66Aggregator({
  pool: myPoolAdapter,
  bootstrap: ['wss://monitor.example.com'],
});
aggregator.start();
```

A convenience barrel re-export is also available at the package root
(`@kehto/nip`), but prefer subpath imports for the smallest bundles.

## Adding a NIP

1. Add `src/<n>.ts` implementing the NIP utility (framework-agnostic, no
   module-global state, inject relay/pool concerns via interfaces).
2. Add `src/<n>.ts` to the `tsup` `entry` array and the `./<n>` `exports` entry
   in `package.json`.
3. Re-export it from `src/index.ts` for the barrel.
