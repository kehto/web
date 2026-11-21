---
status: complete
quick_id: 261120-sjo
---

# Summary

`intent.invoke.result` rows with `invoke rejected` are now badged
`rejected (policy or handler)` rather than `failed, not a denial`. Other
`invoke rejected` text outside intent, plus `no handler` and `invalid
convention`, keep their existing badges.

Verification: build, type-check, 4520 unit tests, docs:check, aislop 100/100.
