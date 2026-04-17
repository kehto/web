---
phase: 04-shell-migration-doc
plan: "01"
subsystem: "@kehto/shell"
tags: [migration-doc, shell, envelope-guard, window-nostr, capability-advertisement]
dependency_graph:
  requires:
    - "01-02-SUMMARY.md (GAP-ANALYSIS.md sections 4, 5.3)"
    - "03-02-SUMMARY.md (RUNTIME-MIGRATION.md sections 1.3, 4)"
  provides:
    - "docs/SHELL-MIGRATION.md — SH-01, SH-02, SH-03"
  affects:
    - "@kehto/shell — shell-bridge.ts, hooks-adapter.ts, types.ts, origin-registry.ts"
    - "@napplet/shim — window.nostr proxy, shell.ready handshake (coordinated change)"
tech_stack:
  added: []
  patterns:
    - "Envelope-first guard: object check before array check"
    - "Unified iframe initialization: capabilities + services + nostr proxy injected at creation"
    - "ShellCapabilities data shape: { nubs: string[], sandbox: string[] }"
key_files:
  created:
    - docs/SHELL-MIGRATION.md
  modified: []
decisions:
  - "window.nostr injection: Option B (postMessage handshake) primary + Option A (srcdoc) fallback for shim-less napplets"
  - "originRegistry.register() enhanced with optional identity metadata { dTag, aggregateHash } for source-based identity at message entry"
  - "ShellCapabilities injected alongside window.nostr at iframe creation — unified init step for all three window.napplet components"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-07T18:38:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 04 Plan 01: Shell Migration Documentation Summary

**One-liner:** Shell-side NIP-5D migration covering envelope-first guard fix (Failure Point 1), window.nostr injection design with sandbox constraint analysis, and shell.supports() capability advertisement.

---

## What Was Built

`docs/SHELL-MIGRATION.md` with three complete sections documenting all shell migration concerns:

**Section 1 — Envelope Guard Update (SH-01):**
Covers the critical Failure Point 1 (shell-bridge.ts:155 Array.isArray guard that drops 100% of NIP-5D traffic), the new envelope-first guard pattern, sendToNapplet signature widening, ShellBridge interface changes (sendChallenge removal, injectEvent review), originRegistry enhancement for identity metadata storage, hooks-adapter deprecations, types.ts changes (SessionEntry.identitySource, AclCheckEvent.message widening), and a full affected files table.

**Section 2 — window.nostr Injection (SH-02):**
The most architecturally novel section. Documents the old kind 29001/29002 signer proxy model vs the NIP-5D MUST requirement, the sandbox constraint (allow-scripts without allow-same-origin means direct property injection, script tag injection via DOM, and parent window interception all fail), three design options with pros/cons (srcdoc bootstrap, postMessage handshake, shim-as-bootstrap), recommended approach (Option B primary + Option A fallback), NIP-07 method coverage table mapped to signer.* NUB message types, and security boundaries (ACL enforcement, consent gating, no raw key exposure, origin validation).

**Section 3 — Capability Advertisement (SH-03):**
Documents the shell.supports() stub-to-functional migration, ShellCapabilities data shape (`{ nubs: string[], sandbox: string[] }`), NIP-5A manifest requires tags interaction (pre-flight check at load time + runtime dynamic query), services.has() vs shell.supports() distinction (NUB protocol vs service extension layer), and unified injection mechanism cross-reference to Section 2.

---

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write SHELL-MIGRATION.md sections 1 and 3 | 0288c01 | docs/SHELL-MIGRATION.md (created) |
| 2 | Write SHELL-MIGRATION.md section 2 | 9842706 | docs/SHELL-MIGRATION.md (updated) |

---

## Deviations from Plan

None — plan executed exactly as written.

The napplet/ directory was empty in this worktree (no NIP-5D.md or shim source files), but the plan provided all required content inline in the `<interfaces>` block and `<context>` section. All technical content was derived from:
- GAP-ANALYSIS.md sections 4 and 5.3 (confirmed against live file)
- RUNTIME-MIGRATION.md section 4 (confirmed against live file in main repo)
- packages/shell/src/shell-bridge.ts (confirmed guard at line 155)
- packages/shell/src/hooks-adapter.ts (confirmed sendToNapplet at line 94)
- packages/shell/src/types.ts (confirmed AclCheckEvent, SessionEntry, ShellAdapter)
- packages/shell/src/origin-registry.ts (confirmed current register() signature)
- RUNTIME-SPEC.md sections 4.1–4.5 (confirmed kind 29001/29002 signer proxy model)
- ACL-MIGRATION.md (confirmed document style)

---

## Known Stubs

None — this is a documentation plan. `docs/SHELL-MIGRATION.md` is complete with substantive content in all three sections. No placeholder text or TODO stubs remain.

---

## Self-Check

## Self-Check: PASSED

- FOUND: docs/SHELL-MIGRATION.md
- FOUND: .planning/phases/04-shell-migration-doc/04-01-SUMMARY.md
- FOUND commit: 0288c01 (Task 1 — sections 1 and 3)
- FOUND commit: 9842706 (Task 2 — section 2)
