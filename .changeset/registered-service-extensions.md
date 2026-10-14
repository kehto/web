---
"@kehto/runtime": minor
---

Add explicit registered-service routing for host extension domains. Handlers declare exact inbound message capabilities; the runtime enforces live source identity, explicit domain grants, ACLs, and firewall policy, and invalidates delayed replies after replacement or teardown. Unknown messages remain silent and built-in NAP routes retain their existing contracts.
