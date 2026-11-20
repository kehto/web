---
"@kehto/services": patch
---

`cvm.request` now validates its MCP `message` against the NAP-CVM form table
(napplet/naps#31 @ 28cf1bdb) before admission. A missing message, a batch, an
invalid id (`null`, boolean, fractional), an empty method, non-object params or
an invalid field combination (both `result` and `error`, a response with
`params`, neither `method` nor `id`, …) now returns `invalid message` instead of
`unsupported method` or being published. Rejected messages are never authorized,
admitted or handed to the transport. `CvmTransportError` gains `'invalid message'`.
