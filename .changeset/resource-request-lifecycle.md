---
"@kehto/services": patch
---

Prevent resource fetches after cancellation during asynchronous metadata lookup.
Capture bulk inputs, preserve cancellation ownership across duplicate IDs and
source replacement, and cancel outstanding work when the service detaches.

Require network approval for WebSocket resolver destinations and reject unsupported
network schemes or embedded credentials before invoking transport callbacks.

Retain the latest 1,024 completed resource IDs per source window to suppress
repeated side effects and terminal responses, while preserving cancellation and
clearing replay history on source destruction or service detachment.
