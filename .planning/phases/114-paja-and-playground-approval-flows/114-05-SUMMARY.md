---
phase: 114-paja-and-playground-approval-flows
plan: 05
subsystem: paja-development-targets
tags: [paja, development, csp, network, resource]
status: complete
---

# Phase 114 Plan 05: Paja development targets

Paja reads explicit development domain declarations from local HTML and hashes the actual fetched live-target bytes. Self-contained local artifacts may use an approved mediated resource interface under closed browser CSP. Live dev-server targets request exact directive/origin authority for scripts, styles, images, fonts, workers, media, and connections; that direct mode excludes `resource`. Required resource plus remote authority fails before launch, while optional resource is omitted. Configuration does not grant an origin. Every Paja launcher, including shared-link targets, reaches ordinary admission; no separate bench executable path exists.

## Verification

- Paja local-target, CORS, frame, and local-loader unit tests passed.
- Paja combined browser slice: 33 tests passed, including required denial, optional narrowing, revocation, and identity changes.
- Full unit suite: 2,612 tests passed at the Plan 05 checkpoint; type and docs gates passed.

## Authority

Checked NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-CONNECT PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`. Directive-specific development CSP is bounded Kehto host policy, not a claim that draft NAP-CONNECT's all-or-nothing manifest contract is implemented.
