---
"@kehto/services": patch
---

Prevent resource fetches after cancellation during asynchronous metadata lookup.
Capture bulk inputs, preserve cancellation ownership across duplicate IDs and
source replacement, and cancel outstanding work when the service detaches.

Require network approval for WebSocket resolver destinations and reject unsupported
network schemes or embedded credentials before invoking transport callbacks.
