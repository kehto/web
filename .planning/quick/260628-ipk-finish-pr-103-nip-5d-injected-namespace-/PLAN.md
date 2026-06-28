---
id: 260628-ipk
slug: finish-pr-103-nip-5d-injected-namespace-
status: in_progress
date: 2026-06-28
---

# Finish PR #103 NIP-5D Injected Namespace Closeout

## Goal

Finish PR #103 against the live NIP-5D text in `nostr-protocol/nips#2303`
after merged `dskvr/nips#4`, then push the branch so the PR is mergeable.

## Plan

1. Reconcile authoritative protocol text and current branch state:
   current NIP-5D now makes injected `window.napplet.<domain>` availability
   primary and treats `shell.supports()` as old compatibility.
2. Update stale docs/process guidance:
   `RUNTIME-SPEC.md`, `docs/policies/NIP-5D-CONFORMANCE.md`, package docs,
   playground provenance notes, and `AGENTS.md` if needed.
3. Resolve `origin/main` drift for PR #103 without absorbing unrelated work.
4. Run focused tests plus required doc/static gates, update PR #103, and push.

## Verification

- Focused namespace and playground guard tests.
- `pnpm docs:check`.
- `pnpm type-check` if source or exported API surfaces change after merge.
- `git diff --check`.
- `pnpm dlx aislop@0.9.3 scan --changes` or current pinned equivalent.
