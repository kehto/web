---
"@kehto/nip": minor
---

Resolve current NIP-5D single-artifact events and normalize their description, required/optional domains, and independent role/intent declarations. Retain legacy aggregate events through a separate compatibility adapter. Both schemas share signature, blob, and cache verification; the existing aggregateHash property remains a compatibility name for the verified content identity.

Warn once per resolver module lifetime after a verified legacy aggregate manifest is resolved, with an actionable republishing message.
