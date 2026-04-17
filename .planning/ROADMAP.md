# Roadmap: Kehto Runtime

## Completed Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))

---

## Current Milestone: v1.2 — NIP-5D Conformance & Full NUB Coverage

**Goal:** Align @kehto packages with the canonical NIP-5D spec (dskvr/nips branch `nip/5d`), consume every supported `@napplet/nub-*` package (8 domains), reverse the v1.1 `window.nostr` injection to match the shell-mediated security model, close the `theme` gap, and adopt napplet/core's formal dispatch API.

**Phases:** 10–15 (6 phases) | **Requirements:** 26/26 mapped

### Phase Numbering

- Integer phases (10, 11, …): Planned milestone work
- Decimal phases (e.g., 12.1): Urgent insertions (if any)
- Phase numbering continues from v1.1's final phase (9); no reset.

### Rescope note

This milestone was rescoped on 2026-04-17 after:
1. The canonical NIP-5D source of truth was fixed to `https://github.com/dskvr/nips/tree/nip/5d` (was previously napplet's local copy)
2. Upstream napplet reconciled to an 8-nub protocol model (replaced `signer` with `identity` + shell-mediated signing via `relay.publish` / `relay.publishEncrypted`; added `keys` for keyboard actions, `media` for MediaSession, `notify` for notifications)
3. The canonical spec now explicitly forbids shell-provided `window.nostr` (reverses v1.1 `SH-I02`)

Prior Phase 10 output (audit against 5-nub model + older napplet spec) was invalidated and deleted. Phase numbering preserved; content rewritten.

## Phases

- [x] **Phase 10: Spec Conformance Audit** — Pin canonical NIP-5D at `specs/NIP-5D.md` and produce a cross-package drift audit covering spec text + 8-nub message surface. (completed 2026-04-17)
- [x] **Phase 11: Nub Peer Deps & Type Imports** — Bump `@napplet/core` to `^0.2.0`, add the eight `@napplet/nub-*` peer deps, replace hand-copied types (including the old `signer.*` set) with imports. (completed 2026-04-17)
- [ ] **Phase 12: Shell Conformance & Seven-Nub Coverage** — Remove `window.nostr` injection, rename to `perm:*` namespace, mediate signing/encryption through the shell, and close every drift item for the seven non-theme nubs (identity, ifc, keys, media, notify, relay, storage) — including ACL capability mapping for the full surface.
- [ ] **Phase 13: Theme Nub Implementation** — Add the eighth nub end-to-end: runtime route, reference service, shell adapter, ACL gates.
- [ ] **Phase 14: Dispatch Refactor** — Replace the hand-rolled switch with napplet/core's `createDispatch()` / `registerNub()` / `dispatch()` infrastructure; register all 8 nub handlers through it.
- [ ] **Phase 15: Milestone Validation & Release Prep** — Green tests against the new peer-dep set (with `signer.*` tests migrated or deleted) and changesets for every republished package.

## Phase Details

### Phase 10: Spec Conformance Audit
**Goal**: Produce an authoritative, cross-package inventory of every way kehto drifts from the canonical NIP-5D spec and the 8-nub napplet message surface.
**Depends on**: Nothing (first phase of milestone; follows v1.1 phase 9).
**Requirements**: SPEC-01, SPEC-02
**Success Criteria** (what must be TRUE):
  1. A contributor can open kehto's repo and find the canonical NIP-5D spec at `specs/NIP-5D.md`, with README pointing at the upstream source `https://github.com/dskvr/nips/tree/nip/5d`.
  2. A written audit document lists every spec requirement that is not yet satisfied by @kehto/runtime, @kehto/shell, @kehto/acl, or @kehto/services, grouped by package. The audit explicitly covers: `window.nostr` (MUST NOT be provided), `shell.supports('perm:*')` naming, shell-mediated signing/encryption, and every message type exported by all 8 `@napplet/nub-*` packages.
  3. Every drift item in the audit has a concrete owning package, a one-line remediation note, and a Target Phase (12/13/14) so downstream plans can be generated mechanically.
**Plans**: 2 plans
  - [x] 10-01-PLAN.md — Verify canonical NIP-5D spec and README pointer (SPEC-01)
  - [x] 10-02-PLAN.md — Produce cross-package drift audit at docs/v1.2-NIP-5D-AUDIT.md (SPEC-02)

### Phase 11: Nub Peer Deps & Type Imports
**Goal**: Kehto consumes napplet's new package graph — `@napplet/core@^0.2.0` plus all eight `@napplet/nub-*` packages — and speaks their types directly instead of local duplicates.
**Depends on**: Phase 10 (audit informs which files need retyping).
**Requirements**: DEPS-01, NUB-01, NUB-02
**Success Criteria** (what must be TRUE):
  1. Every `@kehto/*` package.json shows `@napplet/core` at `^0.2.0` and all 8 `@napplet/nub-*` packages declared as peer deps at `^0.2.0`.
  2. All kehto source files that previously hand-copied NUB message types or constants now import them from the matching `@napplet/nub-*` package — no duplicate type aliases remain. Hand-copied `signer.*` types and locally declared signer interfaces are deleted.
  3. `pnpm build` and `pnpm type-check` succeed on a clean install against the new peer-dep set. Type errors at signer call sites are stubbed or widened intentionally with `// DRIFT-* — Phase 12` markers so Phase 12 plans can close them.
**Plans**: 2 plans
  - [x] 11-01-PLAN.md — Bump @napplet/core to ^0.2.0, declare 8 @napplet/nub-* peer deps, add pnpm overrides, verify clean install (DEPS-01, NUB-01)
  - [x] 11-02-PLAN.md — Replace hand-copied/msg-as-any NUB types with `import type` from @napplet/nub-* packages; annotate signer.* call sites with DRIFT-<ID> — Phase 12 markers; green build + type-check (NUB-02)

### Phase 12: Shell Conformance & Seven-Nub Coverage
**Goal**: Remove every canonical-NIP-5D violation in @kehto/shell, close every drift item for the seven non-theme nubs, and extend ACL capability mapping to the full 8-domain surface (theme-domain ACL also lands here since it's trivial to add alongside the others — theme's runtime/service/shell wiring is Phase 13).
**Depends on**: Phase 11 (nub types must resolve; peer-dep set must be installed).
**Requirements**: SPEC-03, SH-C01, SH-C02, SH-C03, NUB-03, NUB-04, NUB-05, NUB-06, NUB-07, NUB-08, NUB-09, NUB-10
**Success Criteria** (what must be TRUE):
  1. @kehto/shell emits zero `window.nostr` references in source and tests; a dedicated regression test asserts napplet iframes do not see `window.nostr` at any lifecycle point.
  2. `shell.supports()` uses the `perm:<permission>` namespace for every sandbox permission check; NUB-capability lookups retain bare names. A focused test covers the rename.
  3. Every message type exported by `@napplet/nub-identity`, `-ifc`, `-keys`, `-media`, `-notify`, `-relay`, and `-storage` flows through runtime dispatch to a service handler, producing the spec-correct result or error envelope. `relay.publish` and `relay.publishEncrypted` are the only paths that touch signing/encryption, and those happen inside the shell.
  4. Every drift item identified in the Phase 10 audit targeted at Phase 12 is resolved in code, with the audit document updated to reflect closure.
  5. `resolveCapabilitiesNub` in @kehto/acl maps a capability for every message type exposed by all 8 nub packages — no NUB message reaches runtime without an explicit ACL entry.
**Plans**: TBD

### Phase 13: Theme Nub Implementation
**Goal**: Add the `theme` NUB end-to-end — runtime route, reference service, shell adapter API, plus any theme-specific tests. ACL mapping for `theme` already landed in Phase 12's NUB-10 work, so this phase is purely behavioral.
**Depends on**: Phase 11 (needs nub-theme types); independent of Phase 12 drift work.
**Requirements**: TH-01, TH-02, TH-03, TH-04
**Success Criteria** (what must be TRUE):
  1. A napplet that sends `theme.get` through the shell receives a `theme.get.result` envelope from @kehto/runtime.
  2. The reference theme service in @kehto/services answers `theme.get` with the current theme and broadcasts `theme.changed` when the host updates it.
  3. The hosting application can call a documented @kehto/shell adapter API to publish a theme change, and all registered napplets observe a `theme.changed` event.
  4. A napplet without the `theme` capability is denied via @kehto/acl with the same error shape used by the other seven nubs.
**Plans**: TBD

### Phase 14: Dispatch Refactor
**Goal**: Replace @kehto/runtime's hand-rolled domain switch with napplet/core's formal dispatch infrastructure, so kehto matches the spec's dispatch contract instead of reimplementing it.
**Depends on**: Phase 12 + Phase 13 (all eight domain handlers must be complete and green before the switch is removed).
**Requirements**: DISPATCH-01, DISPATCH-02, DISPATCH-03
**Success Criteria** (what must be TRUE):
  1. @kehto/runtime constructs its dispatcher via `createDispatch()` imported from `@napplet/core` — no local dispatcher class remains.
  2. All eight nub domain handlers (identity, ifc, keys, media, notify, relay, storage, theme) are registered through `registerNub()` at runtime startup.
  3. The inbound message path in `runtime.ts` contains no domain-specific `switch` or `if (type === …)` branches for NUB messages; routing delegates entirely to `dispatch()`.
**Plans**: TBD

### Phase 15: Milestone Validation & Release Prep
**Goal**: Prove the milestone is shippable — every existing test passes against the new peer-dep set, and every republished kehto package has a changeset.
**Depends on**: Phase 14.
**Requirements**: DEPS-02, DEPS-03
**Success Criteria** (what must be TRUE):
  1. `pnpm -r test` passes green with `@napplet/core@0.2.0` and the eight `@napplet/nub-*` peer deps resolved. Tests tied to removed `signer.*` functionality have been migrated to `identity.*` / `relay.publishEncrypted` semantics or deleted with a recorded rationale.
  2. Every `@kehto/*` package that ships code changes in v1.2 has a changeset entry in `.changeset/` describing the change.
  3. `pnpm build` produces clean ESM output for all four packages with no type errors.
**Plans**: TBD

## Progress

**Execution Order:** 10 → 11 → 12 → 13 → 14 → 15 (Phase 13 may run in parallel with Phase 12 once Phase 11 is green).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Spec Conformance Audit | 2/2 | Complete    | 2026-04-17 |
| 11. Nub Peer Deps & Type Imports | 2/2 | Complete   | 2026-04-17 |
| 12. Shell Conformance & Seven-Nub Coverage | 0/TBD | Not started | - |
| 13. Theme Nub Implementation | 0/TBD | Not started | - |
| 14. Dispatch Refactor | 0/TBD | Not started | - |
| 15. Milestone Validation & Release Prep | 0/TBD | Not started | - |
