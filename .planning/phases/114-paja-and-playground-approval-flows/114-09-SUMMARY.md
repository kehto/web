---
phase: 114-paja-and-playground-approval-flows
plan: 09
subsystem: playground-frame-admission
tags: [playground, nip-5d, identity, intent, lifecycle]
status: complete
---

# Phase 114 Plan 09: Playground verified frame admission

Playground resolves and verifies catalog artifacts, creates a trusted provisional source, and waits for shared admission before writing verified bytes into `srcdoc`. Required denial prevents execution; optional denial narrows the namespace. Source closure, catalog replacement, navigation, and revocation retire exact generations, while neighboring frames continue. Installed intent targets wait for actual readiness rather than treating a provisional session as ready. The gateway remains an accelerator, not an identity source.

Kehto offers the read-only NAP-SHELL control plane when available so its legacy ready/init host path remains live even for artifacts that do not declare it. Other interfaces still require admission. This is a host availability policy under optional NAP-SHELL, not a user grant.

## Verification

- Playground loader, gateway provenance, conformance, intent-controller, and host-proxy unit tests passed.
- Playground NAP-INC, mediated resource, installed profile intent, required denial, and grant revocation Playwright cases passed.
- Full unit suite: 2,619 tests passed; build, type, and docs gates passed.

## Authority

Checked NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-SHELL master `19de5ce1cea40cd4c76089cdd8126e9f87648049`, and NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. No gateway bytes or app-supplied identity claim can establish permission principal.
