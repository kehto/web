# Requirements: v1.6 Downstream Unblock & Shell Service Surface

**Milestone:** v1.6
**Defined:** 2026-04-23
**Status:** Roadmap defined (Phases 32–36)

## Overview

v1.6 is a **downstream-unblock** milestone. Every requirement pulls from one of the 8 GitHub issues filed by the hyprgate v2.0 Kehto Migration gap analysis (dskvr) or from v1.5 carryover tech debt. No speculative work. No spec-adoption work — **NIP-5D resync and NUB-CLASS / NUB-CONNECT adoption are deferred to v1.7**.

Scope-in (hyprgate issues closing this milestone):

| Source | Capability | Category |
|--------|-----------|----------|
| kehto#2 | Extract `@kehto/nip66` as publishable package | NIP66 |
| kehto#3 + PR#7 | Merge `@kehto/wm` skeleton | WM |
| kehto#4 | Consolidate peer deps → `@napplet/nub` subpath | DEP |
| kehto#5 | README cleanup (stale `link:` + "core not on npm") | DOCS |
| kehto#8 | Reserved chord-set surface on `createKeysService` | KEYS |
| v1.5 carryover | Chat boot `storage.get` storm (18+ serial round-trips) | PERF |

**Dropped mid-milestone** (2026-04-23): **kehto#1** — Phase 33 scoping revealed the existing `createCacheService` in `packages/services/src/cache-service.ts` (v1.2+) already provides the `hostBridge`-style injection point hyprgate asked for (the options object `{query, store, isAvailable}` IS the bridge). Only cosmetic gap vs. Keys/Media pattern is surface naming. Commented on kehto#1 with integration example; issue stays open as a kehto-side tracker for optional future polish (`HostCacheBridge` type alias + optional default). CACHE-01..05 removed from v1.6 scope.

**REQ-ID format:** `[CATEGORY]-[NUMBER]`. KEYS, DOCS, E2E continue numbering from prior milestones; NIP66, WM, DEP, PERF are new categories starting at `-01`.

**Anti-features carried forward from v1.5 (enforced every phase):**
- No `window.nostr` on any napplet-visible surface
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of `packages/runtime/src/core-compat.ts` (deleted v1.4 Phase 24)
- No `allow-same-origin` on napplet iframe sandbox
- No `@napplet/nub-*` split-package imports in `@kehto/*` source after DEP-01 lands (new in v1.6)

**E2E iteration-loop discipline (canon):** Every phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built `:4174` demo (not `pnpm dev`). Baseline entering v1.6: **53 passed / 0 failed / 0 skipped**.

---

## v1 Requirements

### Category 1: NIP-66 Package (NIP66) — kehto#2

Extract a standalone publishable package so the community doesn't re-invent kind-30166 relay discovery per-shell. Reference implementation patterns available in hyprgate's `nip66-monitor.ts` and nadar.

- [x] **NIP66-01**: New `packages/nip66` workspace exists, declared as `@kehto/nip66`, ESM-only, buildable via tsup with `turbo run build`.
- [x] **NIP66-02**: `@kehto/nip66` exports a `createNip66Aggregator(options)` factory that subscribes to kind-30166 events via an injected relay pool and surfaces the aggregated relay suggestion set through an observable / callback.
- [x] **NIP66-03**: Package consumes `nostr-tools` as a peer dep (matches `@kehto/shell` range); `@napplet/core` is NOT required (this is a framework-agnostic util, not a NUB).
- [ ] **NIP66-04**: Package README documents the public API + an integration example against a `ShellAdapter` consumer surface (e.g., `relayConfig.getNip66Suggestions`).
- [ ] **NIP66-05**: Changeset authored for `@kehto/nip66@0.1.0` initial publish; package is buildable but is NOT yet wired into the demo shell (demo wiring deferred to v1.7+).

### Category 2: WM Skeleton (WM) — kehto#3 / PR #7

Merge the `@kehto/wm` library-skeleton PR so downstream shells (hyprgate first) can depend on the canonical types/factory signature. Implementation is deliberately stubbed — that's the point of the skeleton.

- [ ] **WM-01**: PR #7's `@kehto/wm` skeleton lands on `main`: `packages/wm/package.json` (v0.0.0, ESM-only, zero runtime deps), `tsconfig.json`, `src/index.ts`, `README.md`.
- [ ] **WM-02**: `@kehto/wm/src/index.ts` exports the generic type vocabulary (`WindowId`, `WorkspaceId`, `Rect`, `Layout`), the `WmHostHooks` contract, the `WmService` interface, and a throwing `createWmService` factory stub.
- [ ] **WM-03**: `turbo run build` + `turbo run type-check` pass for the new package on `main` with no regressions to the 53-spec E2E baseline.

### Category 3: NUB Dep Consolidation (DEP) — kehto#4

Migrate every `@kehto/*` package from 8 split `@napplet/nub-{domain}@0.2.1` peer/dev deps to the consolidated `@napplet/nub@0.2.1` package with subpath imports. Closes the dual-instance pitfall that lands two copies of every NUB module on disk in downstream shells that need both shapes.

- [x] **DEP-01**: `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services` each declare `@napplet/nub@^0.2.1` as their sole NUB peer/dev dep. All 8 `@napplet/nub-{identity,ifc,keys,media,notify,relay,storage,theme}` entries removed from every `packages/*/package.json`.
- [x] **DEP-02**: Every in-repo TS import reading from `@napplet/nub-{domain}` is rewritten to the `@napplet/nub/{domain}` subpath form (`/types`, `/shim`, `/sdk` subpaths where applicable). Verified via `grep -r '@napplet/nub-' packages/ apps/ tests/` returning 0 matches.
- [x] **DEP-03**: `pnpm-lock.yaml` contains zero `@napplet/nub-*` resolved entries post-install; exactly one `@napplet/nub@0.2.1` resolution.
- [x] **DEP-04**: Changesets authored for each `@kehto/*` package documenting the peer-dep migration (minor bump — public peer surface changed).
- [x] **DEP-05**: Downstream smoke: fresh clone + `pnpm install` + `pnpm build` + `pnpm test:e2e` green at 53/0/0; no dual-instance warnings in any build log.

### Category 4: Reserved Chord Surface (KEYS — continued from v1.4) — kehto#8

Extend `createKeysService` so shells can declare WM-absolute chords once and have the keys service short-circuit routing to napplet-registered actions that claim the same chord.

- [x] **KEYS-04**: `createKeysService` accepts a `reservedChords?: ReadonlyArray<string>` option (or equivalent `HostKeysBridge.reserveAbsolute(chords)` extension — decision deferred to plan phase) for shell-absolute chords.
- [x] **KEYS-05**: When a napplet calls `keys.forward` with a reserved chord, the keys service invokes the shell's `onForward` / bridge handler and does NOT dispatch `keys.action` to any napplet that registered the same chord via `keys.registerAction`.
- [x] **KEYS-06**: `packages/services/README.md` Keys H2 section extended with the reserved-chord surface, a WM-launcher integration example, and the cross-NUB precedence note (reserved > registered).

### Category 5: Performance (PERF) — v1.5 carryover

v1.5 audit flagged chat napplet boot issuing 18+ serial `storage.get` round-trips (Shell → Napplet acks). Not a correctness bug — a throughput bottleneck that makes the demo feel slow under the `:4174` iteration loop.

- [ ] **PERF-01**: Chat napplet boot reduces cumulative `storage.get` request count on the AUTHENTICATED → READY transition by at least 50% (either via a single `storage.getMany` batch message, parallelized `Promise.all`, or a boot-time preload map). Baseline count recorded in phase plan before fix; post-fix count + wall-clock recorded in ITERATION-LOG.md.

### Category 6: Documentation (DOCS — continued from v1.3) — kehto#5

- [ ] **DOCS-04**: Root `README.md` removes the "`@napplet/core` not yet on npm" claim + `pnpm.overrides link:` consumer recommendation. New consumer story: `pnpm add @kehto/runtime @napplet/shim @napplet/nub` from registry.
- [ ] **DOCS-05**: Root `README.md` Quick-Integration Example block verified against a fresh `pnpm dlx create-*` or equivalent clean-install smoke, matching what hyprgate actually pins in v2.0.

### Category 7: E2E Coverage (E2E — continued from v1.5) — new specs

- [x] **E2E-17**: New Layer-B Playwright spec locking the KEYS-04 / KEYS-05 reserved-chord contract — a reserved chord forwarded via `keys.forward` fires the shell handler and does NOT reach a napplet that claimed the same chord.
- [ ] **E2E-18**: Layer-B Playwright fresh-build iteration loop records `pnpm clean && pnpm build && pnpm test:e2e` green at ≥ 54 passed / 0 failed / 0 skipped (baseline 53 + E2E-17) with the v1.6 milestone close commit.

---

## Future Requirements (deferred)

### v1.7 Spec-Alignment

- **SPEC-04**: Re-sync `specs/NIP-5D.md` from `dskvr/nips` branch `nip/5d` — pulls in the Class-posture delegation paragraph.
- **CLASS-01..0N**: Adopt NUB-CLASS — shell emits `class.assigned` envelope after shim bootstrap; ACL + dispatch honor class posture; Playwright cross-NUB invariant spec.
- **CONNECT-01..0N**: Adopt NUB-CONNECT — per-napplet CSP `connect-src` emission, consent flow, residual-meta-CSP refuse-to-serve scan, grant persistence keyed on `(dTag, aggregateHash)`. Requires SHELL-CONNECT-POLICY.md audit checklist.
- **CONFIG-01..0N**: Implement NUB-CONFIG reference service (new 9th NUB domain in `@napplet/nub`).
- **RESOURCE-01..0N**: Implement NUB-RESOURCE reference service (new 10th NUB domain).
- **DECRYPT-01**: Shell impl of receive-side NIP-44 decrypt surface once napplet/napplet#3 decides between `relay.subscribeEncrypted` vs `identity.decrypt`.

### v1.7+ Platform

- **CACHE-01..05 (dropped from v1.6)**: Cosmetic `HostCacheBridge` type alias + optional default for `createCacheService`. Existing `CacheServiceOptions` already provides the injection point hyprgate asked for; only naming parity with Keys/Media remains. Tracked at kehto#1; not scheduled — pull in if a downstream requests the rename explicitly.
- **WM-04..0N**: Full `@kehto/wm` implementation (BSP / master-stack / floating layout primitives) — waits on a real consumer use case inside kehto-land.
- **BRIDGE-01..02**: Electron + Tauri reference impls of `HostKeysBridge`, `HostMediaBridge`, `HostCacheBridge` (carryover from v1.4 tech debt).
- **CI-01**: Multi-OS CI matrix (ubuntu-latest + macos-latest + windows-latest) — carryover from v1.4.

---

## Out of Scope (v1.6)

| Feature | Reason |
|---------|--------|
| NIP-5D spec resync | Deferred to v1.7 spec-alignment milestone; Class-posture delegation paragraph is prerequisite to NUB-CLASS adoption. |
| NUB-CLASS / NUB-CONNECT adoption | Deferred to v1.7. Adoption requires NIP-5D resync + SHELL-*-POLICY audit gates + new shell HTTP-header authority — a milestone of its own. |
| NUB-CONFIG / NUB-RESOURCE services | Deferred to v1.7. Two new NUB domains need reference services + demo wiring + E2E coverage. |
| Receive-side NIP-44 decrypt (kehto#9) | Upstream-first. Cross-linked to napplet/napplet#3. Shell impl waits on NUB surface decision. |
| Vite 8 × @napplet/vite-plugin compat (kehto#6) | Tracking-only. Reopens if hyprgate regresses; no upstream kehto work until then. |
| `@kehto/wm` full implementation (BSP/master-stack/floating) | Per PR #7 design: skeleton only this milestone. Hyprgate runs its own impl at `apps/shell/src/lib/services/wm.ts`. |
| Electron / Tauri host-bridge reference impls | Carryover v1.4 deferred tech debt; extends to HostCacheBridge in v1.6 but reference impls remain out of scope. |
| Multi-OS CI matrix | Carryover v1.4 deferred tech debt. |
| Demo wiring of `@kehto/nip66` | NIP66-05 explicitly scopes publish-only; demo wiring is v1.7+. |

---

## Traceability

Which phases cover which requirements. Populated by gsd-roadmapper during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-01 | Phase 32 | Complete |
| DEP-02 | Phase 32 | Complete |
| DEP-03 | Phase 32 | Complete |
| DEP-04 | Phase 32 | Complete |
| DEP-05 | Phase 32 | Complete |
| KEYS-04 | Phase 33 | Complete |
| KEYS-05 | Phase 33 | Complete |
| KEYS-06 | Phase 33 | Complete |
| E2E-17 | Phase 33 | Complete |
| NIP66-01 | Phase 34 | Complete |
| NIP66-02 | Phase 34 | Complete |
| NIP66-03 | Phase 34 | Complete |
| NIP66-04 | Phase 34 | Pending |
| NIP66-05 | Phase 34 | Pending |
| WM-01 | Phase 35 | Pending |
| WM-02 | Phase 35 | Pending |
| WM-03 | Phase 35 | Pending |
| DOCS-04 | Phase 35 | Pending |
| DOCS-05 | Phase 35 | Pending |
| PERF-01 | Phase 36 | Pending |
| E2E-18 | Phase 36 | Pending |

**Coverage:**
- v1 requirements: 21 total (CACHE-01..05 dropped 2026-04-23 — existing code already provides the functionality; see Scope-in table above)
- Mapped to phases: 21 ✓
- Unmapped: 0

**Phase distribution:**
- Phase 32 (NUB Dep Consolidation): 5 reqs (DEP-01..05) — **Complete**
- Phase 33 (Reserved Chord Surface + E2E-17): 4 reqs (KEYS-04..06, E2E-17)
- Phase 34 (@kehto/nip66 Extract & Publish): 5 reqs (NIP66-01..05)
- Phase 35 (WM Skeleton + README Cleanup): 5 reqs (WM-01..03, DOCS-04..05)
- Phase 36 (PERF-01 + Milestone Close E2E-18): 2 reqs (PERF-01, E2E-18)

---

*Requirements defined: 2026-04-23*
*Roadmap mapped: 2026-04-23 (Phases 32–36; CACHE phase dropped after Phase 32)*
*Last updated: 2026-04-23 after CACHE descope*
