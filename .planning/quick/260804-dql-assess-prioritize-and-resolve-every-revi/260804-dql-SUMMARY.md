---
phase: quick-260804-dql
status: reopened
completed: 2026-08-04
---

# Quick Task 260804-dql Summary

Reopened after a general PR comment containing C22–C26 was found outside the
review-thread API. Plan 08 owns the follow-up; the completion record below applies
to C01–C21 and will be reconciled again after the new claims are closed. Local
Plan 08 implementation and all full gates pass; remote push, reply, live audit,
and exact-head CI remain.

Assessed all 21 claims across the 16 live review threads on kehto/web#234
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
resolved. Source head `0c1afc14e23def27821532963a336230c889d636`
passed CI run 30900620514 and Changeset Guard 30900620528. Local verification
also passed build, type-check, 1,674 unit tests, 81 E2E tests, docs, CSP,
AI-slop 100/100, and diff hygiene.

Independent GSD verification passed 4/4 must-haves.
