---
'@kehto/firewall': minor
'@kehto/runtime': minor
---

Hosts can now change firewall budgets after creation. `@kehto/firewall` adds `setUnfocusedMultiplier` and `setBurstGuard`, and `FirewallStateContainer` adds methods with the same names, reachable through `runtime.firewallState`. Both throw `RangeError` on out-of-range values. A multiplier of zero is refused, because focus alone must never empty a budget. Custom `FirewallStateContainer` implementations must add both methods.
