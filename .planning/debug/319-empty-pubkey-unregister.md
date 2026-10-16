---
status: investigating
trigger: "Resolve #319: unregister leaves empty-pubkey sessions registered"
created: 2026-10-16
updated: 2026-10-16
---

## Symptoms

The public SessionRegistry removes the window entry but retains isRegistered,
getPubkey, and pubkey lookup state after unregistering a pubkey="" session.
The nonempty control cleans up. The issue supplies a public-package repro.

## Current Focus

hypothesis: unregister's truthiness check skips the valid empty-string index.
next_action: reproduce all public lookup outcomes, then fix cleanup and verify sibling isolation.

## Evidence and authority

- origin/main baseline: c3a19015fb705569eb1ca7fe297bf5a535bb3214.
- Graph discovery identified createSessionRegistry; unregister uses `if (pubkey)`.
- Checked napplet/naps master 19de5ce1cea40cd4c76089cdd8126e9f87648049,
  naps/NAP-SHELL.md and projections/web.md before changing tests or source.
  Source-bound endpoint lifetimes are the relevant contract. Registry indexes
  are host implementation details; empty pubkeys are supported Kehto state.
- The current upstream shell is optional and descriptive. The repository's
  mandatory-handshake guidance has broader upstream drift; this narrow cleanup
  does not change handshake policy or claim whole-runtime conformance.
- GSD debug runs inline in its own worktree. Primary package.json WIP is untouched.
