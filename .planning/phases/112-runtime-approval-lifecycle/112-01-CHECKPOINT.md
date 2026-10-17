# Runtime coordinator checkpoint

Status: plan 112-01 remains in progress. This is an internal implementation
checkpoint, not a completed runtime migration or a public API release.

`packages/runtime/src/approval-coordinator.ts` holds operations until the pure
Firewall policy grants their composed scopes. It snapshots normalized scopes and
principal data, uses host-generated request tokens, serializes equivalent prompts,
and consumes once grants immediately before invoking the action. Session approvals
release queued equivalents through individual revalidation. Session denials are
remembered; development principals cannot receive persistent grants.

The host supplies state access, synchronous commit, cancellation, and scheduling.
A durable commit must persist before publishing the new state and throw on failure.
Cancellation settles a request even when the host prompt never resolves. Late
prompt decisions cannot create grants. Actions receive a cancellation signal;
domain adapters must use it at their asynchronous side-effect boundaries.

Pending operations are bounded and have deadlines, including time spent queued.
Policy replacement invalidates a pending prompt; source/lifecycle validation runs
again immediately before action invocation and result delivery. Hosts must invoke
cancel on revocation or session retirement to abort active work immediately.

Authority: re-read NAP-LINK PR 53 at
`50a2cd45e76f06e87b87e93842badf4c61f17bde` and NAP-RESOURCE PR 80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` from the recorded exact-ref copies.
This module implements host coordination policy, introduces no wire fields, and
does not claim integrated protocol conformance. Domain response adapters remain
responsible for their canonical result/error/cancellation contracts.

Verification: 16 coordinator regressions; full unit suite 179 files / 2,298 tests;
runtime type check; changed-file quality score 100; git diff whitespace check.
Logs: `/tmp/kehto-firewall-coordinator-{unit.log,quality.json}`.

Remaining plan work: persistence container and revocation ownership; trusted
principal propagation; runtime ingress and registered extension integration;
rate gate wiring; immutable wire snapshots/replay handling; domain response and
delivery lifetime checks; public exports and host adapters; integration tests and
docs. Service scope enforcement and Paja/playground remain phases 113 and 114.
Do not treat this coordinator's presence as evidence those consumers enforce it.
