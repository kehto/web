---
"@kehto/paja": minor
"@kehto/services": minor
---

Add a collapsible **Events** section to the Paja console below **Messages** that
groups relay receipts by why Paja opened the read — **outbox** (NIP-65 author
write relays or the configured fallback set), **relay hints** (a relay the
napplet pinned with an explicit NAP-RELAY `relay.subscribe` hint), and **host
pool** (Paja's own reads) — then lists each relay with a bar scaled against the
busiest relay of the session, its receipt count, and its `kind - count` rows.
Configured outbox relays are listed from boot, so idle relays read `unused` and
relays that answered with nothing read `silent`. Counting happens in the relay
backend before delivery, covering napplet subscriptions and Paja's background
fetches, while simulated memory-mode fixtures and Paja's own publishes stay
excluded. Receipts are cumulative for the host session; the header badge's
tooltip separates them from unique events, and `__KEHTO_PAJA__.getState()`
exposes both the groups and the configured relay inventory. Count verified,
filter-matching receipts at each relay before deduplicating napplet delivery;
repeated events count again without crediting silent relays or reusing earlier
reads' provenance. Equivalent relay URL spellings share one panel row.

Every relay inside the outbox group also carries a chip naming why it was in the
plan — `nip65` for an author's NIP-65 write relay, `plan hint` for a relay the
read supplied, `fallback` for the configured set — so an outbox read reports its
routing instead of implying author routing.

Two additive, optional `@kehto/services` arguments make that possible:
`RelayPoolServiceOptions.subscribe` now receives a fourth `fromHint` argument so
a host-backed relay service can distinguish a read pinned by an explicit relay
hint from one using its own selected relay tier, and
`OutboxRelayPool.subscribe` receives an `OutboxRelayOrigin` naming why the relays
of that call are in the read. Existing implementations keep working unchanged.
Authorless live reads retain their hint-or-fallback routing policy: valid hints
do not add subscriptions on the configured fallback relays.
