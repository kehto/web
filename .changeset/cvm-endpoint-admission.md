---
"@kehto/services": minor
"@kehto/paja": minor
---

Bound NAP-CVM work per authenticated endpoint. `createCvmService` takes a new
`concurrency: { maxInFlight, maxQueued }` option (defaults: 8 running, 32 queued
per endpoint) covering `cvm.discover`, `cvm.request`, and `cvm.registry.*`.
Queued time counts against the request deadline (`relay timeout`), work past
both limits is refused with `policy denied`, and one endpoint's backlog never
delays another's. Slots return on result, error, timeout, `cvm.close`,
revocation, window destroy, and disposal.

Behavior changes for `@kehto/services` hosts: `cvm.close` now completes that
endpoint's pending and queued operations for the server with `session closed`
before acknowledging; `cvm.request` validates `timeoutMs` before admission; the
transport always receives the remaining `timeoutMs` and an abort signal; and a
session is recorded when a request is handed to the transport, so failed
requests no longer strand a transport session and relay hold.

Paja reads the limits from `simulation.cvm.concurrency`.
