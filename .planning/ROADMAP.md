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

---

## Active Milestone

No active milestone. Start the next milestone with `$gsd-new-milestone`.

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

*ROADMAP.md last updated: 2026-05-23 - v1.14 archived; awaiting next milestone.*
