---
quick_id: 261102-g2n
status: complete
date: 2026-11-02
---
# Summary — Paja "zero relays connected" status

`resolvePajaPointer` tracks per-relay connection outcomes via the pool's
idempotent `ensureRelay`. Zero connected -> `PajaRelayUnreachableError`
(`code: 'relay-unreachable'`, `PajaRelayConnectionSummary`) with an actionable
message, thrown ahead of the deadline check so starvation never reads as
"timed out". Host shows it as the pointer status and logs
`paja.relay.unreachable`. Partial connectivity keeps existing messages (+
connected count); pools without `ensureRelay` unchanged.

Verification: build, type-check, test:unit (2285), docs:check, slop 95/100
(= main), e2e 110/110 incl. new `paja-relay-unreachable.spec.ts` (real
closed-port WebSocket in Chromium + routed-relay control). Commits cea679bb
(feature) + e2e test commit. Follow-up candidate: connected-relay count in
the live relay panel for post-load failures.
