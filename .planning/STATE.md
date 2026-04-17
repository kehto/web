---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: — NIP-5D Conformance & Full NUB Coverage
status: executing
stopped_at: Completed 12-03-PLAN.md — NUB-03 satisfied; 9 identity.* actions dispatched; signer domain fully deleted (DRIFT-RT-06/07/10, DRIFT-SVC-01/02/07 closed)
last_updated: "2026-04-17T19:09:15.447Z"
last_activity: 2026-04-17
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 15
  completed_plans: 10
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Phase 12 — shell-conformance-seven-nub-coverage

## Current Position

Phase: 12 (shell-conformance-seven-nub-coverage) — EXECUTING
Plan: 6 of 11
Status: Ready to execute
Last activity: 2026-04-17

Progress: [██████████] 100% (Phase 10 plans complete — v1.2 overall 1/6 phases)

## Milestone v1.2 Phases (rescoped)

| # | Phase | Requirements |
|---|-------|--------------|
| 10 | Spec Conformance Audit | SPEC-01, SPEC-02 |
| 11 | Nub Peer Deps & Type Imports | DEPS-01, NUB-01, NUB-02 |
| 12 | Shell Conformance & Seven-Nub Coverage | SPEC-03, SH-C01, SH-C02, SH-C03, NUB-03, NUB-04, NUB-05, NUB-06, NUB-07, NUB-08, NUB-09, NUB-10 |
| 13 | Theme Nub Implementation | TH-01, TH-02, TH-03, TH-04 |
| 14 | Dispatch Refactor | DISPATCH-01, DISPATCH-02, DISPATCH-03 |
| 15 | Milestone Validation & Release Prep | DEPS-02, DEPS-03 |

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.2)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 10 P01 | 4min | 2 tasks | 2 files |
| Phase 10 P02 | 6min | 2 tasks | 1 files |
| Phase 10 P01 | 1min | 2 tasks | 0 files |
| Phase 10 P02 | 18min | 2 tasks | 1 files |
| Phase 11 P01 | 3min | 3 tasks | 6 files |
| Phase 11 P02 | 11min | 3 tasks | 17 files |
| Phase 12 P01 | 3 min | 2 tasks | 5 files |
| Phase 12 P02 | 3min | 2 tasks | 3 files |
| Phase 12 P06 | 3min | 2 tasks | 4 files |
| Phase 12 P05 | 4min | 2 tasks | 7 files |
| Phase 12 P07 | 5 min | 2 tasks | 6 files |
| Phase 12 P03 | 9min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work (full log in PROJECT.md):

- [v1.1] Clean break — no dual-mode dispatch, no backward compatibility with NIP-01 arrays
- [v1.1] Dedicated `.error` type suffix for error responses
- [v1.1] resolveCapabilitiesNub is the canonical capability mapping — lives in @kehto/acl
- [v1.2 roadmap] Dispatch refactor (Phase 14) executes AFTER all five domain handlers are complete and green, so the switch-removal can be validated against a passing test suite.
- [v1.2 roadmap] DEPS-01 (peer-dep bump) and NUB-01/02 (type imports) are grouped in Phase 11 because handler work in Phase 12 depends on the new types being resolvable.
- [v1.2 roadmap] Theme (Phase 13) is sequenced after Phase 11 but independent of Phase 12 — can parallelize once nub-theme types are available.
- [Phase 10]: Provenance header for synced specs is exactly 6 lines so 'tail -n +7 specs/NIP-5D.md' yields upstream byte-identical content — drift detection reduces to a single diff command.
- [Phase 10]: Top-level README's ## Specification section is the canonical pointer to the pinned spec + upstream URL; keeps the repo root README minimal (30 lines) while satisfying SPEC-01.
- [Phase 10]: 24 stable DRIFT-* IDs documented in docs/v1.2-NIP-5D-AUDIT.md — 15 Phase 12, 5 Phase 13, 4 Phase 14; every ID cites packages/<pkg>/src/<file>.ts:<line> or an absence site
- [Phase 10]: Audit established six-column drift table shape as kehto v1.3+ spec-conformance precedent; IDs never renumber, new NUBs append new DRIFT-* rows
- [Phase 10]: storage.clear is a kehto unilateral extension (not in @napplet/nub-storage) — DRIFT-SVC-06 removes it from NUB dispatch; internal cleanupNappState helper remains for lifecycle cleanup
- [Phase 10]: Plan 10-01 executed as verify-only (zero file changes) — commit 604337a canonical sync still valid at v1.2 milestone; empty commits preserve per-task audit trail
- [Phase 10]: 40 stable DRIFT-* IDs partition kehto v1.2 remediation work into Phase 11 (3 rows — peer-dep prereqs), Phase 12 (32 rows — shell conformance + 7 non-theme nubs + ACL), Phase 13 (3 rows — theme), Phase 14 (2 rows — dispatch refactor)
- [Phase 10]: docs/v1.2-NIP-5D-AUDIT.md locked as authoritative input for Phase 11-14 planning — downstream planners filter by Target Phase column, no re-audit of source required
- [Phase 11]: Uniform peer-dep rule: all 4 @kehto/* packages declare all 8 @napplet/nub-* packages, even if each only imports a subset (nubs are types-only, install footprint is zero)
- [Phase 11]: @kehto/acl preserves zero-runtime-dep posture via empty "dependencies": {} — nub peer-deps are strictly import-type-only consumption
- [Phase 11]: Per-workspace symlinks (packages/*/node_modules/@napplet/nub-*) are the correct pnpm layout for workspace consumers — lockfile is the authoritative resolution record, not root-level node_modules
- [Phase 11]: Added DRIFT-CORE-06 — Phase 11-deviation compat shim (packages/runtime/src/core-compat.ts) to restore legacy @napplet/core exports (Capability, BusKind, ALL_CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, ServiceDescriptor, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, TOPICS.STATE_*) removed in napplet v0.2.0+. Slated for deletion in Phase 12/14.
- [Phase 11]: Cross-package compat re-exports route through @kehto/runtime barrel — shell + services migrate @napplet/core imports to @kehto/runtime with a single import swap rather than duplicating shims per package.
- [Phase 11]: Widen-via-intersection pattern (as unknown as NubBase & { subId?: ...; filters?: ... }) for handleRelayMessage/handleIfcMessage — dispatch cleaves by sub-action string rather than msg.type discriminant, so direct union narrowing requires Phase 12 handler rewrites. Transitional pattern annotated with DRIFT-RT-08/09 widening markers.
- [Phase 12]: Hard-deleted generateNostrBootstrap; canonical 8-domain nub list replaces signer/storage/ifc
- [Phase 12]: Source-text regression tests (readFileSync + regex) established as pattern for canonical-spec posture enforcement
- [Phase 12]: vitest include pattern widened to packages/*/tests/** — establishes src/tests separation as a valid layout for future plans
- [Phase 12]: Plan 12-02: ShellCapabilities JSDoc documents the canonical two-namespace supports() contract (bare names for nubs, perm:<permission> for sandbox); no shell-side supports() helper added (napplet shim computes locally)
- [Phase 12]: Plan 12-02: Per-field JSDoc pattern — each ShellCapabilities array field documents its own prefix convention so violations are visible at the type-declaration site
- [Phase 12]: Plan 12-06: media-service dispatches on full message.type literal (not action-suffix) to avoid dotIdx.slice pitfall with multi-segment types like 'media.session.create'
- [Phase 12]: Plan 12-06: media-service coexists with legacy audio-service.ts — audio-service continues tracking audio:* ifc topics; media-service is the canonical nub-media NIP-5D envelope path
- [Phase 12]: Plan 12-06: runtime fallback emits media.session.create.result even when no media service registered — guarantees napplets receive a reply envelope for the one media.* request type that expects one
- [Phase 12]: Plan 12-05: Runtime fallback-handler pattern established — case 'keys': delegates to serviceRegistry['keys'] with inline spec-correct fallback envelopes (keys.registerAction.result, hotkey forwarding) so napplets never hang even when no service is registered. Same pattern expected for identity/media/notify handlers.
- [Phase 12]: Plan 12-05: Wire<->DOM field translation (ctrl/alt/shift/meta <-> ctrlKey/altKey/shiftKey/metaKey) happens symmetrically in keys-service.ts AND runtime fallback so the existing HotkeyAdapter contract stays stable; host shells don't need to change their HotkeyAdapter shape.
- [Phase 12]: Plan 12-07: notify-service coexists with legacy notification-service.ts — two distinct service names ('notify' nub vs 'notifications' ifc-emit); explicit coexistence contract documented in notify-service.ts JSDoc
- [Phase 12]: Plan 12-07: runtime fallback emits notify.send.result + notify.permission.result when no 'notify' service is registered — the two notify.* request types that expect a reply always produce one; dismiss/badge/channel.register stay fire-and-forget per @napplet/nub-notify
- [Phase 12]: Plan 12-03: Delete signer domain entirely — getPublicKey/getRelays migrate to identity.*; signEvent/nip04/nip44 have no napplet-visible home (shell-mediated signing routes through relay.publish/publishEncrypted)
- [Phase 12]: Plan 12-03: Identity runtime handler ships with fallback path (signer-backed getPublicKey/getRelays; default/empty payloads for other 7 actions) so hosts without registerService('identity') still receive spec-correct envelopes
- [Phase 12]: Plan 12-03: Identity ACL-denial test in identity-service.test.ts asserts envelope shape only (TODO(12-10)) — real resolveCapabilitiesNub identity branch is Plan 12-10's deliverable

### Blockers/Concerns

- @napplet/core not yet published to npm — uses workspace override; v1.2 must continue to work via workspace resolution.
- No CI/CD yet — Phase 15 test validation is run locally.

## Session Continuity

Last session: 2026-04-17T19:09:15.444Z
Stopped at: Completed 12-03-PLAN.md — NUB-03 satisfied; 9 identity.* actions dispatched; signer domain fully deleted (DRIFT-RT-06/07/10, DRIFT-SVC-01/02/07 closed)
Resume: Run `/gsd:plan-phase 10` to begin Spec Conformance Audit.
