---
status: complete
main: b57341458f22f0a7f3ff5493e0f24b5f06d0f1eb
head_before: 945c7289
---

# PR 424 conflict resolution

Merged current main, preserving #425 default rules and approval UI alongside
#424 optional rate-limit ownership. Resolved six conflicted files: STATE,
firewall index/README/docs, runtime README/docs. Added permission-rule exports
without restoring temporal exports; combined defaultDecision and opt-in limiter
documentation. Automatic Paja/runtime merges retain both policies and limiters.

Verified build/type-check, 267 unit files / 3,412 tests, strict docs for 11 packages,
132 Chromium tests (one existing skip), changeset status, lint command, diff checks,
and changed-file aislop 0.12.0 100/100. No unresolved merge entries remain.

Checked napplet/naps@43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab projection
identity/trust. Host-policy integration remains conformant; no wire changes.
Graph metadata for affected paths was stale/new; exact sources and live merge
index were inspected directly. New CI runs after push; no release is performed.
