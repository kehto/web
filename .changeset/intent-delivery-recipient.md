---
"@kehto/acl": patch
---

Map runtime-originated `intent.deliver` pushes to recipient `intent:read` so eligible targets can receive deliveries through `ServiceRuntimeContext.sendToEligibleNapplet` without an INC capability.
