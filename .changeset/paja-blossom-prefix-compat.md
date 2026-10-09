---
"@kehto/paja": patch
---

Accept Blossom resource URIs with optional safe extensions, repeated `xs` server and `as` author hints, and exact positive `sz` byte verification. Preserve extensions in blob GET paths without trusting them for MIME, and reuse bounded, source-window-aware discovery through existing BUD-03 lookups. Retain extensionless and mixed-case-hash reads for both `blossom:<hash>` and `blossom:sha256:<hash>`, with the existing public-HTTPS hint/configured-loopback policy, SHA-256 verification, byte caps, and cancellation. Upload descriptors are unchanged; this is local read compatibility, not full BUD-10 conformance.
