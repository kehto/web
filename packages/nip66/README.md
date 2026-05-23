# @kehto/nip66

Framework-agnostic NIP-66 kind-30166 relay-discovery aggregator for napplet runtimes.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. This utility is independent of NIP-5D NUBs, but its integration
> points may change as Kehto and other runtimes evolve.

## Install

```bash
pnpm add @kehto/nip66 nostr-tools
```

## Overview

`@kehto/nip66` subscribes to kind-30166 ("relay status") events from a user-supplied list of monitor relays and builds two live projections as events arrive:

- **A relay-URL set** — every unique relay URL that any monitor has published a status event for (the `d`-tag on a kind-30166 event).
- **A relay → NIP-support map** — which NIP numbers each relay claims support for (the `N`-tags on a kind-30166 event).

The aggregator is **framework-agnostic**: it has zero dependencies on the napplet protocol packages or any `@kehto/*` package. Its sole peer dependency is `nostr-tools`. It accepts any relay-pool implementation that satisfies the minimal `Nip66RelayPool` interface (one method: `subscribe`), so consumers can back it with nostr-tools `SimplePool`, `applesauce-relay`, `@snort/worker-relay`, or a custom cached worker — whatever fits.

Each `createNip66Aggregator()` call returns a fresh instance with closure-scoped state. Multiple aggregators in the same process share nothing — safe for multi-tenant shells and unit tests.

**Scope boundaries (v0.1.0):**

- ✅ Kind-30166 `d`-tag URL extraction
- ✅ Kind-30166 `N`-tag NIP-support parsing (uppercase `N` only; lowercase `n` network-type tags ignored)
- ✅ Optional `#n` network-type filter (clearnet, tor, etc.)
- ✅ Resync (teardown + state clear + re-subscribe)
- ❌ NIP-77 negentropy delta sync (consumer's pool adapter handles this — v0.1 ships streaming-only)
- ❌ OPFS / worker-relay cache priming (consumer's pool adapter)
- ❌ Bundled default bootstrap relay list (policy decision — consumer supplies their own)

## Quick Start

```ts
import { createNip66Aggregator } from '@kehto/nip66';
import { SimplePool } from 'nostr-tools/pool';

const pool = new SimplePool();
const aggregator = createNip66Aggregator({
  pool: {
    subscribe: (relays, filter, onEvent) => {
      const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
      return () => sub.close();
    },
  },
  bootstrap: ['wss://monitor1.example.com', 'wss://monitor2.example.com'],
  networks: ['clearnet'], // optional — omit to receive every network
});

aggregator.start();

// Later — read the aggregated suggestion set:
const suggestions = Array.from(aggregator.getRelaySet());
// ['wss://relay.one.com', 'wss://relay.two.com', ...]

// Query NIP-77 negentropy support:
const negentropyRelays = aggregator.getRelaysSupportingNip(77);
```

## API

### `createNip66Aggregator(options)`

Construct a fresh aggregator with closure-scoped state.

**Parameters**
- `options.pool: Nip66RelayPool` — the relay-pool adapter. See [Nip66RelayPool](#nip66relaypool) for the contract.
- `options.bootstrap: ReadonlyArray<string>` — non-empty list of monitor relay URLs the aggregator subscribes against. Required; no default ships in the package.
- `options.networks?: ReadonlyArray<string>` — optional network-type filter; passed to the filter as `#n`. Omit to receive every network.

**Returns** a fresh [`Nip66Aggregator`](#nip66aggregator) handle.

```ts
export function createNip66Aggregator(options: Nip66AggregatorOptions): Nip66Aggregator;
```

### `Nip66Aggregator`

| Method | Signature | Description |
|--------|-----------|-------------|
| `start()` | `(): void` | Begin subscribing against the bootstrap relay set. Idempotent — a second call before `resync()` is a no-op. |
| `resync()` | `(): void` | Tear down the current subscription, clear accumulated state, and re-subscribe. Call when upstream `networks` semantics change. |
| `getRelaySet()` | `(): ReadonlySet<string>` | Current set of relay URLs discovered from kind-30166 `d`-tags. Empty until `start()` fires at least one event. |
| `getRelaysSupportingNip(nip)` | `(nip: number): string[]` | Relay URLs whose `N`-tags declare support for the given NIP number. |
| `relaySupportsNip(url, nip)` | `(url: string, nip: number): boolean` | `true` iff `url`'s `N`-tags include `nip`. |

```ts
export interface Nip66Aggregator {
  start(): void;
  resync(): void;
  getRelaySet(): ReadonlySet<string>;
  getRelaysSupportingNip(nip: number): string[];
  relaySupportsNip(url: string, nip: number): boolean;
}
```

### `Nip66RelayPool`

```ts
export interface Nip66RelayPool {
  subscribe(
    relays: ReadonlyArray<string>,
    filter: Nip66Filter,
    onEvent: (event: NostrEvent) => void,
  ): () => void;
}
```

A minimal relay-pool contract — one method, one callback, one unsubscribe handle. Consumers implement this against their pool library of choice. `NostrEvent` is imported from `nostr-tools`.

### `Nip66Filter`

```ts
export type Nip66Filter = { kinds: [30166]; '#n'?: ReadonlyArray<string> };
```

The filter shape the aggregator passes to `pool.subscribe`. `#n` is present iff `options.networks` was provided with length > 0.

### `Nip66AggregatorOptions`

```ts
export interface Nip66AggregatorOptions {
  pool: Nip66RelayPool;
  bootstrap: ReadonlyArray<string>;
  networks?: ReadonlyArray<string>;
}
```

See [createNip66Aggregator](#createnip66aggregatoroptions) for field descriptions.

## Integration with @kehto/shell

`@kehto/shell` declares a `relayConfig.getNip66Suggestions()` hook on the `ShellAdapter` interface (see `packages/shell/src/types.ts`). `@kehto/nip66` is the canonical way to populate it:

```ts
import { createShellAdapter } from '@kehto/shell';
import { createNip66Aggregator } from '@kehto/nip66';
import { SimplePool } from 'nostr-tools/pool';

// 1. Construct the aggregator.
const pool = new SimplePool();
const aggregator = createNip66Aggregator({
  pool: {
    subscribe: (relays, filter, onEvent) => {
      const sub = pool.subscribeMany(relays, [filter], { onevent: onEvent });
      return () => sub.close();
    },
  },
  bootstrap: [
    'wss://monitor1.example.com',
    'wss://monitor2.example.com',
  ],
});

// 2. Kick off the background subscription.
aggregator.start();

// 3. Wire the aggregator into your ShellAdapter.
const shell = createShellAdapter({
  relayConfig: {
    addRelay: (tier, url) => { /* your config store */ },
    removeRelay: (tier, url) => { /* your config store */ },
    getRelayConfig: () => myRelayTiers,
    getNip66Suggestions: () => Array.from(aggregator.getRelaySet()),
  },
  // ... other ShellAdapter hooks ...
});

// 4. (Optional) Re-sync when the user toggles network preferences.
function onNetworkToggle(_newNetworks: string[]) {
  // Options are captured by closure at factory time; rebuild the aggregator
  // when `networks` semantics change, or wrap it in your own networks-mutable
  // adapter. `resync()` tears down + re-subscribes with the current options.
  aggregator.resync();
}
```

**Why `Array.from(...)`** — the hook returns `unknown` at the shell level; pinning the shape to `string[]` at the integration site makes consumer UIs (autosuggest dropdowns, settings pages) easier to type against.

**Why a pool adapter, not a direct `SimplePool` dep** — `@kehto/nip66` is framework-agnostic. Consumers who already use `applesauce-relay`, `@snort/worker-relay`, or a custom cached worker adapt to the `Nip66RelayPool` interface in 3 lines and keep their stack.

## Scope

What this package does NOT do (and will not in v0.1.x):

- No default bootstrap relay list — which monitors are trusted is a policy decision owned by the shell, not the library.
- No negentropy (NIP-77) — bring your own pool adapter (e.g. one that wraps `applesauce-relay` or a worker-relay with negentropy support).
- No persistence — state is in-memory and dies with the aggregator.
- No scheduling — `start()` is synchronous; consumers schedule their own cadence (retry-on-drop, delayed start, etc.).
- No protocol-level `ServiceHandler` integration — this is a framework-agnostic utility, NOT a NUB domain and NOT a kehto service handler. It slots in at the `ShellAdapter.relayConfig.getNip66Suggestions` seam, not at the runtime service-registry seam.

## License

MIT
