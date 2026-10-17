---
phase: 114-paja-and-playground-approval-flows
plan: 06
subsystem: paja-intent-launch
tags: [paja, intent, admission, lifecycle]
status: complete
---

# Phase 114 Plan 06: Paja intent launch

Shared-link and installed-intent Paja targets now wait for frame admission before app readiness and delivery. A pending registered target does not count as ready, and a custom launcher readiness message cannot be mistaken for target readiness. Catalog replacement, navigation, or closure rejects retained waits; a new artifact cannot inherit prior ACL or signer authority. Launch approval remains separate from one intent operation authorization.

## Verification

- Paja intent-link and single-window browser tests passed as part of the 33-test combined slice.
- Paja intent-host and runtime-tab unit tests passed; type and docs gates passed.

## Authority

Checked NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67` and the Phase 113 NAP-INTENT contract. No intent wire extension was added.
