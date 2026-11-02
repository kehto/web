---
"@kehto/paja": minor
---

Report "no relay connection" distinctly during pointer resolution. The resolver
now tracks each relay's connection outcome (via the pool's idempotent
`ensureRelay`) alongside the manifest query. When zero relays open a WebSocket
it throws the new `PajaRelayUnreachableError` (`code: 'relay-unreachable'`,
carrying a `PajaRelayConnectionSummary`) with an actionable message — offline,
blocked relays, or the browser's WebSocket connection limit from too many open
tabs — instead of a generic "timed out", even when the deadline expires first.
Paja's pointer status shows that message and logs `paja.relay.unreachable` with
per-relay detail. Timeouts with at least one connected relay now include the
connected count; pools without `ensureRelay` keep the previous messages.
