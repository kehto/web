---
"@kehto/services": minor
"@kehto/mocks": minor
"@kehto/conformance": patch
---

NAP-CVM cancellation and server-request expiry (napplet/naps#31 at `28cf1bdb`):

- A napplet's `notifications/cancelled` now names the request the transport
  actually sent. The service passes each napplet request's handle to
  `CvmTransport.request()` as `execution.handle` and hands a cancellation of an
  in-flight request to the new optional `CvmTransport.cancel()`.
  `createNostrCvmTransport` rewrites `params.requestId` to its correlation id,
  and publishes nothing once that request has settled. A transport without
  `cancel()` publishes the cancellation unchanged and warns once
  (`KEHTO_CVM_TRANSPORT_CANCEL`).
- A cancellation of the napplet's own settled request is acknowledged without
  publication. One whose `requestId` names no request of that napplet in the
  session (or is missing) is now `invalid message` and never published.
- Server requests delivered to a napplet expire after the new
  `serverRequestTimeoutMs` option (default 30000, an integer from 1 through
  300000, the NAP's Timeouts bounds); a later response is `invalid message`.
  Expired entries are pruned, so the correlation books stay bounded.
- `@kehto/mocks`: the CVM mock applies the same cancellation check and the same
  server-request expiry (`serverRequestTimeoutMs`, on its scheduler). The
  `invalid message` for a cancellation naming another id is why this is minor.
- `@kehto/conformance` adds `cvm/request-cancel-settled`, and its in-memory
  transport implements `cancel()`.
