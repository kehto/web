---
"@kehto/nip": minor
---

Add an optional Cache Storage artifact cache for NIP-5D napplet resolution.
Cache hits still re-run manifest signature, aggregate, and blob hash
verification; hosts can fall back to network-only loading when browser storage
support is unavailable.
