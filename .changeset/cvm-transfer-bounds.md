---
"@kehto/services": minor
---

Use a five-minute CEP-22 reassembly ceiling, keep request deadlines fixed despite
progress, and fail CEP-41 closes that still have chunk gaps. Generate correlation
and ping nonce suffixes from random bytes instead of deriving keypairs. Document
outbound oversized-request limits and host-owned concurrency admission.

Requests no longer extend their timeout when progress arrives; callers must
select a sufficient duration before starting an operation.
