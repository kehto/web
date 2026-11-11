---
phase: 114-paja-and-playground-approval-flows
plan: 03
subsystem: paja-approval-host
tags: [paja, firewall, signer, persistence]
status: complete
---

# Phase 114 Plan 03: Paja approval host

Paja constructs its browser permission adapter before ShellBridge, routes runtime prompts through the common approval UI, and stores only the runtime's versioned grants. Revoke and clear retire matching live frames. Existing signer consent remains a distinct, bounded signing decision and cannot satisfy Firewall interface, resource, or network authority.

## Verification

- Paja permission-adapter and signer-consent unit tests passed.
- Paja intent and single-window browser slices passed (30 tests before the Plan 05 expansion).
- `pnpm type-check` and `pnpm docs:check` passed after integration.

## Authority

Checked NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-SHELL master `19de5ce1cea40cd4c76089cdd8126e9f87648049`. Paja consent presentation is host policy; no NAP wire change is claimed.
