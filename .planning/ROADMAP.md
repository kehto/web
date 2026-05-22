# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** — 5 phases (32–36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** — 5 phases (37–41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** — 5 phases (42–46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** — 3 phases (47–49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [ ] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** — 3 phases (50-52), 10/10 requirements mapped

---

## v1.10: Compatibility Window Cleanup & Decrypt Demo Parity

**Goal:** Close the v1.8/v1.9 cleanup window without crossing a v2 boundary: remove the stale identity-topic compatibility branch, migrate `decrypt-demo` to the `@napplet/nub@0.3.0` `identityDecrypt` helper, and retire the remaining old demo package graph.

**E2E baseline entering v1.10:** 86 passed / 0 failed / 0 skipped.

**Coverage:** 10/10 requirements mapped.

**Cleanup scope:** `ShellBridge.injectEvent()` still dual-emits deprecated `auth:identity-changed`, while `decrypt-demo` still carries old `@napplet/shim` / `@napplet/vite-plugin` `^0.2.1` package edges and manual `identity.decrypt` envelope plumbing. v1.10 turns both into current v1 behavior before broader host-bridge or CI expansion work.

### Phases

- [ ] **Phase 50: Identity Topic Hard Removal** — Remove the `auth:identity-changed` compatibility branch, update the shell bridge tests/docs, and make canonical `identity:changed` single-emission the only current behavior.
- [ ] **Phase 51: Decrypt Demo Helper Parity** — Move `decrypt-demo` to exact `0.3.0` napplet helper packages and replace manual `identity.decrypt` postMessage plumbing with `identityDecrypt`.
- [ ] **Phase 52: Regression Guard + Full Verification** — Extend guardrails around the remaining old package graph/raw decrypt pattern, clean docs/release notes, and run the full build/type/unit/E2E loop.

---

## Phase Details

### Phase 50: Identity Topic Hard Removal

**Goal**: Remove the one-release identity-topic compatibility branch so canonical `identity:changed` injection emits once and deprecated `auth:identity-changed` receives no special fan-out handling.

**Depends on**: v1.9 archived; consumers have had one release with the soft-rename compatibility path.

**Requirements**: RENAME-HARD-01, RENAME-HARD-02

**Rationale**: This is the smallest breaking cleanup and should happen before broader demo graph work so shell behavior is clear. The branch already carries its own removal beacon, and leaving it in place after v1.9 would keep tests and API docs teaching deprecated behavior.

**Success Criteria** (what must be TRUE):
  1. `ShellBridge.injectEvent()` no longer contains the `OLD_IDENTITY_TOPIC` / `NEW_IDENTITY_TOPIC` dual-emit branch or the `remove this branch in v1.9` comment.
  2. Canonical `identity:changed` injection sends exactly one envelope to the target napplet.
  3. Deprecated `auth:identity-changed` input is treated like any other generic topic and emits only that supplied topic once.
  4. Shell bridge tests, generated/source API docs, and changeset prose describe only the current canonical behavior.

**Plans**: Not planned yet

### Phase 51: Decrypt Demo Helper Parity

**Goal**: Bring `decrypt-demo` onto the same published `0.3.0` helper surface as the v1.9 migrated demos by using `identityDecrypt` and removing the local raw-envelope request/reply shim.

**Depends on**: Phase 50

**Requirements**: DECRYPT-DEMO-01, DECRYPT-DEMO-02, DECRYPT-DEMO-03

**Rationale**: `decrypt-demo` was intentionally excluded from v1.9 because it did not depend on `@napplet/sdk`, but it is still the only active demo carrying old `0.2.1` shim/vite-plugin edges. Migrating it now closes that package graph residue without expanding into resource/toaster helper gaps that upstream does not currently cover.

**Success Criteria** (what must be TRUE):
  1. `apps/playground/napplets/decrypt-demo/package.json` declares exact `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0` dependencies and no `0.2.1` napplet helper range.
  2. `decrypt-demo` imports `identityDecrypt` from the published helper surface and no longer constructs local request IDs, pending maps, or `window.parent.postMessage({ type: 'identity.decrypt', ... })` requests.
  3. Happy-path decrypt output and class-2 forbidden error output preserve the existing DOM sentinels expected by Playwright.
  4. The focused decrypt-demo package build and `tests/e2e/decrypt-demo.spec.ts` pass.

**Plans**: Not planned yet

### Phase 52: Regression Guard + Full Verification

**Goal**: Lock the cleanup so the old identity compatibility branch, `0.2.1` decrypt-demo graph, and manual decrypt-envelope workaround cannot silently return.

**Depends on**: Phase 51

**Requirements**: GRAPH-01, GUARD-02, E2E-31, E2E-32, DOCS-09

**Rationale**: The milestone is complete only when the local code, lockfile graph, docs, and tests all agree that v1.10 has no remaining active `0.2.1` demo edge and no supported dual-topic identity path. Keeping guard/doc cleanup in the final phase prevents stale teaching from surviving after behavior changes land.

**Success Criteria** (what must be TRUE):
  1. Static guard coverage fails on old `@napplet/shim@0.2.1` / `@napplet/vite-plugin@0.2.1` active demo graph entries and on reintroduced manual decrypt raw-envelope plumbing where `identityDecrypt` covers the behavior.
  2. Lockfile/importer evidence shows no active demo or fixture package resolves the old decrypt-demo `0.2.1` helper graph.
  3. `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e` pass from a clean tree; Playwright remains at 86 passed / 0 failed / 0 skipped unless an intentional new spec changes the count.
  4. `.planning/REQUIREMENTS.md` remains 10/10 mapped with zero uncovered v1 requirements.
  5. Source comments, generated API docs, and changeset/release-note prose point future consumers to `identity:changed` and `identityDecrypt`.

**Plans**: Not planned yet

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 50. Identity Topic Hard Removal | 0/0 | Pending | — |
| 51. Decrypt Demo Helper Parity | 0/0 | Pending | — |
| 52. Regression Guard + Full Verification | 0/0 | Pending | — |

---

*ROADMAP.md last updated: 2026-05-22 — v1.10 roadmap created.*
