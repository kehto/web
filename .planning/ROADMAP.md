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

---

## v1.9: Napplet SDK Migration

**Goal:** Move the 18 demo/fixture napplet packages from `@napplet/sdk@^0.2.1` to `@napplet/sdk@0.3.0` and replace old namespace-style SDK usage with the direct helper-function surface, without regressing the v1.8 build/unit/E2E baseline.

**E2E baseline entering v1.9:** 86 passed / 0 failed / 0 skipped.

**Coverage:** 12/12 requirements mapped.

**Migration scope:** 12 playground/demo packages declare the old SDK dependency (`bot`, `chat`, `composer`, `config-demo`, `feed`, `hotkey-chord`, `media-controller`, `preferences`, `profile-viewer`, `resource-demo`, `theme-switcher`, `toaster`) plus 6 fixture packages (`nub-identity`, `nub-ifc`, `nub-notify`, `nub-relay`, `nub-storage`, `nub-theme`). `decrypt-demo` is excluded because it does not currently depend on `@napplet/sdk`.

### Phases

- [ ] **Phase 47: SDK 0.3 Package Graph + IFC/Storage Migration** — Bump the 18 SDK-bearing packages to the 0.3 package line, migrate the low-level IFC/storage namespaces, and establish the exact dependency policy before wider demo rewrites.
- [ ] **Phase 48: Demo Function-Export Migration** — Rewrite relay, identity, keys, notify, config, media, and resource demo call sites to direct helper functions, including special-case documentation where root SDK function names are collision-prone.
- [ ] **Phase 49: Migration Guard + Full Verification** — Remove stale namespace teaching, add a guard against regressions, verify the lockfile no longer resolves old SDK/split-nub paths for active demo/fixture packages, and close the full build/unit/E2E loop.

---

## Phase Details

### Phase 47: SDK 0.3 Package Graph + IFC/Storage Migration
**Goal**: Establish the `@napplet/sdk@0.3.0` dependency graph for the 18 scoped demo/fixture packages and migrate the shared IFC/storage call sites first, because those are the highest-fanout old namespace patterns (`ipc.*` and `storage.*`).
**Depends on**: v1.8 complete and archived; `@napplet/sdk@0.3.0`, `@napplet/shim@0.3.0`, and `@napplet/vite-plugin@0.3.0` published on npm.
**Requirements**: SDK-01, SDK-02, FUNC-01, FUNC-02
**Rationale**: Package graph alignment and the smallest repeated namespace families should happen before the more varied domain demos. IFC also carries the terminology rename from `ipc` to `ifc`, so getting it into the first phase makes later demo review less noisy. Storage touches both demo and fixture surfaces but has simple direct one-to-one helper replacements.
**Success Criteria** (what must be TRUE):
  1. All 18 scoped package manifests declare `@napplet/sdk: 0.3.0` exactly, and companion `@napplet/shim` / `@napplet/vite-plugin` entries are aligned to `0.3.0` where present unless a verified incompatibility is documented.
  2. Bot, chat, and `nub-ifc` no longer import or call `ipc`; they use direct IFC helpers (`ifcEmit`, `ifcOn`) and comments/spec descriptions use current `ifc` terminology.
  3. Bot, chat, preferences, `nub-storage`, and `nub-theme` no longer call `storage.*`; they use direct storage helpers (`storageGetItem`, `storageSetItem`, `storageRemoveItem`, `storageKeys`) as needed.
  4. The affected napplet package builds pass after lockfile regeneration; no implementation relies on `@napplet/sdk@^0.2.1` being hoisted from another package.
**Plans**: TBD

### Phase 48: Demo Function-Export Migration
**Goal**: Move the remaining active demo/fixture SDK usage to direct helper functions across relay, identity, keys, notify, config, media, and resource surfaces while preserving each demo's existing DOM sentinels and E2E behavior.
**Depends on**: Phase 47
**Requirements**: FUNC-03, FUNC-04, FUNC-05
**Rationale**: These surfaces are more varied than IFC/storage. Relay and identity drive the main demo flows; keys and notify include historical SDK-gap comments; config uses collision-prone helper names at the domain level; media/resource were already using domain helpers or raw envelopes despite carrying an old SDK dependency. Keeping them together focuses the phase on behavior-preserving call-site migration rather than package graph churn.
**Success Criteria** (what must be TRUE):
  1. Chat, composer, feed, `nub-relay`, profile-viewer, theme-switcher, toaster, and `nub-identity` no longer call `relay.*` or `identity.*` namespaces; they use direct helpers such as `relayPublish`, `relayPublishEncrypted`, `relaySubscribe`, `identityGetPublicKey`, and `identityGetProfile`.
  2. Hotkey-chord and `nub-notify` use direct keys/notify helpers where the 0.3 surface covers existing behavior; stale "SDK gap" comments are removed or narrowed to only still-real gaps.
  3. `config-demo` uses the verified 0.3 config helper surface without a stale `config.*` namespace import. If the root SDK cannot expose collision-free function names, the implementation uses the documented `@napplet/nub/config/sdk` helper imports and records the exception.
  4. `media-controller` and `resource-demo` use the 0.3 helper surface instead of retaining `@napplet/sdk@0.2.1` compatibility assumptions; raw resource-envelope code remains only if a verified behavior gap blocks a helper replacement, with a grepable follow-up note.
  5. Existing DOM sentinel contracts remain stable for affected E2E specs.
**Plans**: TBD

### Phase 49: Migration Guard + Full Verification
**Goal**: Lock the SDK migration so future demo/fixture work cannot silently reintroduce old namespace imports or old SDK dependency ranges, then run the full verification loop against the migrated tree.
**Depends on**: Phase 48
**Requirements**: SDK-03, GUARD-01, E2E-29, E2E-30, DOCS-08
**Rationale**: The code migration is complete only when the lockfile proves the old SDK line is gone from the active demo/fixture graph and tests prove the demos still work. A static guard prevents the old namespace import style from creeping back in after this milestone. Documentation cleanup is kept with verification because comments/spec prose are easiest to audit once the final import shape is known.
**Success Criteria** (what must be TRUE):
  1. `pnpm-lock.yaml` no longer resolves `@napplet/sdk@0.2.1` for active demo/fixture packages, and any remaining legacy split-form `@napplet/nub-*` entries are either gone or proven unrelated to the migrated active SDK graph.
  2. A static guard or test fails on `import { ipc, storage, relay, identity, keys, config, notify } from '@napplet/sdk'` within the 18 migrated packages.
  3. `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e` pass; Playwright remains at 86 passed / 0 failed / 0 skipped unless the phase summary documents intentional new coverage.
  4. Fixture README, package comments, and E2E spec descriptions teach the 0.3 helper-function pattern rather than the old namespace import pattern.
  5. `.planning/REQUIREMENTS.md` traceability remains 12/12 mapped with zero uncovered v1 requirements.
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 47. SDK 0.3 Package Graph + IFC/Storage Migration | 0/0 | Not Started | — |
| 48. Demo Function-Export Migration | 0/0 | Not Started | — |
| 49. Migration Guard + Full Verification | 0/0 | Not Started | — |

---

*ROADMAP.md last restructured: 2026-05-22 — v1.9 milestone roadmap created.*
