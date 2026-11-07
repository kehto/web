---
"@kehto/runtime": patch
---

Add `ServiceHandler.pushCapabilities`: a registered service outside the built-in
dispatcher can declare the exact shell -> napplet push types it emits (each
mapped to the recipient's ACL capability or explicit `null`), and
`ServiceRuntimeContext.sendToEligibleNapplet` delivers them under the same
gates as inbound extension routing (registered handler, live unblocked source,
explicit `isDomainAllowed` grant, declared capability). Built-in domains keep
their canonical recipient mapping; undeclared types are still refused.

When a registered `relay` service accepts a `relay.publish`, that service now
owns storage and fan-out of the event. The runtime ring buffer no longer
re-delivers it, which previously skipped the publisher's own subscriptions,
ignored per-subscription relay scope, and sent every other window a second
legacy `['EVENT', …]` copy. Publishes coordinated by the runtime through the
adapter relay pool keep the buffer fan-out.
