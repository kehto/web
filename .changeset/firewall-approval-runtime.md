---
'@kehto/runtime': minor
---

Add independent temporal budgets for mediated operations and approval prompts, with caller-owned clocks and lifecycle counters. Permission grants cannot bypass this evaluator.

Add scoped approval adapters, durable-write-before-grant semantics, explicit revocation recovery, and service authorization bound to immutable source principals. LINK uses this coordinator with independent rate checks and ACL ceilings. Retiring or replacing a source cancels pending approval and removes its session grants.

Add pre-execution required/optional interface admission with generation-bound revalidation. Enforce shared interface approvals on built-in dispatch and registered extensions. Extensions capture bounded immutable JSON, reject replayed IDs, retain host-owned denial schemas, and apply independent blocking prompt-spam budgets.

Allow services to cancel one pending or active authorization using a request signal, without cancelling sibling work or accepting late grants. Preserve equivalent-request ordering and bound retained cancelled queue entries.

Invalidate pending extension approval when its host capability declaration changes.
