---
phase: quick-260804-dql
status: complete
completed: 2026-08-04
---

# Quick Task 260804-dql Summary

Reopened after a general PR comment containing C22–C26 was found outside the
review-thread API. Plan 08 assessed and closed those claims with two regressions,
one CONFIG fix, one cleanup, and a release-note clarification. The evidence reply
is https://github.com/kehto/web/pull/234#issuecomment-5178362244.

Assessed all 26 claims across the 16 live review threads and one general comment on kehto/web#234
against their exact immutable NAP/NIP authorities and current code. Every claim
was valid or valid hardening; the two similar filesystem findings shared a root
cause but required separate service/backend fixes, and the notification finding
was corrected from its mislocated review anchor to the owning service.

Implemented focused regressions and atomic fixes for relay policy, pubkey
normalization, filesystem allocation limits, serial/BLE recovery, FS/DM/serial/
notification lifecycle races, CONFIG/NOTIFY host boundaries, conformance proof,
and stale documentation/planning evidence. The existing five-package changeset
already covered all publishable output changes.

All 16 threads received authority- and commit-specific evidence replies and were
resolved or dismissed with evidence. Source head `62580e11fbf8d6e486ba59a85f3ea859d9a1bb12`
passed CI run 30904927876 and Changeset Guard 30904927931. Local verification
also passed build, type-check, 1,678 unit tests, 81 E2E tests, docs, CSP,
AI-slop 100/100, and diff hygiene.

Independent GSD verification passed 4/4 must-haves.
