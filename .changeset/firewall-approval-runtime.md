---
'@kehto/runtime': minor
---

Add independent temporal budgets for mediated operations and approval prompts, with caller-owned clocks and lifecycle counters. Permission grants cannot bypass this evaluator.

Add scoped approval adapters, durable-write-before-grant semantics, explicit revocation recovery, and service authorization bound to immutable source principals. LINK uses this coordinator with independent rate checks and ACL ceilings. Retiring or replacing a source cancels pending approval and removes its session grants.
