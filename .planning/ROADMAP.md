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
- [ ] **v1.15: Address AI Slop** - 4 phases (68-71), 20 requirements, AI-slop/security quality-gate repair; 2/4 phases complete

---

## Active Milestone

### v1.15: Address AI Slop

**Goal:** Restore a credible quality-gate baseline by fixing the failing AI-slop/security findings without changing Kehto runtime behavior.

**Baseline entering v1.15:** v1.14 is archived with the public `/web/` portal, playground, docs, and route-shape deploy gate. The new input is an `aislop 0.9.3` report over 123 scanned TypeScript files: formatting clean, 38 lint warnings, 46 code-quality warnings, 1 AI Slop error plus warnings, 37 Security errors, and 461 fixable findings.

**Coverage:** 20/20 requirements mapped.

**Critical invariant:** Cleanup must preserve the v1.14 runtime and static publication behavior. Direct DOM rendering fixes and type cleanup should remove quality-gate risk without changing NIP-5D protocol behavior, public package contracts, or the playground route contract.

### Phases

- [x] **Phase 68: Gate Baseline and Mechanical Cleanup** - Establish reproducible quality-gate evidence and clear import, duplicate-import, unused-code, console, spread, and comment findings that are low-risk and mostly mechanical.
- [x] **Phase 69: Safe DOM Rendering and Scanner Cleanup** - Replace direct `innerHTML` writes and resolve the hardcoded-secret scanner hit without weakening demo behavior.
- [ ] **Phase 70: Type Safety, Maintainability, and Dependency Triage** - Narrow unsafe casts, triage thin wrappers/duplicate blocks/complexity warnings, and resolve or document existing dependency audit warnings.
- [ ] **Phase 71: Quality Gate Verification and Closeout** - Re-run the quality gate and repo verification suite, record before/after evidence, and close the milestone with zero fatal AI Slop/Security errors.

---

## Phase Details

### Phase 68: Gate Baseline and Mechanical Cleanup

**Goal**: Make the reported quality gate reproducible and remove low-risk slop/lint findings before deeper edits.

**Depends on**: v1.15 requirements accepted; supplied `aislop 0.9.3` report.

**Requirements**: GATE-01, LINT-01, LINT-02, LINT-03, LINT-04, SLOP-01, SLOP-02

**Rationale**: Mechanical cleanup should happen before security and type work so later diffs are easier to review and the one fatal undeclared import does not mask other findings.

**Success Criteria** (what must be TRUE):
  1. The quality-gate invocation or documented equivalent is captured in the phase artifacts.
  2. The undeclared `@napplet/services` import is corrected or backed by a manifest change.
  3. Duplicate imports, unused imports/locals, unnecessary spread fallbacks, and leftover console calls reported in touched files are removed or made intentionally explicit.
  4. Decorative and trivial comments are removed where they do not preserve API or protocol context.
  5. Build and type-check still pass after the mechanical cleanup.

**Plans**: [68-01-PLAN.md](phases/68-gate-baseline-and-mechanical-cleanup/68-01-PLAN.md)

**Completed**: 2026-05-24 ([summary](phases/68-gate-baseline-and-mechanical-cleanup/68-01-SUMMARY.md) | [verification](phases/68-gate-baseline-and-mechanical-cleanup/68-VERIFICATION.md))

### Phase 69: Safe DOM Rendering and Scanner Cleanup

**Goal**: Remove the fatal DOM/security findings while keeping playground rendering behavior intact.

**Depends on**: Phase 68

**Requirements**: SEC-01, SEC-02, SEC-03

**Rationale**: Direct `innerHTML` assignment is the largest fatal class in the report. It should be repaired with native DOM/text APIs or existing helpers, not by adding sanitization dependencies.

**Success Criteria** (what must be TRUE):
  1. Report-flagged direct `innerHTML` assignments are gone from playground napplets and shell UI source.
  2. Dynamic user, relay, event, fixture, and demo status values render via `textContent`, DOM construction, or an existing safe helper.
  3. The `nip46-client.ts` hardcoded-secret scanner hit is removed or made clearly non-secret demo fixture data.
  4. Existing playground smoke/unit coverage still passes for the changed rendering paths.

**Plans**: [69-01-PLAN.md](phases/69-safe-dom-rendering-and-scanner-cleanup/69-01-PLAN.md)

**Completed**: 2026-05-24 ([summary](phases/69-safe-dom-rendering-and-scanner-cleanup/69-01-SUMMARY.md) | [verification](phases/69-safe-dom-rendering-and-scanner-cleanup/69-VERIFICATION.md))

### Phase 70: Type Safety, Maintainability, and Dependency Triage

**Goal**: Reduce unsafe type and maintainability findings without broad, unprotected rewrites.

**Depends on**: Phase 69

**Requirements**: SLOP-03, TYPE-01, TYPE-02, QUAL-01, DEPS-01

**Rationale**: The report contains many warning-only findings that range from safe local cleanup to large UI decomposition. This phase separates feasible type/helper repairs from deferrals that need their own behavior locks.

**Success Criteria** (what must be TRUE):
  1. Double assertions and `as any` uses in runtime/services code are replaced or narrowed where local types can express the boundary.
  2. Thin wrappers are inlined unless they preserve a named boundary used by callers or tests.
  3. Duplicate blocks and complexity findings are triaged, with only low-risk helper extractions applied.
  4. Existing dependency audit warnings are resolved through safe upgrades or documented as explicit deferrals with rationale.
  5. Build, type-check, and unit tests pass after type/dependency changes.

**Plans**: Pending

### Phase 71: Quality Gate Verification and Closeout

**Goal**: Prove v1.15 restored the quality-gate baseline and preserve closeout evidence.

**Depends on**: Phase 70

**Requirements**: GATE-02, GATE-03, VERIFY-01, VERIFY-02, VERIFY-03

**Rationale**: The milestone only succeeds if the fatal AI Slop/Security findings are actually gone and the existing v1.14 behavior gates remain green.

**Success Criteria** (what must be TRUE):
  1. Final quality-gate evidence records zero AI Slop errors and zero Security errors for the reported fatal categories.
  2. Before/after counts are recorded, including warning classes intentionally deferred.
  3. `pnpm build`, `pnpm type-check`, and `pnpm test:unit` pass.
  4. Applicable static guards pass, including `pnpm audit:csp`, `pnpm audit:gateway-artifacts`, and route/docs checks affected by changed files.
  5. `git diff --check` passes and closeout artifacts state remaining risks.

**Plans**: Pending

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 68. Gate Baseline and Mechanical Cleanup | 1/1 | Completed | 2026-05-24 |
| 69. Safe DOM Rendering and Scanner Cleanup | 1/1 | Completed | 2026-05-24 |
| 70. Type Safety, Maintainability, and Dependency Triage | 0/1 | Not Started | — |
| 71. Quality Gate Verification and Closeout | 0/1 | Not Started | — |

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

*ROADMAP.md last updated: 2026-05-24 - v1.15 roadmap created.*
