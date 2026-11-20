---
"@kehto/runtime": patch
---

Scope the approval coordinator's deadline (`timeoutMs`, default 60000 ms) and
`maxPending` queue to the approval phase. An approved action no longer gets
cut off when the prompt timer fires, and an equivalent request no longer waits
for an earlier one's action to finish, only for its decision. Running actions
stay cancellable through source teardown, revocation, and the caller's signal.

This fixes NAP-CVM requests accepted with `timeoutMs` above 60000 ms ending at
60 s with `policy denied`: the napplet's duration now governs the operation and
expires as `relay timeout` (napplet/naps#31 at `28cf1bdb`, Timeouts).
