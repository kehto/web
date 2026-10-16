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
exposes both the groups and the configured relay inventory.

`RelayPoolServiceOptions.subscribe` in `@kehto/services` now receives a fourth
`fromHint` argument so a host-backed relay service can distinguish a read pinned
by an explicit relay hint from one using its own selected relay tier. The
argument is additive and optional; existing implementations keep working.
