---
"@kehto/services": minor
"@kehto/mocks": patch
"@kehto/conformance": patch
"@kehto/shell": patch
---

Close the remaining NAP-CVM `cvm.request` lifecycle gaps (napplet/naps#31 at
`28cf1bdb`, Message handling and Errors):

- Notifications and responses complete on publication with a result that has
  only `type` and `id`, and no MCP response is awaited. `CvmTransport` gains an
  optional `publish()` that sends the message as given, and
  `createNostrCvmTransport` implements it under the request deadline. A
  transport without `publish()` falls back to `request()` and warns once
  (`KEHTO_CVM_TRANSPORT_PUBLISH`).
- A client request id already used in the session, and a response matching no
  server request delivered to that napplet, return `invalid message` before
  approval or publication.
- A malformed `server` reference returns `invalid request` on `cvm.request` and
  `cvm.close`, instead of `server not found` and `session closed`.

The injected `window.napplet.cvm.request()` in `@kehto/shell` resolves `null`
for a notification or response instead of rejecting on the missing `message`.
`@kehto/mocks` matches server-request ids by type as well as value, like the
service. `@kehto/conformance` adds `cvm/semantics` cases for each rule,
including a server-request push answered by a napplet response.
