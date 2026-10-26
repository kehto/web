---
phase: 114-paja-and-playground-approval-flows
plan: 04
subsystem: paja-frame-admission
tags: [paja, nip-5d, identity, lifecycle]
status: complete
---

# Phase 114 Plan 04: Paja frame admission

Resolver-verified pointers and local targets obtain separate trusted principals and enter the shared provisional-session admission transaction before executable `srcdoc`. Paja binds local development identity to exact target and computed artifact hash. Reload, navigation, replacement, and close abort the old generation; late approvals cannot inject a stale document. The admitted domain subset determines the injected namespace and environment.

## Verification

- Paja target-frame, local-loader, and runtime-tab unit tests passed.
- Paja pointer, intent, and single-window Playwright paths passed after admission wiring.
- `pnpm type-check` passed.

## Authority

Checked NIP-5D draft PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`; manifest claims are never treated as grants. NAP-SHELL master `19de5ce1cea40cd4c76089cdd8126e9f87648049` defines optional shell exposure and independent lifecycle.
