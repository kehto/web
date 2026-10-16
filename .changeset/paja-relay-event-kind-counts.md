---
"@kehto/paja": minor
"@kehto/services": minor
---

Add a collapsible **Events** section to the Paja console below **Messages** that
groups relay receipts by the routing box that chose the relays, then by relay,
then by event kind. Boxes render in fixed routing precedence rather than by
size, so they never reshuffle mid-session:

- **outbox relays (NIP-65)** — relays resolved from the requested authors'
  NIP-65 write lists. A session that never used author routing renders
  `no author-routed reads` instead of a bare zero, because author-routed relays
  are discovered per read and cannot be listed from configuration.
- **relay hints** — an outbox read the napplet pointed at relays itself with
  NAP-OUTBOX `relays` hints.
- **fallback relays** — the host's configured set, read when no list or hint
  resolved. Configured relays are listed from boot, so idle relays read `unused`
  and relays that answered with nothing read `silent`.
- **scoped relay** — a read the napplet pinned to one relay with NAP-RELAY
  `relay.subscribe`'s `relay` field, which the NAP calls a scoped relay rather
  than a hint.
- **host pool** — Paja's own reads.

A box is a routing decision, not a relay set: a relay read for two different
reasons (for example a relay that is both an app hint and a configured fallback)
now appears in both boxes with its receipt counts kept apart, instead of showing
one merged count under two chips. Because exactly one box owns each receipt, box
counts add up to the header total. Each relay row keeps its bar (scaled against
the busiest relay of the session), receipt count, and `kind - count` rows.
Counting happens in the relay backend before delivery, covering napplet
subscriptions and Paja's background fetches, while simulated memory-mode
fixtures and Paja's own publishes stay excluded. Receipts are cumulative for the
host session; the header badge's tooltip separates them from unique events, and
`__KEHTO_PAJA__.getState()` exposes the boxes and the configured relay
inventory. Count verified, filter-matching receipts at each relay before
deduplicating napplet delivery; repeated events count again without crediting
silent relays or reusing earlier reads' provenance. Equivalent relay URL
spellings share one panel row.

Two additive, optional `@kehto/services` arguments make the routing boxes
possible: `RelayPoolServiceOptions.subscribe` now receives a fourth `fromHint`
argument so a host-backed relay service can distinguish a read pinned by an
explicit relay hint from one using its own selected relay tier, and
`OutboxRelayPool.subscribe` receives an `OutboxRelayOrigin` naming why the relays
of that call are in the read. Existing implementations keep working unchanged.
Authorless live reads retain their hint-or-fallback routing policy: valid hints
do not add subscriptions on the configured fallback relays.
