---
"@kehto/shell": patch
---

Generate UUID v4 identifiers with `crypto.getRandomValues` when a browser omits
`crypto.randomUUID`, including non-localhost HTTP origins. Apply the same helper
to event injection, cache queries, and source-session registration. Preserve the
native method when available and fail explicitly if secure randomness is absent.
