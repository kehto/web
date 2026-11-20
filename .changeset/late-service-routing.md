---
"@kehto/runtime": minor
"@kehto/shell": minor
---

Keep service advertisement in step with routing. The runtime gains `hasService(name)`, and a bound shell bridge now advertises a declared service only while its runtime routes it. A handler added to `ShellAdapter.services` after `createShellBridge()` is no longer advertised until it is registered with `bridge.runtime.registerService()`; the shell logs `[KEHTO_SERVICE_NOT_REGISTERED]` once instead. A request for a service-only domain with no handler is still ignored on the wire, as NIP-5D requires, and the runtime now logs `[KEHTO_UNROUTED_SERVICE_DOMAIN]` once per domain.
