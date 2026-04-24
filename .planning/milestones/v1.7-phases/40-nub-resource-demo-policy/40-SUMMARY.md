---
phase: 40-nub-resource-demo-policy
subsystem: services/acl/runtime/shell/demo/e2e/docs
tags:
  - nub-resource
  - resource-service
  - resource-demo
  - policy-docs
  - e2e
  - phase-close
  - v1.7
dependency_graph:
  requires:
    - 39 (connectStore grants store — getConnectGrants source for H-03)
    - 38 (class-invariant.spec.ts + class enforcement pattern)
    - 37 (provisional-resource.ts wire types)
  provides:
    - createResourceService factory (packages/services) — 10th NUB domain
    - resource:fetch ACL capability + resourceMap() resolver + nubDispatch.registerNub('resource')
    - resource-demo napplet (12th demo napplet — DEMO_NAPPLETS.length === 12)
    - auto-grant fixture + demo-data.json fixture
    - docs/policies/ directory complete (CLASS + CONNECT + RESOURCE — all 3 policy files)
    - nub-resource.spec.ts E2E-25 (2 tests)
    - class-invariant.spec.ts extended to 10 domains (E2E-20 complete)
    - E2E baseline 67 → 71 (+4)
  affects:
    - Phase 41 (Polish Wave — unblocked; nip66/wm/CACHE independent)
    - Phase 42 (NIP-44 Decrypt — soft-gated on napplet/napplet#3)
key-decisions:
  - "deferred _sessionRegistryRef pattern for createResourceService (factory pre-relay, ref assigned post-bootShell)"
  - "provisional resource.bytes dispatch via window.parent.postMessage (no @napplet/sdk resource namespace yet)"
  - "GRANTED_URL uses demo origin 4174 (not napplet dev server 5174) — demo-data.json in apps/demo/public/"
  - "docs/policies/ complete with all 3 canonical policy mirrors (CLASS, CONNECT, RESOURCE) at milestone v1.7"
requirements-completed:
  - RESOURCE-01
  - RESOURCE-02
  - RESOURCE-03
  - RESOURCE-04
  - RESOURCE-05
  - RESOURCE-06
  - E2E-25
  - E2E-20
  - DOCS-07
metrics:
  completed_date: "2026-04-24"
  plans: 3
  e2e_before: 67
  e2e_after: 71
  e2e_delta: +4
---

# Phase 40: NUB-RESOURCE + Demo Napplets + Policy Docs — Phase Summary

**10th NUB domain (resource) fully wired: createResourceService factory with H-03 guard, resource:fetch ACL capability, nubDispatch.registerNub('resource'), resource-demo napplet (12th), SHELL-RESOURCE-POLICY.md canonical mirror; E2E baseline advances 67→71 with E2E-20 and E2E-25 complete.**

## Wave Summaries

### Wave 1 (Plan 40-01): NUB-RESOURCE Wire-up + ACL + Runtime Dispatch

`createResourceService` factory (368 lines) with H-03 construction guard (all 4 options required), `resource:fetch` capability in `ALL_CAPABILITIES` (bit 1<<15), `resourceMap()` per-domain resolver, `handleResourceMessage()` + `resourceAdapter` in `runtime.ts`, and `nubDispatch.registerNub('resource', resourceAdapter)` — the Phase 39 Dev 1 lesson held. In-flight AbortController map keyed by requestId + per-window cleanup set for `onWindowDestroyed`. `CANONICAL_NUB_DOMAINS` extended to 10; provisional-resource types re-exported from `@kehto/shell` barrel. Changeset covers all 4 packages. 9 unit tests, all pass. E2E baseline unchanged (unit-only wave).

### Wave 2 (Plan 40-02): resource-demo Napplet + Demo Wiring + Auto-grant Fixture

`resource-demo` napplet scaffolded (5 files + demo-data.json fixture): two-panel layout with `#resource-demo-granted` and `#resource-demo-denied` sentinels, provisional `resource.bytes` dispatch via `window.parent.postMessage` (no @napplet/sdk resource namespace), dedicated message listener for `resource.*` envelopes. `createResourceService` wired in `createDemoHooks()` with `hostFetch` (native `fetch` + `AbortController` + 10s timeout). Deferred `_sessionRegistryRef` pattern solves timing: factory constructed before relay, ref assigned after `createShellBridge`. Auto-grant fixture pre-seeds `http://localhost:4174` for `resource-demo` before iframe first load (D3). `DEMO_NAPPLETS.length === 12`, `CLASS_BY_DTAG` = 12 entries. `pnpm audit:csp` OK (12 napplets, no meta-CSP).

### Wave 3 (Plan 40-03): Policy Doc + E2E Specs + Phase Close

`SHELL-RESOURCE-POLICY.md` copied verbatim from `napplet/napplet@27e1624` (HTTP 200 at copy time) with 15-entry kehto cross-reference appendix and D7 host-app-responsibility surface documented (redirect/MIME/SVG/private-IP). `tests/e2e/nub-resource.spec.ts` — 2 tests (granted JSON + denied code=denied); H-03 coupling proof: `denied` populates before network timeout. `class-invariant.spec.ts` extended 8→10 NUB domains. README Policies section updated with all 3 policy file links. Two Rule 1 auto-fixes: GRANTED_URL port 5174→4174 and ACL modal row count 11→12. Canonical phase-close loop: **71 passed / 0 failed / 0 skipped**.

## Requirement → Artifact Table

| Requirement | Artifact | Plan |
|-------------|----------|------|
| RESOURCE-01 | `packages/services/src/resource-service.ts:171` (createResourceService + H-03 guard) | 40-01 |
| RESOURCE-02 | `packages/acl/src/capabilities.ts:38` + `resolve.ts:187` + `runtime.ts:1147` (registerNub) | 40-01 |
| RESOURCE-03 | `resource-service.ts` in-flight AbortController map + per-window cleanup | 40-01 |
| RESOURCE-04 | `apps/demo/napplets/resource-demo/` + DEMO_NAPPLETS[12] + auto-grant | 40-02 |
| RESOURCE-05 | `docs/policies/SHELL-RESOURCE-POLICY.md` (canonical + cross-refs) | 40-03 |
| RESOURCE-06 | `packages/shell/src/index.ts` provisional-resource re-exports | 40-01 |
| E2E-25 | `tests/e2e/nub-resource.spec.ts` (2 tests Layer-B) | 40-03 |
| E2E-20 | `tests/e2e/class-invariant.spec.ts` (10 params; E2E-20 complete) | 40-03 |
| DOCS-07 | `docs/policies/` = 3 files + README reference | 40-03 |

## E2E Baseline

| Milestone | Count | Delta |
|-----------|-------|-------|
| Phase 39 close (entering Phase 40) | 67 | — |
| nub-resource.spec.ts (+2 new tests) | 69 | +2 |
| class-invariant.spec.ts extension (+2 params) | 71 | +2 |
| **Phase 40 close** | **71** | **+4** |

## Next Phase

- **Phase 41 (Polish Wave)** — unblocked. `@kehto/nip66` demo wiring (NIP66-05), `@kehto/wm` structural primitives, CACHE alias polish (kehto#1). Independent of NUB-RESOURCE.
- **Phase 42 (NIP-44 Decrypt, soft-gated)** — evaluate at Phase 41 close. Gated on napplet/napplet#3 unblock.
- **v1.8 carry items:** pnpm.overrides workaround (SEED-001 — single atomic bump when NUB subpaths publish), provisional type migration (provisional-class/connect/resource → peer dep subpaths).

## Incidents / Follow-ups for Phase 41

None blocking. Two Rule 1 auto-fixes documented in 40-03-SUMMARY.md deviations. The GRANTED_URL port correction (5174→4174) is a dev-mode vs preview-mode gap — future napplets with local-origin resources should default to `window.location.origin` rather than hardcoded port.
