# `@kehto/nip/66` — NIP-66 relay discovery

A [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) kind-30166
relay-discovery aggregator. Subscribes to relay-monitor announcements, extracts
relay URLs from `d` tags, and tracks which NIP numbers each relay declares
support for (`N` tags) plus ad hoc relay attributes.

`nostr-tools` ships no NIP-66 helper. State is closure-scoped (no module
globals — each `createNip66Aggregator` call owns its own `Set`/`Map`, so multiple
aggregators in one process never alias each other). The pool is injected, so the
aggregator is framework- and library-agnostic.

## API

| Export | Description |
|--------|-------------|
| `createNip66Aggregator(options)` | factory → `Nip66Aggregator` handle |
| `DEFAULT_RELAY_ATTRIBUTE_GROUPS` | built-in `Indexer` / `RelayIndexer` attribute groups |

The aggregator handle exposes `start` / `stop` / `resync`, `getRelaySet`,
`getRelaysSupportingNip` / `relaySupportsNip`, and the attribute queries
`getRelayAttributes` / `getRelaysMatchingAttributes` / `getRelaysForAttributeGroup`.

## Usage

```ts
import { createNip66Aggregator } from '@kehto/nip/66';
import { SimplePool } from 'nostr-tools/pool';

const pool = new SimplePool();
const aggregator = createNip66Aggregator({
  pool: {
    subscribe: (relays, filter, onEvent) => {
      const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
      return () => sub.close();
    },
  },
  bootstrap: ['wss://monitor.example.com'],
  // networks: ['clearnet'], // optional #n narrowing
});

aggregator.start();
const relays = Array.from(aggregator.getRelaySet());
const nip44Relays = aggregator.getRelaysSupportingNip(44);

// Wire stop() to your teardown path (beforeunload / effect cleanup / before-quit).
aggregator.stop();
```

You supply a minimal `Nip66RelayPool` adapter (one `subscribe`, one unsubscribe
handle) over your pool library of choice — `nostr-tools` `SimplePool`,
`applesauce-relay`, `@snort/worker-relay`, etc.
