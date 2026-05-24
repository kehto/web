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
- [ ] **v1.16: Structural Code Quality Refactor** - 4 phases (73-76), 18 requirements, target 0 local `aislop` code-quality warnings

---

## Active Milestone

### v1.16: Structural Code Quality Refactor

**Goal:** Eliminate the remaining 16 `aislop` structural code-quality warnings without changing Kehto runtime, service, playground, or docs behavior.

**Baseline entering v1.16:** `npx --no-install aislop scan -d` reports `64 / 100 Needs Work`, 0 errors, 16 warnings, 0 fixable. Formatting, Linting, AI Slop, and Security all report 0 issues. The remaining warnings are 10 long functions, 3 large files, and 3 deep-nesting findings under the current `.aislop/config.yml` thresholds.

**Coverage:** 18/18 requirements mapped to phases.

**Critical invariant:** This milestone is behavior-preserving structural refactor work. Do not change NIP-5D protocol behavior, public package contracts, playground user flows, scanner thresholds, published package versions, or the public Pages route contract.

### Phases

- [ ] **Phase 73: Runtime Core Decomposition** - Split `packages/runtime/src/runtime.ts` and extract `createRuntime` / `handleRelayMessage` helpers until runtime core warnings clear.
- [ ] **Phase 74: Playground Shell Decomposition** - Split `apps/playground/src/main.ts` and `apps/playground/src/shell-host.ts`, reducing `createDemoHooks` and `bootShell` without changing visible demo behavior.
- [ ] **Phase 75: Service and Adapter Decomposition** - Reduce remaining long functions in ACL modal, NIP-46 client, service factories, and shell hook adapter.
- [ ] **Phase 76: Structural Gate Verification** - Prove final scanner and repo gates are clean, record evidence, and close the milestone.

---

## Phase Details

### Phase 73: Runtime Core Decomposition

**Goal**: Remove all runtime-core structural scanner warnings from `packages/runtime/src/runtime.ts`.

**Depends on**: v1.16 requirements accepted; v1.15 scanner baseline.

**Requirements**: SCAN-01, CORE-01, CORE-02, CORE-03

**Rationale**: `runtime.ts` carries the highest-risk structural debt: the only runtime package file-size warning plus the largest function and nested relay handler. It should be isolated before lower-risk playground/service extractions.

**Success Criteria** (what must be TRUE):
  1. Phase context records the current 16-warning `aislop` baseline before edits.
  2. `packages/runtime/src/runtime.ts` is below the 700-line warning threshold or its remaining line count is not flagged by `aislop`.
  3. `createRuntime` is below the 150-line function threshold and no longer triggers deep nesting.
  4. `handleRelayMessage` is below the 150-line function threshold and no longer triggers deep nesting.
  5. Runtime package build/type/unit coverage passes after extraction.

**Plans**: To be created by `$gsd-plan-phase 73`

### Phase 74: Playground Shell Decomposition

**Goal**: Remove structural scanner warnings from the playground app shell and boot path.

**Depends on**: Phase 73

**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04

**Rationale**: `main.ts` and `shell-host.ts` are large integration surfaces. Keeping them in one phase lets the plan choose coherent module seams around app wiring, demo hooks, and boot behavior without mixing in runtime package refactors.

**Success Criteria** (what must be TRUE):
  1. `apps/playground/src/main.ts` no longer triggers the 700-line file-size warning.
  2. `apps/playground/src/shell-host.ts` no longer triggers the 700-line file-size warning.
  3. `createDemoHooks` no longer triggers the 150-line function warning.
  4. `bootShell` no longer triggers the 150-line function warning or deep-nesting warning.
  5. Playground build/unit/static checks covering demo boot still pass.

**Plans**: To be created by `$gsd-plan-phase 74`

### Phase 75: Service and Adapter Decomposition

**Goal**: Remove the remaining long-function warnings outside runtime core and playground shell boot.

**Depends on**: Phase 74

**Requirements**: PLAY-05, PLAY-06, SVC-01, SVC-02, SVC-03, ADAPT-01

**Rationale**: These warnings are smaller and more localized than the runtime/shell files. They can be handled as bounded helper extractions with focused tests around each surface.

**Success Criteria** (what must be TRUE):
  1. `openPolicyModal` no longer triggers the 150-line function warning.
  2. `createNip46Client` no longer triggers the 150-line function warning.
  3. `createMediaService`, `createNotificationService`, and `createResourceService` no longer trigger 150-line function warnings.
  4. `adaptHooks` no longer triggers the 150-line function warning.
  5. Focused unit or static guards protect any extracted behavior that was not already covered.

**Plans**: To be created by `$gsd-plan-phase 75`

### Phase 76: Structural Gate Verification

**Goal**: Prove v1.16 eliminated the structural warning baseline and preserved the v1.15 clean engines.

**Depends on**: Phase 75

**Requirements**: SCAN-02, SCAN-03, VERIFY-01, VERIFY-02

**Rationale**: Structural cleanup succeeds only if the local scanner reaches zero warnings without weakening policy or breaking the repo gates that prove behavior is intact.

**Success Criteria** (what must be TRUE):
  1. Final `npx --no-install aislop scan -d` reports 0 errors, 0 warnings, and 0 fixable findings.
  2. `.aislop/config.yml` thresholds remain unchanged from the v1.15 closeout baseline unless an approved phase artifact records a policy decision.
  3. `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and `pnpm --dir docs docs:build` pass.
  4. Phase verification evidence names the tests or guards covering each extracted boundary.
  5. `git diff --check` passes and closeout artifacts state any remaining non-scanner risks.

**Plans**: To be created by `$gsd-plan-phase 76`

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 73. Runtime Core Decomposition | 0/1 | Pending | — |
| 74. Playground Shell Decomposition | 0/1 | Pending | — |
| 75. Service and Adapter Decomposition | 0/1 | Pending | — |
| 76. Structural Gate Verification | 0/1 | Pending | — |

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

*ROADMAP.md last updated: 2026-05-24 - v1.16 roadmap created.*
