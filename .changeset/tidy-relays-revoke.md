---
"@kehto/runtime": patch
---

Retire ordinary relay subscriptions when relay read access is revoked or a
principal is blocked. Close both registered service and adapter subscriptions,
and prevent queued callbacks from delivering after revocation or subId reuse.
