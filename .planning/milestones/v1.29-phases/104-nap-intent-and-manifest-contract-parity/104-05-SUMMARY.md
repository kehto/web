---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 05
subsystem: intent-integration-and-consumers
tags: [nap-intent, integration, lifecycle, paja, playground, conformance]
requires:
  - phase: 104-nap-intent-and-manifest-contract-parity
    plan: 04
    provides: authenticated validation, runtime context, and retained orchestration
provides:
  - authenticated manifest-to-ready-target integration tracer
  - lifecycle-neutral retained-controller policy matrix
  - exact transitional Paja and playground consumers
  - scoped active intent and archetype conformance guards
  - package-local exact intent and manifest documentation
affects: [105, 106]
tech-stack:
  added: []
  patterns: [real-runtime tracer, private lifecycle controller, scoped active-source guard]
key-files:
  created:
    - .planning/phases/104-nap-intent-and-manifest-contract-parity/104-05-SUMMARY.md
  modified:
    - packages/services/src/manifest-intent-dispatch.test.ts
    - packages/paja/src/browser-adapter.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - packages/services/README.md
key-decisions:
  - "The integration tracer uses the public runtime/session/service path while a fake host controller owns only private target readiness and transport mapping."
  - "Ready, deferred, replacement/retry, and terminal policies are tested only through invariant result/delivery shapes; no lifecycle observation field is added."
  - "Paja remains a development-only retained no-op simulator and playground remains a verified-manifest catalog builder until Phase 105 live host wiring."
patterns-established:
  - "An accepted intent is proven by retain, source result, task start, and ready-target delivery ordering across source destruction."
  - "Active conformance guards inspect exact local interfaces and narrowly sliced simulator blocks so unrelated window/runtime vocabulary and historical fixtures remain valid."
requirements-completed:
  - BASE-01
  - BASE-02
  - INTENT-01
  - INTENT-02
  - INTENT-03
  - INTENT-04
  - INTENT-05
  - INTENT-06
  - INTENT-07
  - INTENT-08
  - INTENT-09
  - INTENT-10
  - INTENT-11
  - ARCH-01
  - ARCH-02
  - ARCH-04
coverage:
  - id: E1
    description: A real authenticated source obtains installed availability, is attested, receives acceptance after retention, can be destroyed, and still causes one ready-target delivery.
    requirement: INTENT-08
    verification:
      - kind: integration
        ref: packages/services/src/manifest-intent-dispatch.test.ts#manifest-backed-intent-runtime-integration
        status: pass
    human_judgment: false
  - id: E2
    description: Forged sender data rejects and the canonical target-only delivery contains the registered source dTag with no ID or INC carrier.
    requirement: INTENT-09
    verification:
      - kind: integration
        ref: packages/services/src/manifest-intent-dispatch.test.ts#attests-accepts-retains-and-delivers
        status: pass
    human_judgment: false
  - id: E3
    description: Ready/reuse, deferred cold start, replacement/retry, and terminal failure preserve exact acceptance and delivery shapes.
    requirement: INTENT-10
    verification:
      - kind: integration
        ref: packages/services/src/manifest-intent-dispatch.test.ts#lifecycle-state-private
        status: pass
    human_judgment: false
  - id: E4
    description: Paja and playground compile against exact convention candidates and retained outcomes without claiming persistent live host wiring.
    requirement: ARCH-04
    verification:
      - kind: typecheck
        ref: packages/paja/src/browser-adapter.ts
        status: pass
      - kind: unit
        ref: tests/unit/playground-intent-catalog.test.ts
        status: pass
    human_judgment: false
  - id: E5
    description: Scoped guards reject obsolete canonical intent fields and numbered archetype metadata on active sources.
    requirement: BASE-01
    verification:
      - kind: static
        ref: tests/unit/nip5d-conformance-guard.test.ts#exact-convention-contracts
        status: pass
      - kind: static
        ref: tests/unit/playground-gateway-guard.test.ts#single-file-build-config
        status: pass
    human_judgment: false
duration: 13min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 05: Integrated Intent Lifecycle and Consumer Alignment Summary

**Kehto now proves exact manifest-derived intent acceptance through authenticated
source teardown to ready-only target delivery, while immediate consumers,
guards, and package docs agree on the same carrier-neutral contract.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-26T15:58:00+01:00
- **Completed:** 2026-07-26T16:11:00+01:00
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Replaced the service-only dispatch smoke test with a public `createRuntime`
  integration tracer using real session attestation, runtime dispatch, manifest
  adaptation, catalog resolution, service orchestration, source destruction,
  deferred readiness, and target-only delivery.
- Added ready/reuse, cold/deferred, internal replacement/retry, and terminal
  controller cases that preserve one exact acceptance, at most one exact
  delivery, and no post-acceptance source result.
- Migrated Paja's development simulator from protocol/window/handled fields to
  exact conventions/contracts plus a retained no-op task, aligned playground
  examples, and installed scoped active-source drift guards.
- Documented exact manifest tags, URI invocation, acceptance-only results,
  runtime-attested ready delivery, and the retained controller seam across the
  NIP, runtime, services, and shell package READMEs.

## Task Commits

1. **Task 1: Trace accepted intent through source destruction** — `a2b7d89`
2. **Task 2: Cover lifecycle-neutral target policies** — `78977f5`
3. **Task 3: Align consumers, guards, and package docs** — `5670282`

## Files Created/Modified

- `packages/services/src/manifest-intent-dispatch.test.ts` — Real runtime tracer and lifecycle matrix.
- `packages/paja/src/browser-adapter.ts` — Exact-contract transitional development simulator.
- `apps/playground/src/playground-intent-catalog.ts` — Honest Phase 104 catalog-builder boundary.
- `tests/unit/playground-intent-catalog.test.ts` — Exact contract and obsolete-field regression.
- `tests/unit/nip5d-conformance-guard.test.ts` — Scoped exact interface, simulator, and archetype metadata guard.
- `tests/unit/playground-gateway-guard.test.ts` — Exact config guard and Phase 105 live-flow boundary.
- `packages/nip/README.md` — Verified archetype manifest contract.
- `packages/runtime/README.md` — Authenticated runtime intent boundary.
- `packages/services/README.md` — Manifest resolver, retained controller, and service behavior.
- `packages/shell/README.md` — Protected URI binding and buffered delivery.

## Authority Check

Checked `napplet/naps` draft PR #91 immediately before Plan 104-05 source edits.
It remains open and unchanged at exact head
`a718915ddefa2f03a0126579601f59d8bd86f7c4`. Its installed-manifest
availability, source attestation, retain-before-acceptance, source-independent
delivery, target readiness, no-ID carrier, no-visible-INC, and lifecycle-policy
clauses match the implementation and tests. The result is conformant to that
exact draft.

## Decisions Made

- Keep target window lookup and ready signaling inside the fake host controller
  so the integration proof uses real public runtime behavior without making
  host lifecycle state part of the resolver or wire model.
- Treat Vitest's clean terminal-rejection run plus the one-result assertion as
  the unhandled-rejection regression; the service attaches its containment
  handler synchronously.
- Scope the canonical-field guard to exact value/resolver/catalog surfaces and
  the two Paja intent blocks. This rejects intent drift without flagging
  unrelated runtime `windowId` parameters or deliberate invalid/history vectors.
- Preserve `NAP-1` only in gateway invalid-input and stale-manifest replacement
  fixtures; active archetype metadata contains only queryless conventions.

## Deviations from Plan

### Auto-fixed: refreshed ignored workspace declarations

- **Found during:** Task 3 Paja type-check
- **Issue:** Paja resolves `@kehto/services` through its ignored `dist`
  declarations, which still described the pre-Phase-104 intent model.
- **Fix:** Ran `pnpm --filter @kehto/services build` before the Paja type-check.
- **Impact:** No tracked output, package manifest, dependency, or lockfile
  changed.

## Verification

- Focused cross-layer matrix — 309 tests passed across 12 files.
- `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, and
  `@kehto/paja` type-checks — passed.
- `@kehto/playground` has no `type-check` script; the filtered command reported
  that condition and exited successfully.
- `pnpm docs:check` — passed strict TypeDoc, VitePress build, and documentation audit.
- `git diff --check` — passed.
- Package manifests, `pnpm-lock.yaml`, and `.aislop/config.yml` — unchanged.
- AI-slop gate — unavailable; no workspace binary or command exists, and
  nothing was installed.

## User Setup Required

None.

## Next Phase Readiness

Phase 104's exact local intent and manifest contract is complete. Phase 105 can
now verify and adopt the published convention-capable Napplet packages, remove
temporary mirrored types, and build the persistent Paja/playground catalogs,
ready-target controllers, live feed-to-profile flow, safe profile resources,
and synchronized theme behavior.

## Self-Check: PASSED

- All ten modified files exist and task commits `a2b7d89`, `78977f5`, and
  `5670282` are present.
- The exact PR #91 head is recorded and unchanged.
- The focused test/type/docs gates pass with no dependency or scanner-policy
  drift.
- No Phase 105 package adoption or live persistent host implementation entered
  this plan.
