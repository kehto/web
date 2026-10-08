---
"@kehto/paja": patch
---

Fix issue #279 by delivering capped, SHA-256-verified opaque Blossom resources
as `application/octet-stream`. Preserve byte-sniffed MIME for recognized formats,
reject active markup, and keep HTTP(S)/data resource policies unchanged.
