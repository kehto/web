---
"@kehto/services": patch
---

Prevent resource fetches after cancellation during asynchronous metadata lookup.
Capture bulk inputs, preserve cancellation ownership across duplicate IDs and
source replacement, and cancel outstanding work when the service detaches.
