---
status: complete
completed: 2026-06-11
---

# Sync NAP identity to loaded napplets

## Outcome

Completed and shipped. Commit `9afcda8` added recipient-gated `identity.changed`
publication, signer-transition fanout, feed integration, and fresh
`identity.getPublicKey` resolution. Commit `3f22b27` supplied reload and restored-signer
browser proof. Phase 103 later hardened and reverified the same contract.

## Verification

- Current `ShellBridge` fanout remains recipient-gated and deduplicated.
- The identity service resolves the signer afresh for each request.
- The playground publishes exact signer transitions.
- The signer-persistence Playwright coverage proves reload and feed behavior.
