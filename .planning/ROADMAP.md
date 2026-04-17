# Roadmap: Kehto Runtime

## Completed Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))

---

## Current Milestone: v1.2 — NIP-5D Conformance & Full NUB Coverage

**Goal:** Align @kehto packages with the current NIP-5D spec and consume every supported `@napplet/nub-*` package, closing the `theme` gap and adopting napplet/core's formal dispatch API.

**Phases:** 10–15 (6 phases) | **Requirements:** 20/20 mapped

### Phase Numbering

- Integer phases (10, 11, …): Planned milestone work
- Decimal phases (e.g., 12.1): Urgent insertions (if any)
- Phase numbering continues from v1.1's final phase (9); no reset.

## Phases

- [ ] **Phase 10: Spec Conformance Audit** — Carry an authoritative NIP-5D reference and document every drift item across all 4 packages.
- [ ] **Phase 11: Nub Peer Deps & Type Imports** — Bump `@napplet/core` to `^0.2.0`, add the five `@napplet/nub-*` peer deps, replace hand-copied types with real imports.
- [ ] **Phase 12: Four-Nub Full Coverage & Drift Fixes** — Close every ifc/relay/signer/storage message gap, resolve audit drift, and extend ACL capability mapping to the full surface.
- [ ] **Phase 13: Theme Nub Implementation** — Add the fifth nub end-to-end: runtime route, reference service, shell adapter, and ACL gates.
- [ ] **Phase 14: Dispatch Refactor** — Replace the hand-rolled switch with napplet/core's `createDispatch()` / `registerNub()` / `dispatch()` infrastructure.
- [ ] **Phase 15: Milestone Validation & Release Prep** — Green tests against the new peer-dep set and changesets for every republished package.

## Phase Details

### Phase 10: Spec Conformance Audit
**Goal**: Produce an authoritative, cross-package inventory of every way kehto drifts from the current NIP-5D spec.
**Depends on**: Nothing (first phase of milestone; follows v1.1 phase 9)
**Requirements**: SPEC-01, SPEC-02
**Success Criteria** (what must be TRUE):
  1. A contributor can open kehto's repo and find the current NIP-5D spec at a single, documented location (local copy or versioned pointer to `napplet/specs/NIP-5D.md`).
  2. A written audit document lists every spec requirement that is not yet satisfied by @kehto/runtime, @kehto/shell, @kehto/acl, or @kehto/services, grouped by package.
  3. Every drift item in the audit has a concrete owning package and a one-line remediation note, so it can be fed directly into Phase 12 plans.
**Plans**: TBD

### Phase 11: Nub Peer Deps & Type Imports
**Goal**: Kehto consumes napplet's new package graph — `@napplet/core@^0.2.0` plus all five `@napplet/nub-*` packages — and speaks their types directly instead of local duplicates.
**Depends on**: Phase 10 (audit informs which files need retyping)
**Requirements**: DEPS-01, NUB-01, NUB-02
**Success Criteria** (what must be TRUE):
  1. `pnpm -r exec cat package.json` shows `@napplet/core` at `^0.2.0` and the five `@napplet/nub-*` packages declared as peer deps on the relevant @kehto/* packages.
  2. All kehto source files that previously hand-copied NUB message types or constants now import them from the matching `@napplet/nub-*` package — no duplicate type aliases remain.
  3. `pnpm build` and `pnpm type-check` succeed on a clean install against the new peer-dep set.
**Plans**: TBD

### Phase 12: Four-Nub Full Coverage & Drift Fixes
**Goal**: @kehto/runtime dispatches — and @kehto/services handles — every message type exported by the ifc, relay, signer, and storage nubs, while fixing every drift item found by Phase 10. ACL capability mapping is extended to cover the full nub message surface.
**Depends on**: Phase 11
**Requirements**: SPEC-03, NUB-03, NUB-04, NUB-05, NUB-06, NUB-07
**Success Criteria** (what must be TRUE):
  1. Every message type exported by `@napplet/nub-ifc` (including `emit`, `subscribe`, `unsubscribe`, `event`, and the `channel.*` sub-protocol) flows through runtime dispatch into a reference service handler with a typed result/event envelope.
  2. Every message type exported by `@napplet/nub-relay`, `@napplet/nub-signer` (getPublicKey, signEvent, getRelays, nip04/44 encrypt + decrypt + their results), and `@napplet/nub-storage` is dispatched and produces the spec-correct result or error envelope.
  3. Every drift item identified in the Phase 10 audit is resolved in code, with the audit document updated to reflect closure.
  4. `resolveCapabilitiesNub` in @kehto/acl maps a capability for every message type exposed by all four non-theme nubs — no NUB message reaches runtime without an explicit ACL entry.
**Plans**: TBD

### Phase 13: Theme Nub Implementation
**Goal**: Add the fifth NUB domain — `theme` — as a first-class citizen across runtime, services, shell, and ACL, matching the pattern of the other four nubs.
**Depends on**: Phase 11 (needs nub-theme types); independent of Phase 12 drift work.
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04
**Success Criteria** (what must be TRUE):
  1. A napplet that sends `theme.get` through the shell receives a `theme.get.result` envelope from @kehto/runtime, routed through the theme dispatch route.
  2. The reference theme service in @kehto/services answers `theme.get` with the current theme and broadcasts `theme.changed` when the host updates it.
  3. The hosting application can call a documented @kehto/shell adapter API to publish a theme change, and all registered napplets observe a `theme.changed` event.
  4. A napplet without the `theme` capability is denied via @kehto/acl with the same error shape used by the other four nubs.
**Plans**: TBD

### Phase 14: Dispatch Refactor
**Goal**: Replace @kehto/runtime's hand-rolled domain switch with napplet/core's formal dispatch infrastructure, so kehto matches the spec's dispatch contract instead of reimplementing it.
**Depends on**: Phase 12, Phase 13 (all five domain handlers must be complete and green before the switch is removed).
**Requirements**: DISPATCH-01, DISPATCH-02, DISPATCH-03
**Success Criteria** (what must be TRUE):
  1. @kehto/runtime constructs its dispatcher via `createDispatch()` imported from `@napplet/core` — no local dispatcher class remains.
  2. All five nub domain handlers (ifc, relay, signer, storage, theme) are registered through `registerNub()` at runtime startup.
  3. The inbound message path in `runtime.ts` contains no domain-specific `switch` or `if (type === …)` branches for NUB messages; routing delegates entirely to `dispatch()`.
**Plans**: TBD

### Phase 15: Milestone Validation & Release Prep
**Goal**: Prove the milestone is shippable — every existing test passes against the new peer-dep set, and every republished kehto package has a changeset.
**Depends on**: Phase 14
**Requirements**: DEPS-02, DEPS-03
**Success Criteria** (what must be TRUE):
  1. `pnpm -r test` passes green with `@napplet/core@0.2.0` and the five `@napplet/nub-*` peer deps resolved — all ~170 existing tests from v1.1 still pass, plus any new tests added in Phases 12–13.
  2. Every @kehto/* package that ships code changes in v1.2 has a changeset entry in `.changeset/` describing the change.
  3. `pnpm build` produces clean ESM output for all four packages with no type errors.
**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 10 → 11 → 12 → 13 → 14 → 15 (13 may run in parallel with 12 once Phase 11 is green).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Spec Conformance Audit | 0/TBD | Not started | - |
| 11. Nub Peer Deps & Type Imports | 0/TBD | Not started | - |
| 12. Four-Nub Full Coverage & Drift Fixes | 0/TBD | Not started | - |
| 13. Theme Nub Implementation | 0/TBD | Not started | - |
| 14. Dispatch Refactor | 0/TBD | Not started | - |
| 15. Milestone Validation & Release Prep | 0/TBD | Not started | - |
