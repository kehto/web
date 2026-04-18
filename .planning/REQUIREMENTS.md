# Requirements: v1.3 Demo Functional & Playwright Parity

**Milestone:** v1.3
**Defined:** 2026-04-18
**Status:** Draft (pending roadmap)

## Overview

v1.3 is a **consume-and-showcase** milestone. No `@kehto/*` protocol changes. The goal is that `apps/demo`, its bundled napplets (`apps/demo/napplets/*`), and the Playwright suite (`tests/e2e/*`) all work cleanly against the canonical v1.2 `@kehto/*` + `@napplet/*` API surface, with a comprehensive build→run→Playwright→fix iteration loop driving each phase to completion.

**REQ-ID format:** `[CATEGORY]-[NUMBER]` — categories: `DEMO`, `NAP`, `E2E`, `DOCS`, `REL`.

**Hard anti-features (enforced every phase):**
- No `window.nostr` on any napplet-visible surface (NIP-5D MUST NOT)
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06)
- No `allow-same-origin` on napplet iframe sandbox
- No CI/CD work (deferred)
- `changeset publish` **NOT** run (deferred pending `@napplet/core` npm publication)

---

## Category 1: Demo App Rewire (DEMO)

Demo host (`apps/demo/src/*`) wired to canonical v1.2 APIs.

- [x] **DEMO-01**: Demo boots clean — no `window.nostr` references, no signer-service, no legacy BusKind in demo source; all 8 service nodes visible in topology on load.
- [x] **DEMO-02**: Signer modal + NIP-46 client (`signer-demo.ts`, `signer-modal.ts`, `signer-connection.ts`, `nip46-client.ts`) use canonical `identity.*` reads + `relay.publish` / `relay.publishEncrypted` paths only. No `window.nostr` fallback path exists.
- [x] **DEMO-03**: ACL panel (grant/revoke), ACL modal, ACL history ring buffer are functional against v1.2 `ShellAdapter.acl` hooks; user can grant/revoke any capability on any napplet and see the change reflected in napplet behavior.
- [x] **DEMO-04**: Debugger tap (`debugger.ts`) displays NIP-5D envelope `type` strings (e.g., `relay.publish`, `storage.getItem.result`) — not NIP-01 verbs, not BusKind constants.
- [x] **DEMO-05**: `createDemoHooks()` registers reference services for `keys`, `media`, `theme` from `@kehto/services` alongside existing `identity`/`notify`; relay pool stays stubbed (by design — IFC routes through runtime's `ifcSubscriptions` map).
- [x] **DEMO-06**: Node inspector pane opens on topology-node click and shows per-role content: ACL node → grant/revoke table; runtime node → registered NUBs; napplet node → capability state + recent envelopes.
- [x] **DEMO-07**: Notification demo + kinds panel + constants panel all render clean and reflect v1.2 data (canonical kind list, protocol constants from `@napplet/core`).
- [x] **DEMO-08**: Flow/sequence/trace edge animators render live napplet traffic without stale NIP-01 or BusKind references; color-mode cycling works (flash/rolling/decay/last/trace).

---

## Category 2: Napplet Showcase (NAP)

Migrate legacy napplets to `@napplet/sdk`; expand with single-purpose napplets until all non-stub NUB domains are exercised end-to-end.

- [ ] **NAP-01**: `apps/demo/napplets/bot` migrated to `@napplet/sdk` envelope API; no raw `window.addEventListener('message')`; exercises `ifc` + `storage` domains.
- [ ] **NAP-02**: `apps/demo/napplets/chat` migrated to `@napplet/sdk` (kept under `chat/` or renamed to `multiplayer-chat/`); exercises `ifc` domain via `ipc.emit` / `ipc.on`.
- [ ] **NAP-03**: `composer` napplet added under `apps/demo/napplets/composer`; exercises `relay.publish` and `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in); UI shows OK/denied status.
- [ ] **NAP-04**: `preferences` napplet added; exercises `storage.setItem` / `storage.getItem`; state survives page reload.
- [ ] **NAP-05**: `toaster` napplet added; exercises `notify.create` / `notify.list` / `notify.read` / `notify.dismiss`; host toast layer and napplet UI both update.
- [ ] **NAP-06**: `feed` napplet added; exercises `relay.subscribe` (kinds filter + limit); renders received events; EOSE sets "loaded" state. Delivery mechanism decided in Phase 20 planning (`/gsd:discuss-phase 20`).
- [ ] **NAP-07**: `profile-viewer` napplet added; exercises `identity.getPublicKey` + `identity.getProfile`; shows truncated pubkey + name/about/picture when present.
- [ ] **NAP-08**: `theme-switcher` napplet added; triggers host `publishTheme()` via a shell-exposed control path; at least one other napplet receives and visibly reacts to `theme.changed` push events.
- [ ] **NAP-09**: All 6 non-stub NUB domains (`identity`, `ifc`, `notify`, `relay`, `storage`, `theme`) are exercised end-to-end by at least one demo napplet; `keys` and `media` remain stub-only and explicitly scoped out with a documented reason in the shell host's service-registration block.

---

## Category 3: Playwright Suite (E2E)

Triage legacy E2E specs; add NIP-5D-canonical golden-path specs; both test layers green.

- [x] **E2E-01**: Obsolete specs deleted from `tests/e2e/`: `auth-handshake.spec.ts`, `auth.spec.ts`, `signer-delegation.spec.ts`, `acl-matrix-signer.spec.ts`; any other spec that references `window.nostr`, `signer-service`, `BusKind`, or kind 29001/29002 injection.
- [x] **E2E-02**: `@playwright/test` upgraded to `^1.54.0` (minimum); specs use `page.consoleMessages()` / `page.pageErrors()` / `consoleMessage.timestamp()` for console + error capture per-spec.
- [x] **E2E-03**: `playwright.config.ts` runs an array `webServer` — harness at `:4173` (existing) + demo at `:4174` (new). `turbo.json` adds a `build:napplets` pipeline task so `pnpm test:build` builds napplet dists before Playwright runs.
- [x] **E2E-04**: Harness driver API (`tests/e2e/harness/harness.ts`) extended with NIP-5D envelope helpers: `__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`. All helpers return structured-clone-safe primitives.
- [x] **E2E-05**: `waitForNappletReady(page, frameSelector)` helper exists and is used by every frame-touching spec; canonical `beforeEach` fixture (`goto('/') → __aclClear__() → __clearLocalStorage__()`) is shared across all ACL-touching specs; `page.reload()` forbidden in specs that touch ACL state.
- [x] **E2E-06**: Layer-B demo-surface specs green: `demo-boot`, `demo-node-inspector`, `demo-debugger`, `demo-service-toggle`, `demo-notification-service` (migrated).
- [ ] **E2E-07**: Layer-B domain specs green against real demo build: `napplet-auth`, `ifc-roundtrip`, `relay-publish`, `relay-publish-encrypted`, `relay-subscribe`, `identity-flow`, `storage-persist`, `notify-lifecycle`, `theme-broadcast`.
- [ ] **E2E-08**: Layer-B capability-matrix specs green: `acl-grant-revoke`, `acl-block-unblock`, `acl-revoke-relay-write`, `acl-revoke-storage-write`.
- [ ] **E2E-09**: Layer-A fixture napplets under `tests/fixtures/napplets/` — one per non-stub nub (identity, ifc, notify, relay, storage, theme). Matching `nub-<domain>.spec.ts` protocol-correctness specs drive the runtime via harness driver globals only.
- [ ] **E2E-10**: `pnpm test:e2e` completes green end-to-end against a real `pnpm build` artifact; zero skipped specs, zero legacy specs blocking the merge; full suite runs in under 5 minutes locally.
- [ ] **E2E-11**: Each phase from Phase 17 onward closes with a recorded build→run→Playwright→fix iteration loop — phases do not close on `tsc` / `vitest` green alone. Phase plan includes at least one Playwright MCP invocation as a gate.

---

## Category 4: Documentation Refresh (DOCS)

- [ ] **DOCS-01**: `typedoc@^0.28` configured at repo root with `entryPointStrategy: "packages"`; `pnpm docs:api` generates `docs/api/` for all 4 `@kehto/*` packages.
- [ ] **DOCS-02**: Package READMEs (`packages/acl/README.md`, `packages/runtime/README.md`, `packages/shell/README.md`, `packages/services/README.md`) updated to reference canonical v1.2 APIs only (no `window.nostr`, no signer-service); every public export has JSDoc with `@example`.
- [ ] **DOCS-03**: Root README + `docs/*.md` showcase v1.3 demo as the reference integration; obsolete migration docs (`docs/SHELL-MIGRATION.md`, `docs/RUNTIME-MIGRATION.md`, `docs/SERVICES-MIGRATION.md`) either archived under `docs/migrations/` or updated to terminal-state snapshots.

---

## Category 5: Release Rehearsal (REL)

No `changeset publish` — that is deferred until `@napplet/core` publishes to npm. This category only rehearses the steps.

- [ ] **REL-01**: `pnpm dlx publint packages/*` clean for all 4 `@kehto/*` packages.
- [ ] **REL-02**: `pnpm dlx @arethetypeswrong/cli --profile esm-only packages/*` clean for all 4 `@kehto/*` packages.
- [ ] **REL-03**: `pnpm changeset version` dry-run executed in a throwaway branch; `pnpm install --frozen-lockfile` succeeds after the version bump; diffs inspected (no unexpected peer-dep range changes); branch discarded. `changeset publish` explicitly **NOT** run.
- [ ] **REL-04**: v1.3 changesets staged at `.changeset/v1-3-*.md` for all 4 `@kehto/*` packages summarizing the demo/napplet/E2E/docs scope; each changeset body cites `DEMO-*`/`NAP-*`/`E2E-*` IDs it covers.

---

## Future Requirements (deferred past v1.3)

- **CI/CD** — GitHub Actions for build + type-check + unit + Playwright on push (explicitly out of scope for v1.3).
- **`hotkey-chord` napplet (keys domain)** — deferred until a real host-side hotkey backend ships; current `@kehto/services` keys-service is stub-only and would demo "not implemented."
- **`media-controller` napplet (media domain)** — deferred for the same reason: media-service is stub-only.
- **`changeset publish` to npm** — unblocked only when `@napplet/core` publishes to npm.
- **`DRIFT-CORE-06` cleanup** — `packages/runtime/src/core-compat.ts` removal waits for `@napplet/core` to restore legacy exports upstream.

## Out of Scope (explicit exclusions)

- **Protocol-level changes to `@kehto/*`** — v1.2 delivered canonical NIP-5D; v1.3 does not modify protocol. Reason: prevents scope drift and re-opens already-validated conformance.
- **Rebuilding `window.nostr` as a napplet surface** — canonically forbidden by NIP-5D. Reason: the demo's job is to model the canonical contract, not work around it.
- **Mega-napplet spanning multiple domains** — NIP-5D philosophy says single-purpose; reason: obscures what each NUB does.
- **Real backends for `keys` / `media` reference services** — services stay stub-only. Reason: those backends are host-app concerns outside the kehto repo.
- **`pnpm dev` demo workflow for E2E** — Playwright runs only against `pnpm preview` builds. Reason: `@napplet/vite-plugin` emits `aggregateHash=""` in dev mode; ACL keys are poisoned against dev builds.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DEMO-01 | Phase 17 | Complete |
| DEMO-02 | Phase 17 | Complete |
| DEMO-03 | Phase 17 | Complete |
| DEMO-04 | Phase 17 | Complete |
| DEMO-05 | Phase 17 | Complete |
| DEMO-06 | Phase 17 | Complete |
| DEMO-07 | Phase 17 | Complete |
| DEMO-08 | Phase 17 | Complete |
| NAP-01 | Phase 18 | Pending |
| NAP-02 | Phase 18 | Pending |
| NAP-03 | Phase 19 | Pending |
| NAP-04 | Phase 19 | Pending |
| NAP-05 | Phase 19 | Pending |
| NAP-06 | Phase 20 | Pending |
| NAP-07 | Phase 20 | Pending |
| NAP-08 | Phase 20 | Pending |
| NAP-09 | Phase 20 | Pending |
| E2E-01 | Phase 16 | Complete |
| E2E-02 | Phase 16 | Complete |
| E2E-03 | Phase 16 | Complete |
| E2E-04 | Phase 16 | Complete |
| E2E-05 | Phase 16 | Complete |
| E2E-06 | Phase 17 | Complete |
| E2E-07 (ifc-roundtrip, napplet-auth) | Phase 18 | Pending |
| E2E-07 (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle) | Phase 19 | Pending |
| E2E-07 (relay-subscribe, identity-flow, theme-broadcast) | Phase 20 | Pending |
| E2E-08 | Phase 19 | Pending |
| E2E-09 | Phase 21 | Pending |
| E2E-10 | Phase 22 | Pending |
| E2E-11 | Phase 17–22 (cross-cutting gate; closed Phase 22) | Pending |
| DOCS-01 | Phase 22 | Pending |
| DOCS-02 | Phase 22 | Pending |
| DOCS-03 | Phase 22 | Pending |
| REL-01 | Phase 22 | Pending |
| REL-02 | Phase 22 | Pending |
| REL-03 | Phase 22 | Pending |
| REL-04 | Phase 22 | Pending |

---

*Requirements draft: 2026-04-18*
*Traceability filled: 2026-04-18 (roadmapper)*
