---
"@kehto/services": minor
---

Bound CEP-22 reassembly by the request deadline (at most five minutes), keep
deadlines fixed despite progress, and fail CEP-41 closes that still have chunk
gaps. Generate correlation and ping nonce suffixes from random bytes instead of deriving keypairs. Document
outbound oversized-request limits and host-owned concurrency admission.

Requests no longer extend their timeout when progress arrives; callers must
select a sufficient duration before starting an operation.

Reject invalid timeout durations before acquiring sessions or publishing. Include
initialization, shared-init waits and initialized-notification publication in the
original request budget, preserving `relay timeout` on expiry.
