---
mode: quick
status: complete
---
# Address PR #315 review

Authority: NAP-CVM draft #31 at napplet/naps@28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f, Timeouts; CEP-41 at contextvm/contextvm-docs@3b4f9dc9f9012a418abd9faec6a70db774754862. Both rechecked 2026-10-27.

1. Merge current origin/main into the existing PR branch, retaining CVM and UPLOAD documentation. Preserve unrelated primary-checkout edits.
2. Reject malformed/out-of-range request timeouts before session/relay acquisition. Apply one absolute deadline across shared initialization, initialized notification publication, and final response. Preserve relay timeout and prevent late initialization from continuing expired operations.
3. Remove unreachable independent reassembly lifetime timer; request deadline caps buffers. Correct documentation, test name, entropy assertion, dead comments/spacing and prerequisite PR attribution (#314). Track host concurrency admission separately. Preserve existing services changeset.
4. Prove admission boundaries, resource inactivity, cumulative timeout, stalled notification publication, short shared-init waiter, timeout error and late-response lifecycle with fake-clock encrypted transport regressions. Run build, type-check, unit, docs and AI-slop gates (and relevant browser proof). Commit and push to PR #315; update body with authority and exact limits.

Execution inline per Codex skill adapter; no user request for subagents.
