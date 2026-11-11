---
phase: 114-paja-and-playground-approval-flows
plan: 02
subsystem: browser-approval-presentation
tags: [shell, approvals, accessibility, grant-management]
dependency_graph:
  requires: [114-01]
  provides: [common-browser-approval-ui]
  affects: [paja, playground]
status: complete
---

# Phase 114 Plan 02: common approval presentation

`createBrowserApprovalUi` supplies a framework-free dialog for runtime-owned prompts and a live grant-management view. The prompt shows the host's trusted label and complete principal identity, each exact operation/scope, the mediated-versus-direct traffic boundary, and only lifetimes offered by the runtime coordinator. Deny is focused first; an allow requires choosing a lifetime. Escape, close, abort, and destruction return explicit cancellation without a denial grant. The runtime coordinator now accepts that cancellation answer without persistence or execution.

Grant rows are regenerated from `RuntimePermissions.grants`. Revoke, clear, and retry call runtime methods, with retirement and storage-state observers for hosts. A storage failure remains visible and blocks new grants until runtime persistence recovers; the UI has no permission evaluator or grant mirror.

## Verification

- `pnpm exec vitest run packages/runtime/src/approval-coordinator.test.ts packages/shell/src/browser-approval-ui.test.ts` — 30 tests passed, including exact identity/scope display, offered lifetime, cancellation, grant management, and persistence recovery.
- Runtime/shell builds and shell type-check passed; `pnpm docs:check` passed.
- Changed-file `aislop@0.12.0` scan scored 100/100.

## Authority

This presentation layer changes no NAP wire messages. Phase 114's checked NIP-5D PR #2303 `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-CONNECT PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` remain the authority for the host launch and resource/network constraints carried into later plans. The exact UI wording and cancellation answer are Kehto host behavior, not new protocol wire semantics.
