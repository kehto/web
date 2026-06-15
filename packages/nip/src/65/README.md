# `@kehto/nip/65` — NIP-65 relay lists & the outbox model

Parse [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) kind-10002
relay-list events and resolve **outbox** (write) and **inbox** (read) relays for a
set of authors.

`nostr-tools` ships no NIP-65 helper, so this fills the gap. The parser is pure;
state lives in a closure-scoped **registry** (no module globals — two registries
in one process never alias each other).

## Why

The outbox model is how you *reach* someone on Nostr without a central relay:
publish to (or read from) the relays that author advertised in their kind-10002
event. Almost every relay-aware runtime needs this.

## API

| Export | Kind | Description |
|--------|------|-------------|
| `parseNip65RelayList(event)` | pure | kind-10002 → `RelayEntry[]` (`{ url, read, write }`) |
| `selectWriteRelays(entries)` | pure | de-duplicated write URLs of one list |
| `selectReadRelays(entries)` | pure | de-duplicated read URLs of one list |
| `createNip65Registry()` | factory | closure-scoped store + outbox/inbox resolution |

### Tag grammar

```text
["r", "wss://relay.example.com"]          → read AND write
["r", "wss://relay.example.com", "read"]  → read-only
["r", "wss://relay.example.com", "write"] → write-only
```

An unknown marker is treated as unmarked (read + write) so a listed relay is
never silently dropped. No URL normalization is performed — pair with
`@kehto/nip/66` if you need canonical hostnames.

## Usage

```ts
import { createNip65Registry } from '@kehto/nip/65';
import { SimplePool } from 'nostr-tools/pool';

const registry = createNip65Registry();
const pool = new SimplePool();

pool.subscribeMany(discoveryRelays, [{ kinds: [10002], authors }], {
  onevent: (e) => registry.ingest(e), // stores by e.pubkey, replaceable
});

// Before publishing on behalf of an author, target their outbox relays:
const outbox = registry.resolveOutboxRelays([authorPubkey]);
// Reading their notes? Use their inbox relays:
const inbox = registry.resolveReadRelays([authorPubkey]);
```

Stateless, one-shot usage without the registry:

```ts
import { parseNip65RelayList, selectWriteRelays } from '@kehto/nip/65';
const outbox = selectWriteRelays(parseNip65RelayList(kind10002Event));
```
