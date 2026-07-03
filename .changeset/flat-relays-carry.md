---
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/paja": minor
---

Align read-style NAP event surfaces with `RelayEventResult`.

Relay and outbox read results now carry raw events as `{ event, sidecar? }`,
with observed relay URLs in `sidecar.relayHints`. Outbox subscriptions no
longer expose `outbox.eose`; streams continue until `outbox.close` or
`outbox.closed`.
