---
"@kehto/services": patch
---

Pass routing-author provenance as the optional fifth argument to
`OutboxRelayPool.subscribe`. NIP-65 reads name only the requested authors whose
allowed write lists selected each relay, including authors supplied through query
options. Hint and fallback reads name the requested routing authors; authorless
reads explicitly carry an empty array. This host-only metadata leaves event
filters, relay selection, and wire results unchanged. Existing pool adapters can
continue to ignore the additional optional argument.
