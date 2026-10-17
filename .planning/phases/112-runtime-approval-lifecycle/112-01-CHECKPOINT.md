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
Relevant prerequisite removal invalidates a pending prompt; source/lifecycle validation runs
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

## Runtime, shell, and LINK integration checkpoint

The internal coordinator is now used through `RuntimeAdapter.permissions`,
`ShellAdapter.permissions`, and the registered service authorization context.
`permission-state.ts` loads versioned grants, saves before publishing durable
authority, revokes locally before persistence, and disables authorization until
a failed revocation is durably retried. Failed loading requires explicit clearing.

`permission-runtime.ts` binds operations to source-owned principal snapshots and
fresh runtime session generations. Independent rates precede prompting, retain
operation budgets across source replacement, and expose payload-free diagnostics.
ACL blocking and capability checks remain hard ceilings. Replacing/unregistering
a source or service cancels its pending approvals. Service authorization contexts
are bound to the particular attachment, including replacement by the same object.

Trusted principal metadata now travels through origin registry, identity hook,
shell registration, and runtime session registry. Registry data is detached and
frozen. No identity is read from a NAP envelope. The artifact must match the
registered session hash. Old tuples cannot authorize the new path.

Moved the LINK portion of phase 113 forward to validate the coordinator through a
real service. The reference service validates schemes and captures exact URL/ID/
label before asynchronous work. It uses composed interface/resource grants,
returns canonical outcomes, bounds replay history, ignores unknown methods, and
never permits forbidden schemes through host configuration. Live-source
revocation retains correlation/replay history; source retirement drops stale
results. Its host-only opener compatibility path emits FW-LINK-LEGACY-001 once
per service instance and is centrally tracked with runtime tests.

Updated public exports, runtime/shell/services package documentation, a shared
approval guide, the compatibility register, and changesets. Extracted runtime
service interfaces into service-types.ts to preserve the repository quality gate.

Verification on 2026-10-17:
- Full unit suite: 181 files / 2,323 tests pass.
- Build and type-check pass; strict TypeDoc, VitePress, and nine-package docs audit pass.
- Browser regression suite: 125 pass. The initial command timed out starting a
  configured web server; explicitly started this worktree's preview servers and
  reran Playwright successfully. Stopped both owned preview servers afterward.
- Quality score 100 and git diff whitespace check pass.
- Logs: `/tmp/kehto-firewall-link-{unit,build,types,docs}.log`,
  `/tmp/kehto-firewall-link-e2e-retry.log`, and
  `/tmp/kehto-firewall-link-quality.json`.

Remaining: the shared path is enabled only for configured hosts and LINK so far.
General ingress and registered extension migration, all other service scopes,
pre-execution interface admission, Paja/playground UI/settings, and direct-network
policy remain unfinished. The old gate and duplicate temporal implementation
still need retirement or explicit bounded compatibility. Review the interim
onPermissionRevoked fallback and policy-change cancellation breadth before
shipping. Browser regressions prove existing consumers remain functional; they
do not prove their migration to the new approval UI. No goal PR is open yet.


## Admission, extension routing, and concurrent policy checkpoint

Configured hosts can now request required/optional interface admission before
execution. Admission tokens bind to the trusted session and must be revalidated
immediately before rendering. Required denial prevents admission; optional denial
omits that domain. Admission accepts session/persistent approvals, never once-only
launch authority. No domain is granted merely because the host implements it.

Configured extension routing snapshots bounded plain JSON, checks declared
capabilities, uses the shared coordinator, bounds replay history, and suppresses
stale replies. Host extensions supply their own denial response contract. Source
destruction invalidates subsequent requests until a new registration. Independent
prompt budgets charge only newly displayed prompts, not already granted requests.

The coordinator now revalidates relevant requirements after asynchronous work
instead of comparing whole-state object identity. Concurrent approvals preserve
each other's grants. Removed prerequisites and explicit denials still prevent
execution; relevant grant removal suppresses late results. Once grants remain
consumed before execution and authorize only that action's completion.

Verification on 2026-10-17: 63 focused tests; full 184 files / 2,370 unit tests;
build, type-check, strict docs gate pass; quality score 100 (existing runtime file
size warning). Logs: /tmp/kehto-firewall-concurrency-{unit,types,build,docs}.log
and /tmp/kehto-firewall-concurrency-quality.json. The earlier 125-browser-test
checkpoint predates the final coordinator correction and does not prove host UI
migration.

Still unfinished: builtin resource/network mediation beyond LINK, full temporal
gate replacement, Paja/playground loader admission and approval/settings UI,
direct-network isolation, compatibility cleanup, and final integration/shipping.
The optional adapters are migration scaffolding; the overall goal is not complete.


## Resource lifecycle prerequisite

Rechecked upstream PR #80 head through GitHub API: unchanged at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. Before inserting resource approvals,
fixed cancellation before async metadata resolution, immutable bulk capture,
duplicate in-flight ID ownership, source-replacement cleanup, and service detach.
Nine new lifecycle regressions exercise the actual resolver and response paths.
This step does not enable resource permissions. Remaining resource work includes
per-item authorization, resolved-destination checks, pending-prompt cancellation,
wire migration (`urls`, base64), resolver policy, and host isolation. Installed
contract/earlier implementation is not authority over the checked draft.

Verified resource lifecycle checkpoint: 28 focused tests and full 185 files /
2,379 unit tests pass. Build, type-check, strict docs, and quality 100 pass.
Logs: /tmp/kehto-resource-lifecycle-{unit,types,build,docs}.log and
/tmp/kehto-resource-lifecycle-quality.json. No browser wiring changed here.
Next: add request-scoped cancellation through authorizeOperation/coordinator so
resource.cancel can abort a pending approval without cancelling sibling requests
or creating late grants; then implement per-item resource and destination scopes.
