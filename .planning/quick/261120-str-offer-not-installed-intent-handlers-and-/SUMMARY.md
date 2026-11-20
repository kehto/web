---
status: complete
quick_id: 261120-str
---

# Summary

Shipped the resolver hook, relay discovery, the chooser offer, and the App
handlers panel. Feed-style invokes with no installed handler now offer a gated
search, and picking a result runs a verified install followed by delivery.

Verification: build, type-check, 340 unit files / 4531 tests, docs:check,
aislop 100/100, intent-links e2e 21/21. The full e2e result is in the PR body.
