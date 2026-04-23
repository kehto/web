# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [ ] **v1.6: Downstream Unblock & Shell Service Surface** — 6 phases (32–37), 26 requirements (in progress)

---

## Milestone Constraints

**Anti-feature enforcement (enforced every v1.6 phase):**
- No `window.nostr` on any napplet-visible surface
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of `packages/runtime/src/core-compat.ts` (deleted v1.4 Phase 24)
- No `allow-same-origin` on napplet iframe sandbox
- **New in v1.6:** No `@napplet/nub-*` split-package imports in `@kehto/*` source after DEP-01 lands — only `@napplet/nub` consolidated package with subpath imports (`/identity`, `/ifc`, `/keys`, `/media`, `/notify`, `/relay`, `/storage`, `/theme`, and `/types`, `/shim`, `/sdk` where applicable)

**E2E iteration-loop discipline (canon):** Every phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built `:4174` demo (not `pnpm dev`). Baseline entering v1.6: **53 passed / 0 failed / 0 skipped**.

**Port conventions:** Harness at `:4173`, full demo at `:4174`. Layer-B specs asserting concurrent-boot scenarios use `:4174` only (no `__loadNapplet__` single-frame helper).

**CI:** Runs on `ubuntu-latest` only. Multi-OS coverage remains deferred to v1.7+.

**v1.6 is NOT a protocol-change milestone.** `@kehto/*` wire surface stays at the v1.2/v1.4 public contract. `createCacheService` + reserved-chord surface are additive. `@kehto/nip66` is new and publishes at `0.1.0`. `@kehto/wm` is new skeleton at `0.0.0`.

**NIP-5D spec resync + NUB-CLASS / NUB-CONNECT / NUB-CONFIG / NUB-RESOURCE adoption are explicitly deferred to v1.7.**

---

## Current Milestone: v1.6 — Downstream Unblock & Shell Service Surface

**Milestone Goal:** Unblock hyprgate v2.0 by landing the kehto-side capability gaps it hit during its Kehto Migration gap analysis — extend the shell service surface (cache multi-tab, keys reserved chords), ship `@kehto/nip66` and the `@kehto/wm` skeleton, consolidate every `@kehto/*` package onto the `@napplet/nub` subpath-import surface, fix stale README claims, and close v1.5's chat-boot storage storm — all without breaking the 53-spec Playwright baseline.

**Phases:** 32–37 (6 phases) | **Requirements:** 26/26 mapped

**Phase numbering:** Continues from Phase 31 (v1.5). v1.6 starts at Phase 32.

## Phases

- [ ] **Phase 32: NUB Dep Consolidation** — Migrate all 4 `@kehto/*` packages from split `@napplet/nub-*` peer deps to the consolidated `@napplet/nub@^0.2.1` package with subpath imports; changesets + 53/0/0 baseline preserved.
- [ ] **Phase 33: Cache Service + HostCacheBridge** — Ship `createCacheService` with default in-memory body + optional `HostCacheBridge` delegation (pattern-mirror Keys/Media), exported from `@kehto/services` with README.
- [ ] **Phase 34: Reserved Chord Surface + E2E-17** — Extend `createKeysService` with reserved-chord precedence (reserved > registered); Keys README section; Layer-B Playwright spec locks the contract; baseline rises to 54.
- [ ] **Phase 35: `@kehto/nip66` Extract & Publish** — Stand up the new `packages/nip66` workspace; `createNip66Aggregator` factory; README + changeset for `@kehto/nip66@0.1.0` initial publish; NO demo wiring.
- [ ] **Phase 36: WM Skeleton + README Cleanup** — Merge PR #7's `@kehto/wm` library skeleton (types/factory stub); remove root README stale `pnpm.overrides link:` + "core not on npm" claims; verify quick-integration example against the consolidated dep surface.
- [ ] **Phase 37: PERF-01 + Milestone Close E2E-18** — Batch/parallelize chat boot `storage.get` storm (≥50% cumulative-count reduction); record final milestone iteration loop at ≥54/0/0; v1.6 anti-term sweep.

---

## Phase Details

### Phase 32: NUB Dep Consolidation
**Goal**: Every `@kehto/*` package consumes exactly one `@napplet/nub@^0.2.1` peer/dev dep via subpath imports — the dual-instance pitfall that lands two copies of every NUB module in downstream shells is structurally eliminated, not just renamed.
**Depends on**: Nothing (first v1.6 phase; lands on v1.5 53/0/0 baseline). Every subsequent v1.6 phase builds on the consolidated surface.
**Requirements**: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05
**Success Criteria** (what must be TRUE):
  1. `grep -r '@napplet/nub-' packages/ apps/ tests/` returns zero matches across TS/JS source, package manifests, and changeset bodies — every in-repo consumer reads from `@napplet/nub/<domain>` (or `/types`, `/shim`, `/sdk` subpaths) or from the consolidated `@napplet/nub` root.
  2. Each of `packages/{acl,runtime,shell,services}/package.json` declares `@napplet/nub@^0.2.1` as its sole NUB peer/dev dep (no `@napplet/nub-identity`, `-ifc`, `-keys`, `-media`, `-notify`, `-relay`, `-storage`, `-theme` entries remain); `pnpm-lock.yaml` importer blocks for `packages/{acl,runtime,shell,services}` contain zero `@napplet/nub-*` entries; transitive resolutions from `@napplet/sdk` / `@napplet/shim` are expected and out of kehto scope.
  3. Four `.changeset/v1-6-dep-<pkg>.md` files exist — one per `@kehto/*` package — documenting the peer-dep migration and a minor version bump (public peer surface changed).
  4. Downstream smoke: `pnpm clean && pnpm install && pnpm build && pnpm test:e2e` against the migrated workspace exits at **53 passed / 0 failed / 0 skipped** (exactly the v1.5 close baseline, no delta); no dual-instance warnings surface in any build log.
  5. The iteration loop result, grep proofs, and lockfile delta are captured in the phase ITERATION-LOG.md.
**Plans:** 1/2 plans executed
Plans:
- [x] 32-01-PLAN.md — Atomic single-pass migration: 5 package manifests swap 8 split `@napplet/nub-*` deps for consolidated `@napplet/nub@^0.2.1`, 15 TS imports rewritten to subpath form, lockfile regenerated (DEP-01, DEP-02, DEP-03)
- [ ] 32-02-PLAN.md — Author 4 changesets (minor bump each) + run canonical fresh-install iteration loop, capture evidence in `32-ITERATION-LOG.md` (DEP-04, DEP-05)

### Phase 33: Cache Service + HostCacheBridge
**Goal**: Downstream shells (hyprgate first) can supply their own OPFS-aware multi-tab cache backend by handing a `HostCacheBridge` to `createCacheService` — without monkey-patching the kehto reference — and get a working in-memory default when no bridge is supplied.
**Depends on**: Phase 32 (landing this on the consolidated `@napplet/nub` surface means the new service's imports, types, and README examples match the v1.6 public contract from day one).
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05
**Success Criteria** (what must be TRUE):
  1. `@kehto/services` exports `createCacheService(options?)` from its package barrel returning a `ServiceHandler { name: 'cache' }` that conforms to the existing reference-service contract (descriptor shape + message router) — verifiable by `createRuntime().registerService(createCacheService())` succeeding without runtime error.
  2. Default `createCacheService()` (no `hostBridge`) handles `cache.get` / `cache.set` / `cache.delete` / `cache.clear` against an in-memory `Map` keyed on `(scope, key)` where `scope` is the napplet's canonical identity key — a napplet that writes then reads the same `(scope, key)` in the same session retrieves the exact same value, and `cache.clear` purges only its own `scope`.
  3. `createCacheService({ hostBridge })` delegates every `cache.*` operation to the supplied `HostCacheBridge` (Branch A) and leaves the default in-memory body untouched when no bridge is supplied (Branch B) — the branching pattern matches Plan 26-01 `createKeysService` exactly, verifiable by unit tests exercising both branches.
  4. `HostCacheBridge` interface + `HostCacheEvent` type are exported from `@kehto/services` with JSDoc `@param` / `@returns` / `@example` annotations, shaped as a direct analog of `HostKeysBridge` / `HostMediaBridge` (so an Electron/Tauri integrator can template off the v1.4 bridges).
  5. `packages/services/README.md` gains a `## Cache Service` H2 section covering the default in-memory behavior, the `HostCacheBridge` contract, and a multi-tab OPFS reference sketch; iteration loop closes with `pnpm clean && pnpm build && pnpm test:e2e` at 53/0/0 (no E2E delta this phase — new-service coverage lands in a later extension, not here).
**Plans**: TBD

### Phase 34: Reserved Chord Surface + E2E-17
**Goal**: A shell can declare WM-absolute chords once via `createKeysService` and have the keys service short-circuit to the shell bridge — precedence `reserved > registered` — so a napplet claiming the same chord via `keys.registerAction` never gets the event. Layer-B Playwright locks the contract.
**Depends on**: Phase 32 (consolidated `@napplet/nub/keys` subpath is the surface the new option is documented against). Independent of Phase 33.
**Requirements**: KEYS-04, KEYS-05, KEYS-06, E2E-17
**Success Criteria** (what must be TRUE):
  1. `createKeysService` accepts a `reservedChords?: ReadonlyArray<string>` option (or an equivalent `HostKeysBridge.reserveAbsolute(chords)` extension — design decision captured in the phase plan) covering shell-absolute chords declared at service-construction time; the option is exported with JSDoc and a runnable example.
  2. When a napplet calls `keys.forward` with a chord present in the reserved set, the keys service invokes the shell's `onForward` / bridge handler exactly once AND does NOT dispatch `keys.action` to any napplet that registered the same chord via `keys.registerAction` — verifiable by unit tests exercising both the reserved path and the non-reserved path.
  3. `packages/services/README.md` `## Keys Service` H2 section is extended with the reserved-chord surface, a WM-launcher integration example, and an explicit cross-NUB precedence note (`reserved > registered`).
  4. `tests/e2e/reserved-chord.spec.ts` (Layer-B, uses canonical `demoBeforeEach` + `waitForNappletReady`) drives a synthetic reserved chord via `page.keyboard`, asserts the shell bridge handler fires, and asserts a second napplet that registered the same chord via `keys.registerAction` never receives a `keys.action` envelope — spec passes against the built `:4174` demo.
  5. Build → run → Playwright iteration loop recorded: `pnpm clean && pnpm build && pnpm test:e2e` reports **54 passed / 0 failed / 0 skipped** (delta: 53 → 54, +1 for `reserved-chord.spec.ts`); demo source remains anti-term clean.
**Plans**: TBD
**UI hint**: yes

### Phase 35: `@kehto/nip66` Extract & Publish
**Goal**: `@kehto/nip66` ships as a standalone publishable package at `0.1.0` — community shells (hyprgate, nadar, others) can add one dep and get a ready-made kind-30166 relay-discovery aggregator without re-inventing per-shell. Publish-only; no demo wiring.
**Depends on**: Phase 32 (clean consolidated workspace state is the baseline the new package lands into, even though `@kehto/nip66` itself does NOT depend on `@napplet/nub` — it's framework-agnostic). Independent of Phases 33 and 34.
**Requirements**: NIP66-01, NIP66-02, NIP66-03, NIP66-04, NIP66-05
**Success Criteria** (what must be TRUE):
  1. `packages/nip66/` workspace exists with `package.json` declaring `@kehto/nip66@0.1.0` (ESM-only, `"type": "module"`, tsup build config, `turbo run build` green) and registered in the root `pnpm-workspace.yaml` — `pnpm --filter @kehto/nip66 build` produces `dist/` artifacts without errors.
  2. `@kehto/nip66` exports `createNip66Aggregator(options)` — a factory that subscribes to kind-30166 events via an injected relay-pool handle and surfaces the aggregated relay suggestion set through an observable or callback surface; public API fully JSDoc'd with a worked example.
  3. `packages/nip66/package.json` declares `nostr-tools` as a peer dep with a range matching `@kehto/shell`'s (`>=2.23.3 <3.0.0`); **no** `@napplet/core` dep is declared (framework-agnostic util, not a NUB).
  4. `packages/nip66/README.md` documents the public API + a runnable integration example against a `ShellAdapter` consumer surface (e.g., `relayConfig.getNip66Suggestions`) — the example type-checks against the published package barrel.
  5. `.changeset/v1-6-nip66.md` exists authoring `@kehto/nip66@0.1.0` as an initial-publish entry; the package is buildable and ready to publish but is **NOT** yet wired into the demo shell (demo wiring deferred to v1.7+); iteration loop recorded at 54/0/0 (no new E2E specs in this phase — package is publish-only).
**Plans**: TBD

### Phase 36: WM Skeleton + README Cleanup
**Goal**: Downstream shells can declare `@kehto/wm` as a dep today and start pinning the canonical type vocabulary / factory signature — without waiting on a real WM implementation (deferred to v1.7+). Root README's stale `pnpm.overrides link:` consumer story and "core not on npm" claim are removed; integration example matches what hyprgate v2.0 actually pins.
**Depends on**: Phase 32 (consolidated workspace state; quick-integration README example must use the v1.6 dep surface). Independent of Phases 33-35.
**Requirements**: WM-01, WM-02, WM-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):
  1. PR #7's `@kehto/wm` skeleton lands on `main` as `packages/wm/` with `package.json` (`@kehto/wm@0.0.0`, ESM-only, zero runtime deps), `tsconfig.json`, `src/index.ts`, and `README.md`; the package is registered in `pnpm-workspace.yaml` and participates in the turbo build graph.
  2. `packages/wm/src/index.ts` exports the generic type vocabulary (`WindowId`, `WorkspaceId`, `Rect`, `Layout`), the `WmHostHooks` contract, the `WmService` interface, and a throwing `createWmService` factory stub — every export is JSDoc-annotated and the throwing stub includes a pointer to the v1.7+ implementation milestone.
  3. Root `README.md` no longer contains the `pnpm.overrides` `link:` consumer-recommendation block OR the "`@napplet/core` not yet on npm" claim; the Quick-Integration Example block shows a clean `pnpm add @kehto/runtime @napplet/shim @napplet/nub` (single consolidated `@napplet/nub`) from the registry, matching hyprgate v2.0's actual pins — verified against a clean-install smoke (throwaway dir, `pnpm add` succeeds, example code type-checks).
  4. `turbo run build` and `turbo run type-check` succeed across the full workspace (including the new `@kehto/wm` package) with no regressions.
  5. Iteration loop recorded at **54 passed / 0 failed / 0 skipped** (same as Phase 34 close; no new E2E specs this phase — skeleton is docs/types only); anti-term sweep clean.
**Plans**: TBD

### Phase 37: PERF-01 + Milestone Close E2E-18
**Goal**: The chat napplet's AUTHENTICATED→READY transition stops issuing 18+ serial `storage.get` round-trips (v1.5 audit finding) — either via a batched `storage.getMany` envelope, parallelized `Promise.all`, or a boot-time preload map. Cumulative request count drops ≥50%. The canonical v1.6 milestone iteration loop closes green, locking in everything v1.6 shipped.
**Depends on**: Phase 32 (consolidated deps) AND Phase 33 (cache service lands before any `storage.get` batch changes — chat uses `storage`, not `cache`, so these don't interact logically, but both services share the `@napplet/nub/storage` + `@napplet/nub/cache` subpath surface) AND Phase 34 (54-spec baseline) AND Phase 35 (@kehto/nip66 shipped) AND Phase 36 (WM skeleton + README clean).
**Requirements**: PERF-01, E2E-18
**Success Criteria** (what must be TRUE):
  1. Baseline chat-napplet `storage.get` request count on the AUTHENTICATED → READY transition is recorded BEFORE the fix (v1.5 audit described "18+ serial round-trips" but did not pin a number) — recorded via instrumentation in the phase plan, captured in `37-ITERATION-LOG.md` as the pre-fix number.
  2. Post-fix chat-napplet `storage.get` cumulative request count on the same AUTHENTICATED → READY transition is at least **50% lower** than the pre-fix baseline — achieved via a single `storage.getMany` batch envelope, parallelized `Promise.all`, or a boot-time preload map (design decision captured in the phase plan); post-fix count + wall-clock delta recorded in the iteration log.
  3. Chat napplet boot correctness is preserved — every `#chat-status` transition, every ACL grant path, and every existing spec behavior that depends on chat boot still works (no observable user regression on the `:4174` demo).
  4. `pnpm clean && pnpm build && pnpm test:e2e` against the built `:4174` demo reports **≥ 54 passed / 0 failed / 0 skipped** (E2E-18: milestone-close iteration loop; baseline 53 + E2E-17 = 54; no new spec required for PERF-01 measurement, which is captured via iteration-log instrumentation, not a new Playwright spec).
  5. v1.6 milestone-gate anti-term sweep runs clean across all v1.6-touched paths: zero matches for `window.nostr` / `signer-service` / `signer.*` / raw `window.addEventListener('message')` in napplet source / `BusKind` / kind 29001 / kind 29002 / `core-compat` / `allow-same-origin` on napplet iframes / `@napplet/nub-` (split-package import form) in `@kehto/*` source — the new v1.6 anti-term joins the carried-forward list.
**Plans**: TBD

---

### Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. NUB Dep Consolidation | 1/2 | In Progress|  |
| 33. Cache Service + HostCacheBridge | 0/TBD | Not started | - |
| 34. Reserved Chord Surface + E2E-17 | 0/TBD | Not started | - |
| 35. `@kehto/nip66` Extract & Publish | 0/TBD | Not started | - |
| 36. WM Skeleton + README Cleanup | 0/TBD | Not started | - |
| 37. PERF-01 + Milestone Close E2E-18 | 0/TBD | Not started | - |

---

## Progress

**Execution Order:**
Phases execute in numeric order: 32 → 33 → 34 → 35 → 36 → 37.

**Parallelism note:** Phases 33, 34, 35, 36 are mutually independent once Phase 32 lands — a future executor could plan them concurrently. Sequential numeric execution remains the default for iteration-loop hygiene (each phase closes against a green `pnpm test:e2e` before the next starts).

All v1.0–v1.5 phases complete. Phase-level progress archived per milestone:

- [v1.0 phase archive](milestones/v1.0-phases/)
- [v1.1 phase archive](milestones/v1.1-phases/)
- [v1.2 phase archive](milestones/v1.2-phases/)
- [v1.3 phase archive](milestones/v1.3-phases/)
- [v1.4 phase archive](milestones/v1.4-phases/)
- [v1.5 phase archive](milestones/v1.5-phases/)
