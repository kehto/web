# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [ ] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), TBD plans, 20 requirements

---

## Milestone Constraints

- `@napplet/core@0.2.0` is **now on npm** (published 2026-04-19; verified via `npm view @napplet/core version`). The workspace `pnpm.overrides` `link:` entries to `/home/sandwich/Develop/napplet/*` MUST be removed before REL-05 publishes — published `@kehto/*` packages must resolve `@napplet/core` from the npm registry, not the local workspace.
- `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) is **deleted** in Phase 24 via pure internal refactor — live types re-homed (`Capability` from `@kehto/acl/capabilities`, `ServiceDescriptor` to `@kehto/runtime/types`, `REPLAY_WINDOW_SECONDS` inlined or moved to `@kehto/runtime/constants`); dead NIP-01 code paths (`BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS`) deleted from `enforce.ts`, `state-handler.ts`, `service-discovery.ts`, and `@kehto/services` files. No new consumers of `core-compat.ts` permitted in any v1.4 phase.
- **Hard anti-features (enforced every v1.4 phase):** No `window.nostr`, no `signer-service` / `signer.*` messages, no raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`), no `BusKind` / kind 29001 / kind 29002 in napplet code, no `allow-same-origin` on napplet iframe sandbox.
- **E2E iteration-loop discipline (canon, no longer a tracked REQ-ID):** every v1.4 phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built artifact (no `pnpm dev`). Established as canon in v1.3 Phase 22 (E2E-11 closure); baked into per-phase success criteria below.
- Playwright runs only against `pnpm preview` builds (`:4173` harness, `:4174` demo) — never `pnpm dev`. The `@napplet/vite-plugin` emits `aggregateHash=""` in dev mode, poisoning ACL state.
- v1.4 is **not a protocol-change milestone** — `@kehto/*` wire surface stays at v1.2. Publication requires the surface to be stable.
- CI runs on `ubuntu-latest` only. Cross-OS matrix is a v1.5+ concern.

---

## Current Milestone: v1.4 — Productionization & Upstream Unblock

**Milestone Goal:** Move kehto from "demo-validated" to "shippable" — add CI/CD enforcement, publish to npm now that `@napplet/core@0.2.0` is upstream, delete the `DRIFT-CORE-06` compatibility shim via internal refactor, and replace stub `keys` / `media` services with real backends each exercised by a demo napplet and a Playwright spec.

**Phases:** 23–28 (6 phases) | **Requirements:** 20/20 mapped

## Phases

- [x] **Phase 23: CI/CD Baseline & Doc Trivia** — GitHub Actions for build/type-check/unit/Playwright on every PR; refresh stale JSDoc `@example` blocks (completed 2026-04-19)
- [x] **Phase 24: DRIFT-CORE-06 Cleanup** — Delete `core-compat.ts`; re-home live types; purge dead NIP-01 code paths (completed 2026-04-19; atomic commit 4c12cd2; CI green)
- [ ] **Phase 25: Release Publication** — `pnpm changeset publish` for the staged v1.3 changesets; smoke-test fresh install from npm; release.yml workflow
- [x] **Phase 26: Real Keys Backend** — Document-level chord listener + `HostKeysBridge` interface + `hotkey-chord` napplet + Layer-B spec (completed 2026-04-19)
- [x] **Phase 27: Real Media Backend** — Web Audio + MediaSession + `HostMediaBridge` interface + `media-controller` napplet + Layer-B spec (completed 2026-04-19)
- [ ] **Phase 28: Layer-A Upgrade & Docs Polish** — Promote `nub-keys`/`nub-media` Layer-A specs from stub-scope to full coverage; refresh `@kehto/services` + `apps/demo` READMEs

---

## Phase Details

### Phase 23: CI/CD Baseline & Doc Trivia
**Goal**: Every push and PR is gated by GitHub Actions running build, type-check, unit tests, and the full Playwright suite — so subsequent v1.4 phases land on a green-bar floor; cosmetic doc citations of deleted fixtures are corrected.
**Depends on**: Nothing (first v1.4 phase; v1.3 baseline is the floor)
**Requirements**: CI-01, CI-02, CI-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. `.github/workflows/build.yml` runs `pnpm install --frozen-lockfile && pnpm build && pnpm type-check` on push and PR; a failing run blocks merge via branch protection or a clearly visible red check.
  2. `.github/workflows/unit.yml` runs `pnpm test` (Vitest, all 4 `@kehto/*` packages) on push and PR with cached pnpm store; a failing run blocks merge.
  3. `.github/workflows/e2e.yml` runs `pnpm test:e2e` on push and PR with the `~/.cache/ms-playwright` browser cache restored from a versioned key; the full v1.3 baseline (47 specs / 0 skipped) reports green on the workflow UI.
  4. `tests/e2e/harness/harness.ts:10` and `tests/e2e/helpers/wait-for-napplet-ready.ts:21` JSDoc `@example` blocks cite extant `nub-*` fixtures; zero references to `auth-napplet` remain in any `tests/e2e/**/*.ts` JSDoc comment.
  5. A green run of all three workflows (`build.yml`, `unit.yml`, `e2e.yml`) is recorded against the merge commit that closes Phase 23 (URLs captured in the phase iteration log).
**Plans:** 4/4 plans complete
- [x] 23-01-PLAN.md — Create `.github/workflows/build.yml` (CI-01)
- [x] 23-02-PLAN.md — Create `.github/workflows/unit.yml` (CI-02)
- [x] 23-03-PLAN.md — Create `.github/workflows/e2e.yml` with Playwright browser cache (CI-03)
- [x] 23-04-PLAN.md — Refresh stale `auth-napplet` JSDoc references to `nub-identity` (DOCS-04)

### Phase 24: DRIFT-CORE-06 Cleanup
**Goal**: `packages/runtime/src/core-compat.ts` is deleted and every live type it shimmed is re-imported from its rightful home — so the v1.4 npm publication ships clean code with no compatibility scaffolding and no dead NIP-01 paths.
**Depends on**: Phase 23 (CI infra catches regressions during the refactor)
**Requirements**: DRIFT-01, DRIFT-02
**Success Criteria** (what must be TRUE):
  1. `packages/runtime/src/core-compat.ts` does not exist; `git grep -n "core-compat"` returns zero hits across the repo (source, tests, fixtures, demo, docs).
  2. `Capability` is imported from `@kehto/acl/capabilities` (canonical source), `ServiceDescriptor` from `@kehto/runtime/types`, and `REPLAY_WINDOW_SECONDS` is inlined in `replay.ts` or relocated to a `@kehto/runtime/constants` module — every former `core-compat` consumer compiles and type-checks against the new import path.
  3. Zero references to `BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, or `STATE_TOPICS` remain in `packages/runtime/src/**` or `packages/services/src/**` (verified by `git grep` on each token).
  4. `pnpm test` passes for all 4 `@kehto/*` packages with no behavioral diffs vs. the Phase 23 baseline (test counts unchanged, no skips added, no expectations relaxed).
  5. Build → run → Playwright iteration loop recorded against the post-refactor commit: `pnpm clean && pnpm build && pnpm test:e2e` reports the full v1.3 baseline (47 / 0 / 0) green; result captured in the phase iteration log.
**Plans:** 2/2 plans complete
- [x] 24-01-PLAN.md — Re-home live types + delete core-compat.ts (DRIFT-01)
- [x] 24-02-PLAN.md — Delete dead NIP-01 code paths + iteration loop (DRIFT-02)

### Phase 25: Release Publication
**Goal**: All four `@kehto/*` packages are published to `registry.npmjs.org` at `0.2.1` (or newer — v1.3 changesets stage patch-bumps); a fresh-install smoke test against the npm registry succeeds; a tag-triggered release workflow exists for future bumps.
**Depends on**: Phase 24 (no `core-compat.ts` shim ships) AND Phase 23 (CI workflows exist for the release.yml gate; `pnpm.overrides` already removed in 23-05)
**Requirements**: REL-05, REL-06, CI-04
**Success Criteria** (what must be TRUE):
  1. ~~`pnpm.overrides` removal~~ — PRE-SATISFIED in Phase 23-05 extension (commit fc567b6). The workspace root `package.json` no longer contains a `pnpm.overrides` block; all `@napplet/*` deps resolve from npm at `^0.2.1`.
  2. `pnpm changeset publish` (executed for the 4 staged `.changeset/v1-3-*.md` files) lands `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services` on the npm registry at the version computed by `changeset version` — verifiable via `npm view @kehto/<pkg> version` returning a live value for each.
  3. Fresh-install smoke test in a throwaway directory: `npm install @kehto/shell @kehto/runtime @kehto/acl @kehto/services` resolves all peer deps from npm (including `@napplet/*@^0.2.1`), TypeScript types resolve in a minimal consumer script, and a `createRuntime()` invocation runs without module-resolution errors.
  4. `.github/workflows/release.yml` triggered on a `v*` git tag push runs `pnpm changeset publish` with an `NPM_TOKEN` secret; the workflow gates on prior green runs of `build.yml` + `unit.yml` + `e2e.yml` on the tagged SHA (either via `workflow_run` dependency or in-job re-execution).
  5. The release tag (`v0.2.1` or equivalent) successfully exercises `release.yml` end-to-end at least once — either as the publication run for criterion 2 or as a follow-up patch — with the workflow run URL captured in the phase iteration log.
**Plans**: TBD

### Phase 26: Real Keys Backend
**Goal**: The stub `keys-service` is replaced by a working document-level chord listener exposed via the `keys.*` NUB namespace; a `HostKeysBridge` interface lets host apps swap in OS-level hotkey backends; a `hotkey-chord` demo napplet exercises chord delivery end-to-end and a Layer-B Playwright spec locks the contract.
**Depends on**: Phase 25 (publication done; subsequent service work ships on the next minor line)
**Requirements**: KEYS-01, KEYS-02, KEYS-03, E2E-12
**Success Criteria** (what must be TRUE):
  1. `@kehto/services` keys-service registers a `document.addEventListener('keydown', ...)` listener; calling `subscribe(chord, callback)` returns an unsubscribe handle and the callback fires exactly once per matching keydown (held-key debouncing matches browser default behavior).
  2. `@kehto/services` exports a `HostKeysBridge` TypeScript interface; the reference document-level implementation from KEYS-01 satisfies the interface; documented public API surface includes the interface plus a `subscribe`/`unsubscribe` contract callable from the runtime via `keys.*` envelopes.
  3. `apps/demo/napplets/hotkey-chord` napplet (built under `@napplet/sdk`, zero raw `window.addEventListener('message')` in source) subscribes to a test chord (e.g. `Ctrl+Shift+K`); `#hotkey-chord-status` transitions `connecting... → authenticated → subscribed` on boot and a chord-delivery counter increments on each chord match.
  4. `tests/e2e/hotkey-chord.spec.ts` (Layer-B, uses canonical `demoBeforeEach` + `waitForNappletReady`) drives a synthetic chord via `page.keyboard` and asserts both the status transition and the counter increment; the spec passes against the built demo artifact.
  5. Build → run → Playwright iteration loop recorded: `pnpm clean && pnpm build && pnpm test:e2e` reports the full v1.4-to-date suite (Phase 23 baseline + `hotkey-chord.spec.ts`) green; demo source contains zero `window.nostr` / `signer-service` / `BusKind` references.
**Plans:** 4/4 plans complete
- [x] 26-01-PLAN.md — Real keys-service (document-level chord listener + chord parser + subscription registries) (KEYS-01)
- [x] 26-02-PLAN.md — HostKeysBridge interface + barrel export + hostBridge option branch (KEYS-02)
- [x] 26-03-PLAN.md — apps/demo/napplets/hotkey-chord + shell-host.ts wiring (KEYS-03)
- [x] 26-04-PLAN.md — Layer-B hotkey-chord.spec.ts + 26-ITERATION-LOG.md (E2E-12)
**UI hint**: yes

### Phase 27: Real Media Backend
**Goal**: The stub `media-service` is replaced by a working Web Audio + MediaSession implementation exposed via the `media.*` NUB namespace; a `HostMediaBridge` interface lets host apps swap in native media backends; a `media-controller` demo napplet exercises playback control + metadata end-to-end and a Layer-B Playwright spec locks the contract.
**Depends on**: Phase 25 (clean published baseline). Logically independent of Phase 26 — executes in sequence but does not depend on keys backend code.
**Requirements**: MEDIA-01, MEDIA-02, MEDIA-03, E2E-13
**Success Criteria** (what must be TRUE):
  1. `@kehto/services` media-service exposes `play()` / `pause()` / `next()` / `previous()` / `setMetadata({title, artist, artwork})` via the `media.*` namespace; playback control routes through Web Audio for per-napplet audio elements and OS-level transport surface routes through the `MediaSession` API.
  2. `@kehto/services` exports a `HostMediaBridge` TypeScript interface; the reference Web Audio + MediaSession implementation from MEDIA-01 satisfies the interface; the public API surface (interface + namespace contract) is exported from the package barrel.
  3. `apps/demo/napplets/media-controller` napplet (built under `@napplet/sdk`, zero raw `window.addEventListener('message')` in source) calls `media.setMetadata` on boot and toggles `media.play` / `media.pause` on user action; `#media-controller-status` transitions `connecting... → authenticated → playing | paused` reflecting MediaSession state.
  4. `tests/e2e/media-controller.spec.ts` (Layer-B, uses canonical `demoBeforeEach` + `waitForNappletReady`) drives play/pause/setMetadata via the napplet; asserts both the `#media-controller-status` text transitions and (via `page.evaluate`) the `navigator.mediaSession.playbackState` + `metadata.title` values; the spec passes against the built demo artifact.
  5. Build → run → Playwright iteration loop recorded: `pnpm clean && pnpm build && pnpm test:e2e` reports the full v1.4-to-date suite (Phase 23 + 26 baseline + `media-controller.spec.ts`) green; demo source remains anti-term clean.
**Plans:** 4/4 plans complete
- [x] 27-01-PLAN.md — Real media-service (navigator.mediaSession mirror + media.command push + silent-audio prime) (MEDIA-01)
- [x] 27-02-PLAN.md — HostMediaBridge interface + createBrowserMediaBridge factory + barrel export (MEDIA-02)
- [x] 27-03-PLAN.md — apps/demo/napplets/media-controller + shell-host.ts wiring + __grantMediaControl__ hook (MEDIA-03)
- [x] 27-04-PLAN.md — Layer-B media-controller.spec.ts + cascaded demo-boot fix + 27-ITERATION-LOG.md (E2E-13)
**UI hint**: yes

### Phase 28: Layer-A Upgrade & Docs Polish
**Goal**: Now that `keys` and `media` have real backends, the previously stub-scope Layer-A specs are upgraded to full protocol-correctness coverage; `@kehto/services` and `apps/demo` READMEs document the new APIs, host-bridge interfaces, and the 10-napplet end-to-end showcase.
**Depends on**: Phase 26 (real keys backend exists), Phase 27 (real media backend exists)
**Requirements**: E2E-14, DOCS-05, DOCS-06
**Success Criteria** (what must be TRUE):
  1. `tests/e2e/nub-keys.spec.ts` and `tests/e2e/nub-media.spec.ts` no longer carry `STUB SCOPE NOTICE` headers; both specs assert canonical request envelope dispatch AND result envelope receipt against the real backends; any `test.describe.skip` or `test.skip` markers tied to stub scope are removed.
  2. `packages/services/README.md` includes new `keys` and `media` sections documenting the public API (subscribe/unsubscribe, play/pause/next/previous/setMetadata), the `HostKeysBridge` + `HostMediaBridge` interface contracts, and runnable usage examples that reference the `hotkey-chord` / `media-controller` napplets.
  3. `apps/demo/README.md` lists `hotkey-chord` and `media-controller` in the demo napplet inventory; the integration narrative updated from "8-napplet showcase" (v1.3) to "10-napplet end-to-end showcase" with the two new napplets cited as the keys/media backend exemplars.
  4. Build → run → Playwright iteration loop recorded: `pnpm clean && pnpm build && pnpm test:e2e` reports the full v1.4 suite green (v1.3 47-spec baseline + `hotkey-chord.spec.ts` + `media-controller.spec.ts` + upgraded `nub-keys.spec.ts` + upgraded `nub-media.spec.ts`); zero skipped specs across the entire suite.
  5. Anti-term hygiene grep across all v1.4-touched paths returns zero matches for `window.nostr` / `signer-service` / `signer.sign` / `BusKind` / `kind 29001` / `kind 29002` / `core-compat`; `apps/demo/napplets/{hotkey-chord,media-controller}/src/**` contain zero raw `window.addEventListener('message')` calls.
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 23 → 24 → 25 → 26 → 27 → 28

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 16. Harness Triage & Playwright Infrastructure | v1.3 | 4/4 | Complete | 2026-04-17 |
| 17. Demo App Rewire | v1.3 | 7/7 | Complete | 2026-04-18 |
| 18. Napplet SDK Migration | v1.3 | 4/4 | Complete | 2026-04-18 |
| 19. Core-Domain Napplets | v1.3 | 7/7 | Complete | 2026-04-18 |
| 20. Expanded-Domain Napplets | v1.3 | 8/8 | Complete | 2026-04-18 |
| 21. Fixture Napplets & Layer-A Specs | v1.3 | 5/5 | Complete | 2026-04-18 |
| 22. Docs Refresh & Release Rehearsal | v1.3 | 8/8 | Complete | 2026-04-18 |
| 23. CI/CD Baseline & Doc Trivia | v1.4 | 4/4 | Complete   | 2026-04-19 |
| 24. DRIFT-CORE-06 Cleanup | v1.4 | 2/2 | Complete   | 2026-04-19 |
| 25. Release Publication | v1.4 | 0/TBD | Not started | - |
| 26. Real Keys Backend | v1.4 | 4/4 | Complete   | 2026-04-19 |
| 27. Real Media Backend | v1.4 | 4/4 | Complete   | 2026-04-19 |
| 28. Layer-A Upgrade & Docs Polish | v1.4 | 0/TBD | Not started | - |
