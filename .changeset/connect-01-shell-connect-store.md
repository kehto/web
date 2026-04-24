---
"@kehto/shell": minor
---

NUB-CONNECT (v1.7 Phase 39): new `connectStore` singleton and `ShellBridge.connectStore` public surface.

The store persists per-napplet connect grants keyed on `(dTag, aggregateHash)` under localStorage key `napplet:connect`. Surface: `grant`, `revoke`, `check`, `getOrigins`, `getAllGrants`, `persist`, `load`, `clear`.

The composite key enforces CONNECT-06: a napplet rebuild with a new aggregate hash cannot inherit prior grants silently — the new hash has no entry, `check()` returns `false`.

Additionally exports `ConnectGrant`, `ConnectGrantKey`, `ConnectConsentRequest`, and `ConsentResult` types from `./types/provisional-connect.ts` (provisional — swap to `@napplet/nub/connect` when upstream publishes at `^0.3.0`).

Minor bump: additive public API. No breaking changes.
