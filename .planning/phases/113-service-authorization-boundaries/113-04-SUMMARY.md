---
phase: 113-service-authorization-boundaries
plan: "04"
subsystem: outbox-count-authorization
tags: [outbox, count, firewall, relay]
requires: [113-19]
provides: [approved-outbox-plans, approved-count-plans]
status: complete
---

# Phase 113 Plan 04: OUTBOX and COUNT Authorization Summary

OUTBOX and COUNT now resolve relay destinations before runtime approval and execute only the approved destination snapshot.

## Protocol Authority

Checked NAP-OUTBOX PR #32 at `8865f73d52a4864afee145f28d26520476273927`, NAP-COUNT PR #69 at `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf`, and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`.

## Delivered

- Added side-effect-free OUTBOX read and publish plans, explicit exact-plan query/publish/subscribe execution, signer identity binding, and revocation cleanup.
- COUNT now distinguishes local work from remote planned relays, passes frozen relays and approval cancellation to its backend, and suppresses late results after revoke/teardown.

## Evidence

- `8df05320`, `4ccb9d0f`, `5400fce3`, `8a49fdbf`, `295e03bf`, `336762ac`, `97008aa5`, `6b57ccfa`, `3a013c2d`, `b0894f57`, `982b9292`, `1e0e2442`.
- Focused OUTBOX/COUNT suite: 78 tests passed; services type-check passed before final COUNT lifecycle addition, whose focused tests also passed.

## Self-Check: PASSED

Plan-owned source, test, documentation, changeset, and summary artifacts exist on the phase branch.
