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
- [x] **v1.14: GitHub Pages Web Portal** - 3 phases (65-67), 13/13 requirements, public `/web/` portal, playground at `/web/playground/`, docs at `/web/docs/`, and unified Pages deploy gate ([archive](milestones/v1.14-ROADMAP.md) | [requirements](milestones/v1.14-REQUIREMENTS.md) | [audit](milestones/v1.14-MILESTONE-AUDIT.md))
- [x] **v1.15: Address AI Slop** - 5 phases (68-72), 20/20 original requirements complete, local `aislop` scan no longer Critical, 563 unit tests green ([archive](milestones/v1.15-ROADMAP.md) | [requirements](milestones/v1.15-REQUIREMENTS.md) | [audit](milestones/v1.15-MILESTONE-AUDIT.md))
- [x] **v1.16: Structural Code Quality Refactor** - 4 phases (73-76), 18/18 requirements, local `aislop` scan clean, 563 unit tests green ([archive](milestones/v1.16-ROADMAP.md) | [requirements](milestones/v1.16-REQUIREMENTS.md) | [audit](milestones/v1.16-MILESTONE-AUDIT.md))
- [x] **v1.17: Beautify the SPA Landing Page** - 3 phases (77-79), 15/15 requirements, static `/web/` brand system, GSAP motion, liquid accent, and visual proof ([archive](milestones/v1.17-ROADMAP.md) | [requirements](milestones/v1.17-REQUIREMENTS.md) | [audit](milestones/v1.17-MILESTONE-AUDIT.md))
- [ ] **v1.18: Napplet Firewall** - phases 80-82 (in-flight on `milestone/v1.18-firewall`, not yet merged)
- [ ] **v1.19: NAP Ontology Alignment** - 1 phase (83), 8 requirements (in progress on `milestone/v1.19-nap-ontology`)

---

## Active Milestone: v1.19 NAP Ontology Alignment

**Goal:** Align the `@kehto/*` `shell.init` capability handshake (and the INC dispatch rail) with the NAP renames `@napplet/*` adopted at `0.9.0`, so napplets built against `@napplet/* >=0.9.0` negotiate capabilities correctly inside a kehto shell. Resolves kehto/web#24.

**Branch:** `milestone/v1.19-nap-ontology` (off `main`)

**Note:** Phase numbering starts at 83 to avoid collision with the parallel in-flight v1.18 Firewall milestone (phases 80-82) on its own branch.

## Phases

- [ ] **Phase 83: NAP Ontology Alignment** - Align capability handshake and dispatch rail with `@napplet/* >=0.9.0` NAP renames; add shim@0.9.0 conformance test; stage changeset.

## Phase Details

### Phase 83: NAP Ontology Alignment
**Goal**: Napplets built against `@napplet/* >=0.9.0` negotiate capabilities correctly inside a kehto shell — the handshake emits `naps`/`inc`/`inc:NAP-0N`, the runtime routes `inc.*` messages, and the real shim@0.9.0 `createShellSupports` confirms the outcome.
**Depends on**: Nothing (first phase of this milestone; v1.18 phases 80-82 are parallel on a separate branch)
**Requirements**: ALIGN-01, ALIGN-02, ALIGN-03, ALIGN-04, ALIGN-05, ALIGN-06, ALIGN-07, ALIGN-08
**Success Criteria** (what must be TRUE):
  1. Calling `supports('inc')` on the `window.napplet.shell` object inside a kehto-hosted `>=0.9.0` napplet returns `true` — the shell advertises the `inc` domain.
  2. Calling `supports('inc', 'NAP-01')` (and other `inc:NAP-0N` protocol queries) against the kehto-emitted `shell.init` capabilities returns `true` via the real `@napplet/shim@0.9.0` `createShellSupports` function — not just string matching.
  3. The `shell.init` postMessage carries both `naps` (consumed by shim 0.9.0) and `nubs` (back-compat for shim <0.9.0) capability arrays, and the `naps` array contains `inc:NAP-0N` protocol IDs with no unaliased `ifc`/`NUB-NN` identifiers.
  4. A `>=0.9.0` napplet sending `inc.emit`, `inc.subscribe`, or `inc.unsubscribe` wire messages is routed through the existing IFC handler at the runtime dispatch layer, and legacy `ifc.*` messages continue to be handled during the transition window.
  5. The ACL gate authorizes `inc.*` actions identically to the corresponding `ifc.*` actions, so a napplet using the new `inc` domain key passes the same capability check as one using the legacy `ifc` key.
**Plans**: 3 plans
- [x] 83-01-PLAN.md — ACL resolver maps `inc` identically to `ifc` (ALIGN-06)
- [x] 83-02-PLAN.md — Runtime registers `inc` dispatch key + domain-aware IFC handler (ALIGN-05)
- [ ] 83-03-PLAN.md — Shell `naps`/`nubs` dual-emit + shim@0.9.0 conformance test + changeset (ALIGN-01/02/03/04/07/08)
**UI hint**: no

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 83. NAP Ontology Alignment | v1.19 | 2/3 | In Progress|  |

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

*ROADMAP.md last updated: 2026-06-15 - v1.19 NAP Ontology Alignment roadmap created.*
