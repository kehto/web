# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [ ] **v1.6: Downstream Unblock & Shell Service Surface** — 5 phases (32–36), 21 requirements (in progress; CACHE-01..05 dropped 2026-04-23 — existing createCacheService already provides hostBridge-style injection, see kehto#1 comment)

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

**v1.6 is NOT a protocol-change milestone.** `@kehto/*` wire surface stays at the v1.2/v1.4 public contract. Reserved-chord surface is additive. `@kehto/nip66` is new and publishes at `0.1.0`. `@kehto/wm` is new skeleton at `0.0.0`.

**NIP-5D spec resync + NUB-CLASS / NUB-CONNECT / NUB-CONFIG / NUB-RESOURCE adoption are explicitly deferred to v1.7.**

---

## Current Milestone: v1.6 — Downstream Unblock & Shell Service Surface

**Milestone Goal:** Unblock hyprgate v2.0 by landing the kehto-side capability gaps it hit during its Kehto Migration gap analysis — extend the shell service surface (keys reserved chords), ship `@kehto/nip66` and the `@kehto/wm` skeleton, consolidate every `@kehto/*` package onto the `@napplet/nub` subpath-import surface, fix stale README claims, and close v1.5's chat-boot storage storm — all without breaking the 53-spec Playwright baseline.

**Phases:** 32–36 (5 phases) | **Requirements:** 21/21 mapped

**Phase numbering:** Continues from Phase 31 (v1.5). v1.6 starts at Phase 32.

**Scope change (2026-04-23):** Original Phase 33 (Cache Service + HostCacheBridge) dropped after Phase 32 close. Scoping revealed the existing `createCacheService` in `packages/services/src/cache-service.ts` (v1.2+) already provides the `hostBridge`-style injection point hyprgate#1 asked for — the `CacheServiceOptions` object `{query, store, isAvailable}` IS the bridge. Only cosmetic parity vs. Keys/Media naming remains. Commented on kehto#1 with integration example; issue stays open as a kehto-side tracker for optional future polish. CACHE-01..05 moved to Future Requirements (v1.7+). Subsequent phases renumbered: former Phase 34 → 33, 35 → 34, 36 → 35, 37 → 36.

**PERF-01 rescope (2026-04-23, audit-first):** v1.5 audit claim "chat boot performs 18+ serial storage.get round-trips" inaccurate for current code. Chat boot = 1 real storage call. Demo-wide boot ≈ 11 storage calls across 10 napplets (7 vestigial AUTH probes + 3 real data loads + 1 paired preference load). Real target: delete the 7 vestigial `storage.getItem('<slug>-auth-probe')` calls + scrub D-04 / `shim AUTH completion` comment prose. AUTH is deprecated entirely in v1.2+ runtime (v1.4 Phase 24 removed BusKind/AUTH_KIND consumers); shim fires AUTHENTICATED from bootstrap signal, not from probe resolution. Probes survived as dead code. See `.planning/phases/36-perf-01-milestone-close/36-CONTEXT.md` for full audit + rescope rationale.

## Phases

- [x] **Phase 32: NUB Dep Consolidation** — Migrate all 4 `@kehto/*` packages from split `@napplet/nub-*` peer deps to the consolidated `@napplet/nub@^0.2.1` package with subpath imports; changesets + 53/0/0 baseline preserved. (completed 2026-04-23)
- [x] **Phase 33: Reserved Chord Surface + E2E-17** — Extend `createKeysService` with reserved-chord precedence (reserved > registered); Keys README section; Layer-B Playwright spec locks the contract; baseline rises to 54. (completed 2026-04-23)
- [x] **Phase 34: `@kehto/nip66` Extract & Publish** — Stand up the new `packages/nip66` workspace; `createNip66Aggregator` factory; README + changeset for `@kehto/nip66@0.1.0` initial publish; NO demo wiring. (completed 2026-04-23)
- [x] **Phase 35: WM Skeleton + README Cleanup** — Merge PR #7's `@kehto/wm` library skeleton (types/factory stub); remove root README stale `pnpm.overrides link:` + "core not on npm" claims; verify quick-integration example against the consolidated dep surface. (completed 2026-04-23)
- [x] **Phase 36: PERF-01 + Milestone Close E2E-18** — Delete 7 vestigial `storage.getItem('<slug>-auth-probe')` calls across 7 napplets + scrub D-04 comment prose across all 10 napplets + 6 E2E specs (per rescope); record final milestone iteration loop at ≥ 54/0/0; v1.6 milestone-wide anti-term sweep. (completed 2026-04-23)

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
**Plans:** 2/2 plans complete
Plans:
- [x] 32-01-PLAN.md — Atomic single-pass migration: 5 package manifests swap 8 split `@napplet/nub-*` deps for consolidated `@napplet/nub@^0.2.1`, 15 TS imports rewritten to subpath form, lockfile regenerated (DEP-01, DEP-02, DEP-03)
- [x] 32-02-PLAN.md — Author 4 changesets (minor bump each) + run canonical fresh-install iteration loop, capture evidence in `32-ITERATION-LOG.md` (DEP-04, DEP-05)

### Phase 33: Reserved Chord Surface + E2E-17
**Goal**: A shell can declare WM-absolute chords once via `createKeysService` and have the keys service short-circuit to the shell bridge — precedence `reserved > registered` — so a napplet claiming the same chord via `keys.registerAction` never gets the event. Layer-B Playwright locks the contract.
**Depends on**: Phase 32 (consolidated `@napplet/nub/keys` subpath is the surface the new option is documented against).
**Requirements**: KEYS-04, KEYS-05, KEYS-06, E2E-17
**Success Criteria** (what must be TRUE):
  1. `createKeysService` accepts a `reservedChords?: ReadonlyArray<string>` option (or an equivalent `HostKeysBridge.reserveAbsolute(chords)` extension — design decision captured in the phase plan) covering shell-absolute chords declared at service-construction time; the option is exported with JSDoc and a runnable example.
  2. When a napplet calls `keys.forward` with a chord present in the reserved set, the keys service invokes the shell's `onForward` / bridge handler exactly once AND does NOT dispatch `keys.action` to any napplet that registered the same chord via `keys.registerAction` — verifiable by unit tests exercising both the reserved path and the non-reserved path.
  3. `packages/services/README.md` `## Keys Service` H2 section is extended with the reserved-chord surface, a WM-launcher integration example, and an explicit cross-NUB precedence note (`reserved > registered`).
  4. `tests/e2e/reserved-chord.spec.ts` (Layer-B, uses canonical `demoBeforeEach` + `waitForNappletReady`) drives a synthetic reserved chord via `page.keyboard`, asserts the shell bridge handler fires, and asserts a second napplet that registered the same chord via `keys.registerAction` never receives a `keys.action` envelope — spec passes against the built `:4174` demo.
  5. Build → run → Playwright iteration loop recorded: `pnpm clean && pnpm build && pnpm test:e2e` reports **54 passed / 0 failed / 0 skipped** (delta: 53 → 54, +1 for `reserved-chord.spec.ts`); demo source remains anti-term clean.
**Plans:** 3/3 plans complete
Plans:
- [x] 33-01-PLAN.md — Add `reservedChords?: ReadonlyArray<string>` option + reservation gates (both branches) + unit-test RED/GREEN; KEYS_SERVICE_VERSION bumped to 1.2.0 (KEYS-04, KEYS-05)
- [x] 33-02-PLAN.md — Extend `packages/services/README.md` Keys H2 with `### Reserved Chords` sub-section + wire demo shell (reserve `Ctrl+Shift+R`, expose `#reserved-chord-last-fired` sentinel) (KEYS-06)
- [x] 33-03-PLAN.md — Write `tests/e2e/reserved-chord.spec.ts` (Layer-B) + record canonical fresh-install iteration loop @ 54/0/0 in `33-ITERATION-LOG.md` (E2E-17)
**UI hint**: yes

### Phase 34: `@kehto/nip66` Extract & Publish
**Goal**: `@kehto/nip66` ships as a standalone publishable package at `0.1.0` — community shells (hyprgate, nadar, others) can add one dep and get a ready-made kind-30166 relay-discovery aggregator without re-inventing per-shell. Publish-only; no demo wiring.
**Depends on**: Phase 32 (clean consolidated workspace state is the baseline the new package lands into, even though `@kehto/nip66` itself does NOT depend on `@napplet/nub` — it's framework-agnostic). Independent of Phase 33.
**Requirements**: NIP66-01, NIP66-02, NIP66-03, NIP66-04, NIP66-05
**Success Criteria** (what must be TRUE):
  1. `packages/nip66/` workspace exists with `package.json` declaring `@kehto/nip66@0.1.0` (ESM-only, `"type": "module"`, tsup build config, `turbo run build` green) and registered in the root `pnpm-workspace.yaml` — `pnpm --filter @kehto/nip66 build` produces `dist/` artifacts without errors.
  2. `@kehto/nip66` exports `createNip66Aggregator(options)` — a factory that subscribes to kind-30166 events via an injected relay-pool handle and surfaces the aggregated relay suggestion set through an observable or callback surface; public API fully JSDoc'd with a worked example.
  3. `packages/nip66/package.json` declares `nostr-tools` as a peer dep with a range matching `@kehto/shell`'s (`>=2.23.3 <3.0.0`); **no** `@napplet/core` dep is declared (framework-agnostic util, not a NUB).
  4. `packages/nip66/README.md` documents the public API + a runnable integration example against a `ShellAdapter` consumer surface (e.g., `relayConfig.getNip66Suggestions`) — the example type-checks against the published package barrel.
  5. `.changeset/v1-6-nip66.md` exists authoring `@kehto/nip66@0.1.0` as an initial-publish entry; the package is buildable and ready to publish but is **NOT** yet wired into the demo shell (demo wiring deferred to v1.7+); iteration loop recorded at 54/0/0 (no new E2E specs in this phase — package is publish-only).
**Plans:** 3/3 plans complete
Plans:
- [x] 34-01-PLAN.md — Scaffold `packages/nip66/` workspace: `package.json` @ `@kehto/nip66@0.1.0` (ESM, tsup, nostr-tools peer dep, NO @napplet/*), `tsconfig.json`, `tsup.config.ts`, stub `src/index.ts` barrel declaring the 5 public exports with factory throwing `not implemented` until 34-02 (NIP66-01, NIP66-03)
- [x] 34-02-PLAN.md — Port hyprgate `nip66-monitor.ts` logic into closure-scoped factory body + vitest suite ≥ 8 tests covering d-tag extraction, N-tag parsing, resync, idempotent start, multi-instance isolation (RED→GREEN) (NIP66-02)
- [x] 34-03-PLAN.md — Author `packages/nip66/README.md` (public API + ShellAdapter integration) + `.changeset/v1-6-nip66.md` initial-publish entry + record canonical fresh-install iteration loop at 54/0/0 in `34-ITERATION-LOG.md` (NIP66-04, NIP66-05)

### Phase 35: WM Skeleton + README Cleanup
**Goal**: Downstream shells can declare `@kehto/wm` as a dep today and start pinning the canonical type vocabulary / factory signature — without waiting on a real WM implementation (deferred to v1.7+). Root README's stale `pnpm.overrides link:` consumer story and "core not on npm" claim are removed; integration example matches what hyprgate v2.0 actually pins.
**Depends on**: Phase 32 (consolidated workspace state; quick-integration README example must use the v1.6 dep surface). Independent of Phases 33-34.
**Requirements**: WM-01, WM-02, WM-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):
  1. PR #7's `@kehto/wm` skeleton lands on `main` as `packages/wm/` with `package.json` (`@kehto/wm@0.0.0`, ESM-only, zero runtime deps), `tsconfig.json`, `src/index.ts`, and `README.md`; the package is registered in `pnpm-workspace.yaml` and participates in the turbo build graph.
  2. `packages/wm/src/index.ts` exports the generic type vocabulary (`WindowId`, `WorkspaceId`, `Rect`, `Layout`), the `WmHostHooks` contract, the `WmService` interface, and a throwing `createWmService` factory stub — every export is JSDoc-annotated and the throwing stub includes a pointer to the v1.7+ implementation milestone.
  3. Root `README.md` no longer contains the `pnpm.overrides` `link:` consumer-recommendation block OR the "`@napplet/core` not yet on npm" claim; the Quick-Integration Example block shows a clean `pnpm add @kehto/runtime @napplet/shim @napplet/nub` (single consolidated `@napplet/nub`) from the registry, matching hyprgate v2.0's actual pins — verified against a clean-install smoke (throwaway dir, `pnpm add` succeeds, example code type-checks).
  4. `turbo run build` and `turbo run type-check` succeed across the full workspace (including the new `@kehto/wm` package) with no regressions.
  5. Iteration loop recorded at **54 passed / 0 failed / 0 skipped** (same as Phase 33 close; no new E2E specs this phase — skeleton is docs/types only); anti-term sweep clean.
**Plans:** 2/2 plans complete
Plans:
- [x] 35-01-PLAN.md — Squash-merge PR #7 (@kehto/wm skeleton) + verify pnpm/turbo auto-pickup at 24/24 successful (WM-01, WM-02, WM-03)
- [x] 35-02-PLAN.md — Rewrite README.md line 93 stale claim (registry install + @napplet/nub>@napplet/core pin) + record 35-ITERATION-LOG.md at 54/0/0 (DOCS-04, DOCS-05)

### Phase 36: PERF-01 + Milestone Close E2E-18
**Goal** (rescoped 2026-04-23 per CONTEXT.md audit-first approach): Delete 7 vestigial `storage.getItem('<slug>-auth-probe')` calls from 7 napplets (composer, feed, hotkey-chord, media-controller, profile-viewer, theme-switcher, toaster) + scrub D-04 / `shim AUTH completion` / `first SDK call gates on AUTH` comment prose across all 10 demo napplets + 6 E2E spec files carrying the same prose. AUTH is deprecated entirely in v1.2+ runtime; shim fires AUTHENTICATED from bootstrap signal directly — the probes survived as dead code. Canonical v1.6 milestone iteration loop closes at 54/0/0; v1.6 milestone-wide anti-term sweep covers the full Phase 32-36 delta in one pass.
**Depends on**: Phase 32 (consolidated deps) AND Phase 33 (54-spec baseline from reserved-chord E2E-17) AND Phase 34 (@kehto/nip66 shipped) AND Phase 35 (WM skeleton + README clean).
**Requirements**: PERF-01, E2E-18
**Success Criteria** (what must be TRUE):
  1. `grep -rn 'auth-probe' apps/demo/napplets/ 2>/dev/null | grep -v dist | wc -l` returns `0` — all 7 vestigial probes deleted from composer/feed/hotkey-chord/media-controller/profile-viewer/theme-switcher/toaster main.ts files. Surrounding try/catch scaffolding collapsed (probe was sole wrapped statement). Unused `storage` imports dropped where applicable.
  2. `grep -rn 'D-04\|AUTH probe\|shim AUTH completion' apps/demo/napplets/ tests/e2e/ 2>/dev/null | wc -l` returns `0` — D-04 comment prose scrubbed across all 10 napplets (including bot/chat/preferences real-data-load napplets where only the AUTH-gate framing is rewritten, real loads retained) + 6 E2E specs.
  3. `tests/e2e/demo-concurrent-boot.spec.ts` (E2E-15, v1.5 Phase 31 canonical) continues to pass AUTHENTICATED-within-10s assertion for all 10 napplets — primary regression anchor for PERF-01. Demo-wide `storage.getItem` count on boot drops from 28 → ~21 (delta -7).
  4. `pnpm clean && pnpm build && pnpm test:e2e` against the built `:4174` demo reports **≥ 54 passed / 0 failed / 0 skipped** (E2E-18: milestone-close iteration loop; baseline 54 from Phase 35 close; no new spec required for PERF-01 — measurement captured via iteration-log instrumentation, not a new Playwright spec per CONTEXT.md Claude's Discretion).
  5. v1.6 milestone-gate anti-term sweep runs clean across all v1.6-touched paths (Phases 32-36 cumulative): zero live-code violations for `window.nostr` / `signer-service` / `signer.*` / raw `window.addEventListener('message')` (except toaster + preferences existing documented deviations) / `BusKind` / kind 29001 / kind 29002 (regex patterns in specs are enforcement guards, not violations) / `core-compat` / `allow-same-origin` (enforcement-prose only per Phase 33/35 Decision) / `@napplet/nub-` split-package import form.
**Plans:** 2/2 plans complete
Plans:
- [x] 36-01-PLAN.md — Delete 7 vestigial `storage.getItem('<slug>-auth-probe')` calls from 7 napplet main.ts files + collapse surrounding try/catch + scrub D-04 / shim-AUTH comment prose across 10 napplets + 6 E2E specs (PERF-01)
- [x] 36-02-PLAN.md — Run canonical v1.6 fresh-install iteration loop + v1.6 milestone-wide anti-term sweep; record 36-ITERATION-LOG.md at 54/0/0 with pre/post storage.getItem count delta evidence (E2E-18)

---

### Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. NUB Dep Consolidation | 2/2 | Complete    | 2026-04-23 |
| 33. Reserved Chord Surface + E2E-17 | 3/3 | Complete    | 2026-04-23 |
| 34. `@kehto/nip66` Extract & Publish | 3/3 | Complete    | 2026-04-23 |
| 35. WM Skeleton + README Cleanup | 2/2 | Complete    | 2026-04-23 |
| 36. PERF-01 + Milestone Close E2E-18 | 2/2 | Complete    | 2026-04-23 |

---

## Progress

**Execution Order:**
Phases execute in numeric order: 32 → 33 → 34 → 35 → 36.

**Parallelism note:** Phases 33, 34, 35 are mutually independent once Phase 32 lands — a future executor could plan them concurrently. Sequential numeric execution remains the default for iteration-loop hygiene (each phase closes against a green `pnpm test:e2e` before the next starts).

All v1.0–v1.5 phases complete. Phase-level progress archived per milestone:

- [v1.0 phase archive](milestones/v1.0-phases/)
- [v1.1 phase archive](milestones/v1.1-phases/)
- [v1.2 phase archive](milestones/v1.2-phases/)
- [v1.3 phase archive](milestones/v1.3-phases/)
- [v1.4 phase archive](milestones/v1.4-phases/)
- [v1.5 phase archive](milestones/v1.5-phases/)
