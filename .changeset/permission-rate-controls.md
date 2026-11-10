---
'@kehto/runtime': minor
'@kehto/shell': minor
---

Hosts with `RuntimeAdapter.permissions` can now change the operation budget after creation with `runtime.permissions.setRateLimit(config)`, and read it with `runtime.permissions.rateLimit`. It covers `unfocusedMultiplier` and the startup `burst` guard, keeps running counters, and throws `RangeError` on out-of-range values. `RuntimePermissions` implementers must add both members.

`RateLimitConfig` now accepts an `unfocusedMultiplier` above 1, and a `burst.windowMs` or `burst.maxOperations` of zero. A zero window turns the guard off.

`onFirewallEvent`, `firewallPersistence` and the `runtime.firewallState` mutators act on the legacy gate only, so a runtime with `permissions` warns once with `FW-RUNTIME-LEGACY-IGNORED-001` when they're used. `getFocusContext` scales both. With `permissions`, `aclDefaultPolicy` is a ceiling that approvals can't exceed. Deferred `filterNappletMessage` envelopes meet approvals and budgets at release. `@kehto/shell` also exports `RateLimitConfig`.
