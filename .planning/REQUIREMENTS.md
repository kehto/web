# Requirements: v1.4 Productionization & Upstream Unblock

**Milestone:** v1.4
**Defined:** 2026-04-19
**Status:** Draft (pending roadmap)

## Overview

v1.4 is a **productionization** milestone. v1.3 proved the v1.2 protocol surface works end-to-end; v1.4 takes it from "demo-validated" to "shippable":

- **CI/CD enforcement** — GitHub Actions gate every PR and release.
- **npm publication** — `@napplet/core@0.2.0` now on npm (published 2026-04-19), so the rehearsed v1.3 changesets can go live.
- **Internal cleanup** — delete `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) by refactoring live types to their rightful homes and deleting dead NIP-01 code paths. No upstream dependency — pure refactor.
- **Stub services become real** — `keys` (document-level chord listener + host bridge) and `media` (Web Audio + MediaSession + host bridge), each exercised by a demo napplet (`hotkey-chord`, `media-controller`) and an E2E spec.

**REQ-ID format:** `[CATEGORY]-[NUMBER]` — categories: `CI`, `REL`, `DRIFT`, `KEYS`, `MEDIA`, `E2E`, `DOCS`.

**Hard anti-features (enforced every phase):**
- No `window.nostr` on any napplet-visible surface (NIP-5D MUST NOT)
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- **No new consumers of `packages/runtime/src/core-compat.ts` — this file is deleted in v1.4**
- No `allow-same-origin` on napplet iframe sandbox

---

## Category 1: CI/CD (CI)

GitHub Actions enforcement for build + tests + release.

- [ ] **CI-01**: `.github/workflows/build.yml` runs `pnpm install --frozen-lockfile && pnpm build && pnpm type-check` on every push and PR; a failure blocks merge.
- [x] **CI-02**: `.github/workflows/unit.yml` runs `pnpm test` (Vitest) on every push and PR; a failure blocks merge.
- [ ] **CI-03**: `.github/workflows/e2e.yml` runs `pnpm test:e2e` (Playwright) on every push and PR with browser cache restored from `~/.cache/ms-playwright`; a failure blocks merge. Covers the full 47-spec suite plus v1.4 additions.
- [ ] **CI-04**: `.github/workflows/release.yml` triggered on `v*` git tag push runs `pnpm changeset publish` with `NPM_TOKEN` secret; guarded by a prior green `build.yml` + `unit.yml` + `e2e.yml` run on the tagged SHA.

---

## Category 2: Release Publication (REL)

Continues numbering from v1.3 REL-04. Now unblocked by `@napplet/core@0.2.0` on npm.

- [ ] **REL-05**: `pnpm changeset publish` executed for the 4 staged v1.3 changesets (`.changeset/v1-3-*.md`); `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services` published to npm at `0.2.0`; registry listings verifiable via `npm view @kehto/<pkg> version`.
- [ ] **REL-06**: Fresh-install smoke test — `npm install @kehto/shell @kehto/runtime @kehto/acl @kehto/services` in a throwaway directory resolves peer deps from npm (not workspace `link:`), types resolve, and a minimal `createRuntime()` script runs without module-resolution errors.

---

## Category 3: DRIFT-CORE-06 Cleanup (DRIFT)

Pure internal refactor. No upstream dependency.

- [ ] **DRIFT-01**: `packages/runtime/src/core-compat.ts` **deleted**. Live type imports moved to rightful homes: `Capability` re-imported from `@kehto/acl/capabilities` (already the canonical source); `ServiceDescriptor` relocated to `@kehto/runtime/types`; `REPLAY_WINDOW_SECONDS` inlined in `replay.ts` or moved to a `@kehto/runtime/constants` file.
- [ ] **DRIFT-02**: Dead NIP-01 code paths deleted — all `BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS` references removed from `enforce.ts`, `state-handler.ts`, `service-discovery.ts`, and `@kehto/services` files. No behavior change (v1.2 made NIP-5D canonical; these code paths haven't executed since). `pnpm test` + `pnpm test:e2e` green post-refactor.

---

## Category 4: Real Keys Backend (KEYS)

Replaces the stub `@kehto/services` keys-service with a working implementation plus a host-bridge contract for native integrations.

- [ ] **KEYS-01**: `@kehto/services` keys-service implements a document-level chord listener via `document.addEventListener('keydown', ...)`; exposes `subscribe(chord, callback)` / `unsubscribe(chord)` API returning an unsubscribe handle; debounces held-keys per browser default behavior.
- [ ] **KEYS-02**: `@kehto/services` exports a `HostKeysBridge` interface + TypeScript types that host apps (Electron, Tauri) can implement for OS-level global hotkey registration; reference browser impl from KEYS-01 satisfies the interface; host-bridge implementation lives in host-app code, not in kehto (framework-agnostic).
- [ ] **KEYS-03**: `apps/demo/napplets/hotkey-chord` demo napplet (under `@napplet/sdk`) subscribes to a test chord (e.g. `Ctrl+Shift+K`) via the `keys.*` namespace; DOM sentinel `#hotkey-chord-status` transitions `connecting... → authenticated → subscribed` and increments a counter on each chord delivery.

---

## Category 5: Real Media Backend (MEDIA)

Replaces the stub `@kehto/services` media-service with a working implementation plus a host-bridge contract.

- [ ] **MEDIA-01**: `@kehto/services` media-service implements playback control via the Web Audio API for per-napplet audio elements + OS-level metadata/transport controls via the `MediaSession` API; exposes `play()` / `pause()` / `next()` / `previous()` / `setMetadata({title, artist, artwork})` via the `media.*` namespace.
- [ ] **MEDIA-02**: `@kehto/services` exports a `HostMediaBridge` interface + TypeScript types that host apps can implement for native media backends; reference Web Audio + MediaSession impl from MEDIA-01 satisfies the interface.
- [ ] **MEDIA-03**: `apps/demo/napplets/media-controller` demo napplet (under `@napplet/sdk`) calls `media.setMetadata` + `media.play` / `media.pause`; DOM sentinel `#media-controller-status` transitions `connecting... → authenticated → playing | paused` reflecting MediaSession state.

---

## Category 6: E2E Coverage (E2E)

Continues numbering from v1.3 E2E-11.

- [ ] **E2E-12**: Layer-B spec `tests/e2e/hotkey-chord.spec.ts` verifies chord registration via the host, chord delivery to the napplet, and counter increment. Uses the canonical `demoBeforeEach` + `waitForNappletReady` helpers.
- [ ] **E2E-13**: Layer-B spec `tests/e2e/media-controller.spec.ts` verifies `media.play` / `media.pause` / `media.setMetadata` via the napplet; asserts `#media-controller-status` transitions and (via browser_evaluate) MediaSession state.
- [ ] **E2E-14**: Existing Layer-A stub-scope specs `nub-keys.spec.ts` + `nub-media.spec.ts` upgraded from stub-scope to full protocol-correctness coverage now that real backends exist; any `test.describe.skip` markers removed.

---

## Category 7: Docs (DOCS)

Continues numbering from v1.3 DOCS-03.

- [ ] **DOCS-04**: JSDoc `@example` blocks in `tests/e2e/harness/harness.ts:10` + `tests/e2e/helpers/wait-for-napplet-ready.ts:21` refreshed to cite extant `nub-*` fixtures (stop referencing deleted `auth-napplet`).
- [ ] **DOCS-05**: `packages/services/README.md` extended with `keys` + `media` sections documenting the new public APIs, host-bridge interfaces, and usage examples referencing `hotkey-chord` / `media-controller` napplets.
- [ ] **DOCS-06**: `apps/demo/README.md` updated to list `hotkey-chord` + `media-controller` in the demo napplet inventory; integration narrative updated to reflect the 10-napplet end-to-end showcase (was 8 in v1.3).

---

## Future Requirements (deferred past v1.4)

- **Private-registry mirrors / self-hosted npm** — v1.4 publishes only to `registry.npmjs.org`. Mirror / self-hosted support is a v1.5+ consideration.
- **Host-bridge reference implementations for Electron / Tauri** — v1.4 defines the interfaces (KEYS-02, MEDIA-02); actual Electron/Tauri reference implementations live in host-app examples or follow-up milestones.

## Out of Scope (explicit exclusions)

- **Protocol-level changes to `@kehto/*`** — v1.2 is canonical; v1.4 does not modify the wire protocol. Reason: protocol stability is load-bearing for the npm publication.
- **Real backend for `identity`** — already a real backend via shell signer proxy + NIP-46; no stub to replace.
- **Multi-OS CI matrix** — v1.4 CI runs on `ubuntu-latest` only. Cross-OS coverage (macOS, Windows) is a v1.5+ concern if demand surfaces.
- **Publication automation beyond `changeset publish`** — no tag-signing, release-notes generation beyond what changesets provide, or GitHub Release drafts in v1.4.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CI-01 | Phase 23 | Pending |
| CI-02 | Phase 23 | Complete |
| CI-03 | Phase 23 | Pending |
| CI-04 | Phase 25 | Pending |
| REL-05 | Phase 25 | Pending |
| REL-06 | Phase 25 | Pending |
| DRIFT-01 | Phase 24 | Pending |
| DRIFT-02 | Phase 24 | Pending |
| KEYS-01 | Phase 26 | Pending |
| KEYS-02 | Phase 26 | Pending |
| KEYS-03 | Phase 26 | Pending |
| MEDIA-01 | Phase 27 | Pending |
| MEDIA-02 | Phase 27 | Pending |
| MEDIA-03 | Phase 27 | Pending |
| E2E-12 | Phase 26 | Pending |
| E2E-13 | Phase 27 | Pending |
| E2E-14 | Phase 28 | Pending |
| DOCS-04 | Phase 23 | Pending |
| DOCS-05 | Phase 28 | Pending |
| DOCS-06 | Phase 28 | Pending |

**Coverage:** 20/20 v1.4 requirements mapped — no orphans, no duplicates.

---

*Traceability table populated by gsd-roadmapper 2026-04-19.*
