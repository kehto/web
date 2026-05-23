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
- [x] **v1.13: Documentation Strategy & Monorepo Docs Site** - 5 phases (60-64), 28/28 requirements, content strategy, package docs, tutorials/how-tos, VitePress site, and docs verification ([archive](milestones/v1.13-ROADMAP.md) | [requirements](milestones/v1.13-REQUIREMENTS.md) | [audit](milestones/v1.13-MILESTONE-AUDIT.md))

---

## Active Milestone

### v1.14: GitHub Pages Web Portal

**Goal:** Turn the GitHub Pages deployment into a public `/web/` portal that links to the playground and docs, with the playground deployed at `/web/playground/` and VitePress docs deployed at `/web/docs/`.

**Baseline entering v1.14:** v1.13 is archived with a buildable VitePress docs site, generated API integration, docs quality gates, and an existing playground-only GitHub Pages workflow. Current Pages packaging uploads `.pages/playground`, uses `PLAYGROUND_BASE_PATH=/${{ github.event.repository.name }}/`, and does not publish the docs site or a portal slash page.

**Coverage:** 13/13 requirements mapped.

**Critical invariant:** The deployed public URL contract is `https://kehto.github.io/web/`, not a repository-name-derived base path. Playground gateway routes and docs assets must be nested under their requested path segments.

### Phases

- [ ] **Phase 65: Pages Portal Entry Point** - Add the static `/web/` entry page and artifact root contract that links users to playground and docs.
- [ ] **Phase 66: Playground Pages Path Relocation** - Move playground Pages packaging and gateway metadata under `/web/playground/`.
- [ ] **Phase 67: Docs Pages Publication and Deploy Gate** - Publish VitePress under `/web/docs/`, upload one unified Pages artifact, and add route-shape verification.

---

## Phase Details

### Phase 65: Pages Portal Entry Point

**Goal**: Create the public Kehto slash page and unify the static artifact root around `/web/`.

**Depends on**: v1.14 requirements accepted; existing `scripts/build-playground-pages.mjs`; current GitHub Pages workflow.

**Requirements**: PAGE-01, PAGE-02, PAGE-03

**Rationale**: The current Pages artifact opens directly into the playground. The requested public shape needs a stable portal root that can send readers to either playground or docs without coupling that page to either application's runtime.

**Success Criteria** (what must be TRUE):
  1. Generated Pages artifact contains an `index.html` for `/web/`.
  2. The entry page clearly links to `/web/playground/` and `/web/docs/`.
  3. The entry page is static and does not depend on playground JavaScript, docs VitePress runtime, or external services.
  4. Artifact output location and public base path are explicit enough for downstream phases to place playground and docs under the same root.

**Plans**: Pending

### Phase 66: Playground Pages Path Relocation

**Goal**: Move the playground deployment and static NIP-5A gateway routes under `/web/playground/`.

**Depends on**: Phase 65

**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04

**Rationale**: The existing workflow derives `PLAYGROUND_BASE_PATH` from `github.event.repository.name`, but the public target is explicitly `/web/playground/`. The playground shell and generated gateway metadata must use the same base path or iframe URLs and static assets will drift.

**Success Criteria** (what must be TRUE):
  1. The playground shell builds with asset URLs rooted at `/web/playground/`.
  2. `build:playground-pages` or its replacement writes playground output under the unified artifact's `playground/` segment.
  3. Static gateway manifests and generated `htmlUrl` values point under `/web/playground/napplet-gateway/`.
  4. All 13 built napplets are represented as static gateway routes in the artifact.
  5. The Pages workflow no longer depends on `github.event.repository.name` for the public playground base path.

**Plans**: Pending

### Phase 67: Docs Pages Publication and Deploy Gate

**Goal**: Publish docs under `/web/docs/` and prove the unified Pages artifact before deployment.

**Depends on**: Phase 66

**Requirements**: DOCS-01, DOCS-02, DOCS-03, VERIFY-01, VERIFY-02, VERIFY-03

**Rationale**: v1.13 made the docs site buildable; v1.14 needs to put it beside the playground in the public Pages artifact. The deployment should fail before upload if the portal, playground, docs, or gateway route shape is missing.

**Success Criteria** (what must be TRUE):
  1. VitePress builds with `VITEPRESS_BASE=/web/docs/` or an equivalent explicit base-path configuration.
  2. Docs output is copied into the unified Pages artifact under `docs/`.
  3. Docs navigation, package pages, policy pages, migration archive, and generated API reference paths resolve under `/web/docs/`.
  4. GitHub Pages workflow builds and uploads one artifact containing `index.html`, `playground/`, and `docs/`.
  5. Local or CI route-shape verification fails when `/web/`, `/web/playground/`, `/web/docs/`, or a representative gateway manifest is missing.
  6. Final evidence records Pages artifact build, `pnpm docs:check`, `pnpm audit:gateway-artifacts`, build/type/unit smoke, and route-shape proof.

**Plans**: Pending

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 65. Pages Portal Entry Point | 0/1 | Pending | — |
| 66. Playground Pages Path Relocation | 0/1 | Pending | — |
| 67. Docs Pages Publication and Deploy Gate | 0/1 | Pending | — |

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

*ROADMAP.md last updated: 2026-05-23 - v1.14 roadmap created.*
