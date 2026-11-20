---
"@kehto/services": minor
---

NAP-CVM: a napplet's `notifications/cancelled` now ends its own request in the
shell (napplet/naps#31 at `28cf1bdb`):

- A request still queued for admission or awaiting approval is dropped before
  publication. It never reaches the transport and its approval prompt is
  withdrawn. Before, the cancellation was lost and the request went out anyway.
- A request already handed to the transport still gets the mapped cancellation
  through `CvmTransport.cancel()`, and is then settled locally. A late server
  answer is ignored.
- The cancelled `cvm.request` settles with `session closed` before the
  cancellation is acknowledged. Before, it waited for the server's answer or
  `relay timeout`. NAP-CVM names no cancellation error; this is a documented
  spec-gap decision.
- A cancellation no longer takes an admission slot, so a saturated endpoint can
  still cancel its own work.
