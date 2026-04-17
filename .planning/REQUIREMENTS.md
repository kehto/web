# Requirements: v1.2 NIP-5D Conformance & Full NUB Coverage

**Milestone:** v1.2
**Defined:** 2026-04-17
**Status:** Roadmapped (phases 10–15)

## Overview

Align @kehto with the current NIP-5D spec (as maintained in `napplet/specs/NIP-5D.md`), consume every `@napplet/nub-*` package as a peer dependency, implement the missing `theme` domain, and adopt napplet/core's formal dispatch infrastructure.

**REQ-ID format:** `[CATEGORY]-[NUMBER]`

---

## Category 1: NIP-5D Spec Conformance (SPEC)

- [x] **SPEC-01**: kehto repo carries an authoritative reference to the current NIP-5D spec (local copy or versioned pointer to `napplet/specs/NIP-5D.md`)
- [ ] **SPEC-02**: Cross-package audit documents every NIP-5D requirement not yet satisfied by kehto (runtime, shell, acl, services)
- [ ] **SPEC-03**: All drift items identified by SPEC-02 are resolved in code

## Category 2: NUB Package Adoption (NUB)

- [ ] **NUB-01**: `@napplet/nub-ifc`, `@napplet/nub-relay`, `@napplet/nub-signer`, `@napplet/nub-storage`, and `@napplet/nub-theme` are declared as peer dependencies on the relevant kehto packages
- [ ] **NUB-02**: Hand-copied NUB message type and constant definitions in kehto are replaced with imports from the respective `@napplet/nub-*` package
- [ ] **NUB-03**: Every message type exported by `@napplet/nub-ifc` (emit, subscribe, unsubscribe, event, and channel.* sub-protocol) is dispatched by @kehto/runtime and handled by the reference service
- [ ] **NUB-04**: Every message type exported by `@napplet/nub-relay` is dispatched and produces the corresponding result/event envelope
- [ ] **NUB-05**: Every message type exported by `@napplet/nub-signer` (getPublicKey, signEvent, getRelays, nip04/44 encrypt/decrypt + results) is dispatched and handled
- [ ] **NUB-06**: Every message type exported by `@napplet/nub-storage` is dispatched and produces the corresponding result envelope
- [ ] **NUB-07**: @kehto/acl capability mapping covers the full message surface exposed by each `@napplet/nub-*` package

## Category 3: Theme NUB Implementation (THEME)

- [ ] **THEME-01**: @kehto/runtime registers a `theme` dispatch route that accepts `theme.get` and returns `theme.get.result`
- [ ] **THEME-02**: @kehto/services provides a reference theme service that handles `theme.get` and broadcasts `theme.changed` on updates
- [ ] **THEME-03**: @kehto/shell exposes an adapter API for the hosting application to publish theme changes to registered napplets
- [ ] **THEME-04**: @kehto/acl enforces capability gates for the `theme` domain consistent with the other four nubs

## Category 4: Dispatch Refactor (DISPATCH)

- [ ] **DISPATCH-01**: @kehto/runtime creates its dispatcher via `createDispatch()` from @napplet/core instead of the hand-rolled switch
- [ ] **DISPATCH-02**: All five nub domain handlers are registered via `registerNub()`
- [ ] **DISPATCH-03**: Inbound envelope routing in `runtime.ts` delegates to `dispatch()` with no domain-specific branching

## Category 5: Peer Dep Upgrade (DEPS)

- [ ] **DEPS-01**: `@napplet/core` peer-dep range is bumped from `>=0.1.0` to `^0.2.0` across @kehto/acl, @kehto/runtime, @kehto/shell, and @kehto/services
- [ ] **DEPS-02**: Changeset entries are added for each kehto package that is republished in this milestone
- [ ] **DEPS-03**: All existing tests pass against `@napplet/core@0.2.0` and the new `@napplet/nub-*` peer deps

---

## Future Requirements

Items intentionally deferred beyond v1.2:

- Publishing `@napplet/core` (and thus a stable kehto) to npm — blocked by upstream napplet release cadence
- CI/CD pipeline — listed as a standing blocker; not part of this milestone
- Additional nub domains not yet defined in `@napplet/*` — will be picked up as those packages land

## Out of Scope

Explicit exclusions for v1.2:

- New product features beyond the five existing NUB domains — **why:** this milestone is a conformance/catch-up pass, not a feature expansion
- Backwards compatibility with the pre-envelope NIP-01 array format — **why:** clean break was completed in v1.1 and is not being re-litigated
- Migration from peer deps to bundled deps — **why:** user confirmed peer-dep shape to mirror the `@napplet/core` pattern
- Reshuffling kehto package boundaries (e.g., splitting services into per-NUB packages) — **why:** current 4-package split is stable; re-architecture would exceed milestone scope

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| SPEC-01 | Phase 10 |
| SPEC-02 | Phase 10 |
| SPEC-03 | Phase 12 |
| NUB-01 | Phase 11 |
| NUB-02 | Phase 11 |
| NUB-03 | Phase 12 |
| NUB-04 | Phase 12 |
| NUB-05 | Phase 12 |
| NUB-06 | Phase 12 |
| NUB-07 | Phase 12 |
| THEME-01 | Phase 13 |
| THEME-02 | Phase 13 |
| THEME-03 | Phase 13 |
| THEME-04 | Phase 13 |
| DISPATCH-01 | Phase 14 |
| DISPATCH-02 | Phase 14 |
| DISPATCH-03 | Phase 14 |
| DEPS-01 | Phase 11 |
| DEPS-02 | Phase 15 |
| DEPS-03 | Phase 15 |

**Coverage:** 20/20 requirements mapped — no orphans, no duplicates.

---
*Last updated: 2026-04-17*
