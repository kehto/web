---
phase: 114-paja-and-playground-approval-flows
plan: 08
subsystem: playground-approval-host
tags: [playground, firewall, ui, persistence]
status: complete
---

# Phase 114 Plan 08: Playground approval host

Playground now supplies the same browser approval UI and a separate versioned runtime grant store before ShellBridge construction. The panel reads live runtime grants, revokes, clears, and exposes storage failure. ACL and service controls remain ceilings/preferences; the old unused NAP-CONNECT modal and its automatic fallthrough were deleted. A host recovery control clears installed whole-app ACL blocks without synthesizing Firewall grants.

## Verification

- Playground approval-host and capability-map unit tests passed.
- Playground required-denial and revocation Playwright regressions passed; ACL recovery browser test passed.
- Full unit suite: 2,619 tests passed; type and docs gates passed at the checkpoint.

## Authority

Checked NAP-CONNECT PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`: it defines no `connect.*` postMessage consent request. The removed modal had no conformant wire caller; the shared host policy does not claim full NAP-CONNECT conformance.
