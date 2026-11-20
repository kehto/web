---
"@kehto/paja": patch
---

Report a pointer whose manifest is gone as "not found (N answered, M failed)" instead of a relay connection failure when some relays answered EOSE, with a new `PajaPointerNotFoundError`. For an addressable `nevent` whose event was replaced, Paja now offers the author's current `naddr` coordinates as a user choice (`findPajaPointerReplacements`); nothing loads until the user picks one, and that load is fully re-verified.
