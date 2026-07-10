---
"@kehto/paja": patch
---

Make the static Paja Runtime useful for loading multiple pointer-resolved
napplets by adding closeable runtime tabs and a duplicate-load choice dialog.
Paja now defaults to a real live relay/outbox backend, bootstraps NIP-65 relay
lists and kind 3 contact lists for account-backed napplet tests, and only uses
the generated development signer when explicitly selected.
