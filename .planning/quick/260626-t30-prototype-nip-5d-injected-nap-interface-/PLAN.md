---
id: 260626-t30
slug: prototype-nip-5d-injected-nap-interface-
status: in_progress
date: 2026-06-26
---

# Prototype NIP-5D Injected NAP Interface Domain Bootstrap

## Scope

Prototype the proposed NIP-5D change from dskvr/nips#4 in Kehto without changing
signed napplet artifact bytes.

## Plan

1. Inspect the upstream PR diff and derive concrete runtime requirements.
2. Add a host-owned shell helper that injects `window.napplet.<domain>` before
   authored scripts execute.
3. Wire the playground `srcdoc` loader through the helper using current shell
   capabilities.
4. Add focused unit/static/e2e coverage for prelude ordering, domain presence,
   and unavailable-domain omission.
5. Run focused and repo-level verification, then commit, push, and open a PR.
