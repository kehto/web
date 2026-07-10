---
"@kehto/acl": patch
"@kehto/cli": patch
"@kehto/firewall": patch
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Chase the published `@napplet/core` and `@napplet/nap` 0.28 line. Kehto package
peer and JSR metadata now admit the current NAP contract, local demo napplets
build against the refreshed Napplet toolchain, and `@kehto/services` implements
the current NAP-OUTBOX publish fanout fields: `relays`, `toOutbox`, and required
`toInboxes`. `@kehto/paja` also clears stale iframe ownership during target
reloads so late messages from an old frame cannot mark the runtime ready before
the reloaded target receives signer-backed identity.
