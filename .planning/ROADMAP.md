# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** - 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** - 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** - 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** - 7 phases (16-22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** - 6 phases (23-28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** - 3 phases (29-31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** - 5 phases (32-36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** - 5 phases (37-41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** - 5 phases (42-46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** - 3 phases (47-49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [x] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** - 3 phases (50-52), 3 plans, 10/10 requirements, 86 E2E specs green ([archive](milestones/v1.10-ROADMAP.md) | [audit](milestones/v1.10-MILESTONE-AUDIT.md))
- [x] **v1.11: NIP-5A Gateway Artifact Parity** - 3 phases (53-55), 16/16 requirements, production-equivalent opaque-origin gateway artifact loading, 551 unit tests, 87 E2E specs green ([archive](milestones/v1.11-ROADMAP.md) | [audit](milestones/v1.11-MILESTONE-AUDIT.md))
- [x] **v1.12: NIP-5D Contract Conformance** - 4 phases (56-59), 34/34 requirements, 560 unit tests, 89 E2E specs green, pinned-spec contract conformance across shell, shim/runtime, gateway load checks, and 13 playground napplets ([archive](milestones/v1.12-ROADMAP.md) | [requirements](milestones/v1.12-REQUIREMENTS.md) | [audit](milestones/v1.12-MILESTONE-AUDIT.md))
- [ ] **v1.13: Documentation Strategy & Monorepo Docs Site** - 5 phases (60-64), 28 requirements, content strategy, package docs, tutorials/how-tos, VitePress site, and docs verification.

---

## Active Milestone

### v1.13: Documentation Strategy & Monorepo Docs Site

**Goal:** Turn Kehto's shipped runtime packages into a coherent public documentation system: content strategy, package docs, implementation tutorials, runtime/site guides, reference docs, and how-tos.

**Baseline entering v1.13:** v1.12 is archived with pinned-spec NIP-5D conformance across shell, shim/runtime, gateway load checks, and all 13 playground napplets. The repo currently has package READMEs, generated TypeDoc under `docs/api/`, historical migration docs under `docs/migrations/`, policy docs under `docs/policies/`, and no VitePress site configuration.

**Coverage:** 28/28 requirements mapped.

**Critical invariant:** Documentation must describe the shipped framework-agnostic runtime and package boundaries without changing runtime protocol behavior or turning historical migration archives into current guidance.

### Phases

- [x] **Phase 60: Content Strategy and Docs Information Architecture** - Define personas, documentation taxonomy, start paths, archive boundaries, source-of-truth rules, and site navigation shape.
- [ ] **Phase 61: Package Documentation Coverage** - Bring every public package and the playground to consistent purpose/install/API/scope documentation, with export coverage checks.
- [ ] **Phase 62: Runtime Tutorials and How-to Guides** - Create implementer tutorials, runtime-host guide, napplet integration tutorial, common how-tos, and troubleshooting/tips content.
- [ ] **Phase 63: VitePress Docs Site Implementation** - Add the docs-owned VitePress site, navigation, build task, package/content linking strategy, and TypeDoc integration.
- [ ] **Phase 64: Reference Integration and Docs Quality Gates** - Add verification scripts/CI hooks for docs build, API refs, package coverage, navigation/link integrity, and final no-runtime-regression proof.

---

## Phase Details

### Phase 60: Content Strategy and Docs Information Architecture

**Goal**: Establish the documentation structure before writing or moving content.

**Depends on**: v1.13 requirements accepted; existing package READMEs; `docs/api/`; `docs/migrations/`; `docs/policies/`.

**Requirements**: STRAT-01, STRAT-02, STRAT-03, STRAT-04, STRAT-05, SITE-02

**Rationale**: Kehto already has enough shipped surface area that docs need an explicit reader model and information architecture. This phase prevents package docs, tutorials, VitePress navigation, and archived migration documents from becoming competing entry points.

**Success Criteria** (what must be TRUE):
  1. Reader personas and top-level documentation jobs are documented.
  2. Docs taxonomy distinguishes tutorials, how-tos, conceptual guides, package reference, API reference, policies, migrations, and release/process material.
  3. The monorepo docs entry path explains Kehto, the `@napplet` relationship, package map, and reader start paths.
  4. Migration archive pages are clearly marked as historical.
  5. Source-of-truth and maintenance rules explain when content is linked, mirrored, or generated.
  6. Proposed VitePress navigation exposes Start, Concepts, Tutorials, How-tos, Package Reference, API Reference, Policies, and Migration Archive.

**Plans**: [60-01-PLAN.md](phases/60-content-strategy-and-docs-information-architecture/60-01-PLAN.md)

**Completed**: 2026-05-23 ([summary](phases/60-content-strategy-and-docs-information-architecture/60-01-SUMMARY.md) | [verification](phases/60-content-strategy-and-docs-information-architecture/60-VERIFICATION.md))

### Phase 61: Package Documentation Coverage

**Goal**: Make every public package and the playground consistently documentable and verifiable.

**Depends on**: Phase 60

**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07, PKG-08, REF-02

**Rationale**: Package READMEs currently exist but vary in depth and are not yet organized as a complete docs system. The docs site should build on package-level truth, not invent parallel descriptions that drift from barrels and manifests.

**Success Criteria** (what must be TRUE):
  1. Each public package page documents purpose, install command, peer dependencies, entry points, primary APIs, and scope boundaries.
  2. `acl`, `runtime`, `shell`, `services`, `nip66`, `wm`, and `playground` package docs each cover their package-specific integration responsibilities.
  3. Export names documented in package pages match current package barrels and manifests.
  4. Package docs link to API reference targets or stable generated-reference placeholders.
  5. Existing README content remains useful from npm/GitHub package views.

### Phase 62: Runtime Tutorials and How-to Guides

**Goal**: Provide concrete implementation paths for readers building with Kehto.

**Depends on**: Phase 61

**Requirements**: TUT-01, TUT-02, TUT-03, TUT-04, TUT-05

**Rationale**: Reference docs describe symbols, but implementers need recipes that explain how pieces fit together: runtime factory, adapters, shell bridge, services, ACL, gateway artifacts, napplet `requires`, and debugging common failure modes.

**Success Criteria** (what must be TRUE):
  1. A beginner tutorial gets from install to a minimal host shell with one sandboxed napplet.
  2. A runtime implementation guide covers adapter hooks, ACL policy, service registration, shell bridge, gateway loading, and teardown.
  3. A napplet integration tutorial covers `requires`, hosted `supports()`, and safe NUB helper usage.
  4. How-tos cover common host tasks: grant capability, register service, handle unsupported `requires`, add reference service, debug postMessage, and verify gateway artifacts.
  5. Troubleshooting/tips document known failures from prior milestones without widening runtime scope.

### Phase 63: VitePress Docs Site Implementation

**Goal**: Build the navigable documentation site without breaking package or TypeDoc workflows.

**Depends on**: Phase 62

**Requirements**: SITE-01, SITE-03, SITE-04, SITE-05, REF-01

**Rationale**: A docs strategy and content set need a usable presentation surface. The site should live under docs-owned metadata, keep root package metadata clean, build from the monorepo task graph, and expose generated API reference links for every public package.

**Success Criteria** (what must be TRUE):
  1. VitePress is configured under `docs/` or an equivalent docs-owned workspace.
  2. The site builds locally through a documented script and monorepo task graph.
  3. Build output is base/relative-link safe and does not require the playground dev server.
  4. Package README and site content have an explicit link/generation/source-of-truth strategy.
  5. API reference links for every public package are reachable from the site and package docs.
  6. `pnpm docs:api` still works.

### Phase 64: Reference Integration and Docs Quality Gates

**Goal**: Make the docs system maintainable and prove it does not regress runtime packages.

**Depends on**: Phase 63

**Requirements**: REF-03, REF-04, REF-05

**Rationale**: The milestone should close with durable verification, not just prose. Docs build, generated API reference, package coverage, navigation/link integrity, and the existing runtime smoke checks should all have repeatable evidence.

**Success Criteria** (what must be TRUE):
  1. Docs commands verify site build, API docs generation, route/link coverage or equivalent, and package docs consistency.
  2. CI or local scripts fail on broken docs build, missing public package navigation entries, and stale package/API reference links.
  3. Final verification records docs build, API docs generation, package-doc coverage, navigation/link checks, and runtime smoke proof.
  4. Existing `pnpm build`, `pnpm type-check`, and relevant unit/static checks pass or documented docs-only exceptions are justified.
  5. Roadmap and requirements traceability show 28/28 requirements mapped.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 60. Content Strategy and Docs Information Architecture | 1/1 | Completed | 2026-05-23 |
| 61. Package Documentation Coverage | 0/1 | Pending | — |
| 62. Runtime Tutorials and How-to Guides | 0/1 | Pending | — |
| 63. VitePress Docs Site Implementation | 0/1 | Pending | — |
| 64. Reference Integration and Docs Quality Gates | 0/1 | Pending | — |

---

## Backlog

### Backlog 999.1: Fix decrypt-demo fixture delivery pending state

**Goal:** Investigate and fix the playground `decrypt-demo` staying in `waiting for fixtures` / `[pending]` for NIP-04, NIP-44, NIP-17, and Class-2 probe rows.

**Captured:** 2026-05-23 via `$gsd-capture --backlog`

**Context:** `.planning/backlog/999.1-fix-decrypt-demo-fixture-pending/999.1-CONTEXT.md`

**Observed symptom:** User screenshot shows the decrypt demo panel stuck with:
- `waiting for fixtures`
- `NIP-04 [pending]`
- `NIP-44 [pending]`
- `NIP-17 [pending]`
- `Class-2 [pending]`

**Acceptance direction:**
- The playground decrypt demo receives fixtures reliably after boot.
- NIP-04, NIP-44, NIP-17, and Class-2 rows leave `[pending]` and settle to the expected terminal state.
- Regression coverage catches fixture-delivery stalls in the real playground path.

---

*ROADMAP.md last updated: 2026-05-23 - v1.13 roadmap created.*
