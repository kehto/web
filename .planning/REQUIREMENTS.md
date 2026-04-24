# Requirements: v1.7 NIP-5D Spec Adoption & New NUB Domains

**Milestone:** v1.7
**Defined:** 2026-04-24
**Status:** Roadmap complete
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

## Overview

v1.7 is a **spec-adoption** milestone. It resyncs `specs/NIP-5D.md` to the canonical upstream (`dskvr/nips` branch `nip/5d`), adopts the two new envelope-level capabilities (NUB-CLASS + NUB-CONNECT) with their shell-authority policy gates, and ships reference services for the two new NUB domains (NUB-CONFIG + NUB-RESOURCE) — bringing kehto's NUB surface from 8 → 10 domains. Four carryover / opportunistic items ride along (nip66 demo wiring, `@kehto/wm` structural primitives, CACHE polish, and soft-gated NIP-44 decrypt).

**Spine (spec-driven):** SPEC resync → NUB-CLASS adoption → NUB-CONFIG + NUB-CONNECT (parallel) → NUB-RESOURCE → polish.

**Scope-in (mapped to research findings):**

| Source | Capability | Category | Upstream blocker? |
|--------|-----------|----------|-------------------|
| v1.6 Out-of-Scope SPEC-04 | NIP-5D resync from `dskvr/nips` nip/5d | SPEC | None |
| v1.6 Out-of-Scope CLASS-01..0N | Shell emits class posture; ACL gates cross-NUB | CLASS | Types provisional (upstream needs `^0.3.0`) |
| v1.6 Out-of-Scope CONNECT-01..0N | Per-napplet CSP + consent + grants | CONNECT | Types provisional (upstream needs `^0.3.0`) |
| v1.6 Out-of-Scope CONFIG-01..0N | 9th NUB domain reference service | CONFIG | None — `@napplet/nub/config` already published at `^0.2.1` |
| v1.6 Out-of-Scope RESOURCE-01..0N | 10th NUB domain reference service | RESOURCE | Types provisional (upstream needs `^0.2.2`) |
| v1.6 carryover (nip66#05 follow-up) | @kehto/nip66 demo wiring | NIP66 (cont.) | None |
| v1.6 carryover (wm post-skeleton) | @kehto/wm structural primitives | WM (cont.) | None |
| v1.6 carryover (kehto#1) | HostCacheBridge naming parity | CACHE | None |
| v1.6 Out-of-Scope DECRYPT-01 | Shell-side NIP-44 decrypt | DECRYPT | **Soft-gated** on `napplet/napplet#3` |

**REQ-ID format:** `[CATEGORY]-[NUMBER]`. SPEC, CLASS, CONNECT, CONFIG, RESOURCE, CACHE, DECRYPT start at `-01` (new categories). NIP66, WM, E2E, DOCS continue numbering from prior milestones.

**Anti-features carried forward from v1.6 (enforced every phase):**

- No `window.nostr` on any napplet-visible surface
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of deleted `packages/runtime/src/core-compat.ts`
- No `allow-same-origin` on napplet iframe sandbox
- No `@napplet/nub-*` split-package imports in `@kehto/*` source

**New anti-features in v1.7:**

- No `<meta http-equiv="Content-Security-Policy">` in any built napplet HTML (canonical NUB-CONNECT requirement — CI must catch this) (C-03)
- No async `class.assigned` envelope pattern — class posture MUST resolve synchronously before `shell.init` (C-01)
- No broadcast pattern (`getAllWindowIds()` loop) for NIP-44 decrypt responses — single-target routing only (C-06)
- No concrete layout algorithms shipped in `@kehto/wm` — structural primitives only (H-04)
- No `createResourceService` factory without `getConnectGrants` dependency from day one (H-03)

**E2E iteration-loop discipline (canon):** Every phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built `:4174` demo. Baseline entering v1.7: **54 passed / 0 failed / 0 skipped**. Projected close: **62–64 passed** (8 new specs minimum; +2 if DECRYPT unblocks).

**Breaking API change notice:** `onNip5dIframeCreate` return type expands with `class: string | null`. Ship-breaking; downstream (hyprgate primary) coordinates in parallel.

---

## v1 Requirements

### Category 1: NIP-5D Spec Resync (SPEC) — reserved from v1.6 Out-of-Scope

Re-sync `specs/NIP-5D.md` from canonical upstream `dskvr/nips` branch `nip/5d`. The new class-posture delegation paragraph is prerequisite for NUB-CLASS adoption; the remaining diff is commentary.

- [x] **SPEC-04**: `specs/NIP-5D.md` updated byte-identical to `https://raw.githubusercontent.com/dskvr/nips/nip/5d/5D.md` at a recorded commit SHA; header-comment sync date + commit SHA refreshed. Diff documented in phase ITERATION-LOG.

### Category 2: NUB-CLASS Adoption (CLASS)

Shell assigns class posture synchronously at iframe creation and enforces it cross-NUB via the existing ACL-before-dispatch gate. Types are provisional (`packages/shell/src/types/provisional-class.ts`) pending `@napplet/nub/class` upstream publish.

- [x] **CLASS-01**: `onNip5dIframeCreate` host-app hook return type expanded with `class: string | null` (breaking API expansion). Existing return shape preserved for all other fields; a null class defaults to the permissive class posture. Documented in Phase 2 changeset (minor bump — public hook-contract changed).
- [x] **CLASS-02**: Shell resolves class posture synchronously inside `onNip5dIframeCreate` and stores it on the session entry BEFORE the `shell.init` payload is sent; `shell.init` carries the resolved class inline so the shim receives it atomically. No post-init `class.assigned` envelope is emitted.
- [x] **CLASS-03**: `packages/runtime/src/enforce.ts` gate adds a class pre-filter: class-restricted NUB requests are rejected at this chokepoint (not in individual NUB handlers). No existing NUB handler receives a new class parameter; enforcement is centralized.
- [x] **CLASS-04**: `apps/demo/shell-host.ts` introduces a `CLASS_BY_DTAG` data-driven map (adjacent to `DEMO_NAPPLETS`) resolving every demo-napplet `dTag` → class posture. Adding a future napplet to `DEMO_NAPPLETS` without a `CLASS_BY_DTAG` entry fails a CI assertion (H-05 prevention).
- [x] **CLASS-05**: `docs/policies/SHELL-CLASS-POLICY.md` added (copied from canonical napplet repo `napplet/specs/SHELL-CLASS-POLICY.md`); sections applicable to kehto cross-referenced with file:line pointers into `packages/shell/`, `packages/runtime/enforce.ts`, and `apps/demo/shell-host.ts`.
- [x] **CLASS-06**: Provisional local type file `packages/shell/src/types/provisional-class.ts` defines the NUB-CLASS wire types (`ClassAssignmentPayload`, etc.) marked `// provisional — pending @napplet/nub/class publish`; a `TODO: swap import to @napplet/nub/class when published at ^0.3.0` annotation is present.

### Category 3: NUB-CONNECT Adoption (CONNECT)

Per-napplet Content-Security-Policy `connect-src` enforcement via shell HTTP-header authority (Vite `configureServer` + `configurePreviewServer`), with consent flow, grants persistence keyed on `(dTag, aggregateHash)`, revocation-forces-reload semantics, and a residual-meta-CSP CI audit. Types are provisional pending `@napplet/nub/connect` upstream publish.

- [x] **CONNECT-01**: `packages/shell/src/connect-store.ts` singleton added, mirroring `packages/shell/src/acl-store.ts` pattern: grants keyed `"<dTag>:<aggregateHash>"`, persisted via the shell storage proxy under localStorage key `'napplet:connect'`. Read/write/revoke API surfaced via `ShellBridge.connectStore`.
- [x] **CONNECT-02**: `apps/demo/vite.config.ts` extended with a `serveNappletCsp` plugin adjacent to the existing `serveDemoNapplets` plugin. The plugin hooks BOTH `configureServer` (dev) AND `configurePreviewServer` (preview/prod-like) and emits a per-napplet `Content-Security-Policy: connect-src <origins>` header on `/napplets/<dTag>/index.html` responses, derived from the active grants for that napplet.
- [x] **CONNECT-03**: Consent flow UI lives in shell DOM (above the iframe sandbox layer); dismiss = deny (the response resolves with `false`), timeout = deny. Consent dialog is a new shell component extending the existing `ConsentHandler` surface.
- [x] **CONNECT-04**: Grant revocation triggers iframe destroy + recreate (the newly-served HTML picks up the updated CSP header); the revoke path in `connect-store.ts` emits a `shell.revokeConnect(dTag)` signal the shell uses to remount the iframe. No in-place header mutation is attempted.
- [x] **CONNECT-05**: New pnpm script `pnpm audit:csp` recursively scans built `apps/demo/napplets/*/dist/index.html` (post-`pnpm build`) and **fails with non-zero exit** if any `<meta http-equiv="Content-Security-Policy">` tag is found. Script wired into CI Build workflow step immediately after build.
- [x] **CONNECT-06**: Aggregate-hash upgrade invalidates prior grants — the `connect-store` grant key is `"<dTag>:<aggregateHash>"`, so a rebuild with a new hash cannot inherit the old grants silently. Documented behavior in SHELL-CONNECT-POLICY.md.
- [x] **CONNECT-07**: `docs/policies/SHELL-CONNECT-POLICY.md` added (copied from canonical napplet repo); sections cross-referenced with kehto file:line pointers. Production reverse-proxy responsibility documented as host-app concern (kehto does not ship a production HTTP-header middleware).

### Category 4: NUB-CONFIG Reference Service (CONFIG)

9th NUB domain. Reference service in `@kehto/services`, reading types from `@napplet/nub/config` (published at `^0.2.1`, no upstream blocker). Asymmetric protocol — napplet reads, shell writes; NOT a general key-value store.

- [x] **CONFIG-01**: `packages/services/src/config-service.ts` exports `createConfigService(options): ServiceHandler` following the established `createXxxService` factory pattern. Options shape mirrors v1.6 Decision 18 (options-as-bridge). Imports wire types from `@napplet/nub/config`.
- [x] **CONFIG-02**: `packages/acl/src/capabilities.ts` adds `'config:read'` capability; `packages/runtime/src/resolve.ts` switch extended; `runtime.registerService()` wiring extended for the `config` domain in both `@kehto/services` barrel and demo shell registration.
- [x] **CONFIG-03**: `apps/demo/napplets/config-demo/` scaffolded as the 11th demo napplet (DEMO_NAPPLETS 10 → 11). Napplet exercises `config.get`, `config.watch` (the primary `@napplet/nub/config` read/subscribe pattern). Schema fixture comes from the napplet's own `config-schema.json`.
- [x] **CONFIG-04**: NUB-CONFIG scope boundary documented in `packages/services/src/config-service.ts` README prose: napplet reads, shell writes; persistence is shell-owned; NUB-STORAGE remains the general key-value surface. Anti-overlap with NUB-STORAGE explicit.

### Category 5: NUB-RESOURCE Reference Service (RESOURCE)

10th NUB domain. Shell acts as authenticated fetch proxy; napplets may not issue arbitrary network requests. Factory MUST accept `getConnectGrants` dependency from day one (H-03 prevention). Types are provisional pending `@napplet/nub/resource` upstream publish.

- [x] **RESOURCE-01**: `packages/services/src/resource-service.ts` exports `createResourceService({ fetch, isOriginGranted, getConnectGrants }): ServiceHandler`. `getConnectGrants` is a REQUIRED option, not optional — the factory throws on construction if it is missing. The service handler MUST consult `isOriginGranted` (via `getConnectGrants(dTag, aggregateHash)`) before proxying any outbound fetch; ungranted origins receive the canonical `denied` response.
- [x] **RESOURCE-02**: `packages/acl/src/capabilities.ts` adds `'resource:fetch'`; `packages/runtime/src/resolve.ts` + runtime dispatch extended for the `resource` domain.
- [x] **RESOURCE-03**: Service handler tracks in-flight requests and correlates `resource.cancel` to the corresponding `resource.bytes` request; canceled requests emit `resource.bytes.error` with canonical `canceled` typed-error code. Per canonical 4-message protocol (`resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound).
- [x] **RESOURCE-04**: `apps/demo/napplets/resource-demo/` scaffolded as the 12th demo napplet (DEMO_NAPPLETS 11 → 12). Napplet exercises `resource.bytes` request + response lifecycle including grant-gated refusal (demo hooks grant a single allowlisted origin; the napplet attempts one allowed + one denied fetch). `CLASS_BY_DTAG` + `CANONICAL_NUB_DOMAINS` updated.
- [x] **RESOURCE-05**: `docs/policies/SHELL-RESOURCE-POLICY.md` added (copied from canonical napplet repo); SVG rasterization, MIME sniffing, private-IP blocking, and redirect-limit policy documented as responsibilities of the host-provided `fetch` option — not the service handler itself.
- [x] **RESOURCE-06**: Provisional local type file `packages/shell/src/types/provisional-resource.ts` (or `packages/services/src/types/provisional-resource.ts`) defines NUB-RESOURCE wire types marked `// provisional — pending @napplet/nub/resource publish`; `TODO: swap import to @napplet/nub/resource when published at ^0.2.2` annotation present.

### Category 6: @kehto/nip66 Demo Wiring (NIP66 — continued from v1.6 NIP66-05)

NIP66-05 left the `ShellAdapter.getNip66Suggestions()` hook wired to `() => null`. v1.7 makes it live against `createNip66Aggregator` + a mock kind-30166 fixture in the demo relay pool.

- [x] **NIP66-06**: `Nip66Aggregator` interface exported from `@kehto/nip66` gains a `stop(): void` method; implementation disposes of its pool subscription + timers. Added to the 5-symbol locked public API + tested via Vitest (M-03 prevention — resource leak).
- [x] **NIP66-07**: `apps/demo/src/mock-relay-pool.ts` extended to emit 2–3 fixture `kind:30166` relay discovery events; `apps/demo/shell-host.ts` wires `getNip66Suggestions` to an instance of `createNip66Aggregator` with the demo mock pool. Live suggestions flow into the feed or relay-config surface visible to the user.

### Category 7: @kehto/wm Structural Primitives (WM — continued from v1.6 WM-03)

Ship the structural abstractions consumers implement to build concrete layouts. No BSP / master-stack / floating algorithms are included in `@kehto/wm` — those remain in consumer repos (e.g., hyprgate). WM stays shell-internal (NOT a new NUB domain).

- [x] **WM-04**: `packages/wm/src/index.ts` exports a `LayoutStrategy` interface with an `arrange(windows, containerRect)` method, a `WindowState` interface (position, size, focus, minimized), and a `WindowPlacement` result type. No `'dwindle'` or `'master-stack'` string-literal types remain in the exports.
- [x] **WM-05**: `createWmService` factory signature extended to `createWmService({ hooks, strategy? }): WmService`; `strategy` defaults to a no-op that returns the incoming `windows` unchanged so consumers can ship a working shell before implementing concrete layouts. The v1.6 throwing stub body is replaced with the no-op default.
- [x] **WM-06**: Library file size stays under ~200 lines (`wc -l packages/wm/src/index.ts` < 200 at phase close). Zero algorithm-specific types shipped in the public surface.
- [x] **WM-07**: `@kehto/wm` README extended: "What this package is / is not" section with a consumer-integration example showing a hyprgate-style `LayoutStrategy` implementation living in the consumer repo; `@example` comment on the factory signature.

### Category 8: CacheService Naming Parity (CACHE)

Cosmetic-only. v1.6 dropped CACHE-01..05 mid-milestone when Phase 33 realized `CacheServiceOptions` already IS the bridge. This v1.7 item adds the missing type alias for naming parity with `HostKeysBridge` / `HostMediaBridge`. Additive — no breaking changes.

- [x] **CACHE-01**: `packages/services/src/cache-service.ts` exports `type HostCacheBridge = CacheServiceOptions` as an additive alias. The existing `CacheServiceOptions` export remains in the public API unchanged. Changeset is `patch` (no breaking change, no new capability). Barrel re-exports updated.

### Category 9: NIP-44 Decrypt Surface (DECRYPT — soft-gated)

Ship if `napplet/napplet#3` resolves during the milestone; defer to v1.8 if not. `nostr-tools/nip44` is already available (no dependency change). When shipped, the surface is shell-side only — napplets never hold keys or see plaintext via a broadcast.

- [ ] **DECRYPT-01**: Shell `@kehto/shell` exposes an internal `decryptNip44(ciphertext, senderPubkey, recipientWindowId)` method wired via `nostr-tools/nip44.decrypt` + `getConversationKey`. The decrypted plaintext is delivered to the `recipientWindowId` iframe **exclusively** (single-target, never broadcast via `getAllWindowIds()` loops) (C-06 prevention).
- [ ] **DECRYPT-02**: Class-posture enforcement — class-forbidden NUB requests (e.g., Class-2 napplet requesting `identity.decrypt` in a shell surface where NUB-CLASS reserves decrypt for Class-1) receive the canonical `class-forbidden` typed-error. Enforced in `enforce.ts` alongside CLASS-03.
- [ ] **DECRYPT-03**: NIP-44 spec test-vector (canonical cross-implementation vector) passes as a Vitest unit test in `packages/shell/tests/nip44.test.ts`.

### Category 10: E2E Coverage (E2E — continued from v1.6 E2E-18)

Tests that lock the v1.7 contracts at Layer-B (`tests/e2e/*.spec.ts`) against the built `:4174` demo. Each listed spec file contributes at least one test.

- [x] **E2E-19**: Entering v1.7 Phase 1: canonical `pnpm clean && pnpm build && pnpm test:e2e` loop records `54/0/0` baseline preserved (no regression introduced by SPEC resync).
- [x] **E2E-20**: `tests/e2e/class-invariant.spec.ts` added — cross-NUB Layer-B invariant: a class-restricted demo napplet attempting a NUB request outside its class posture gets rejected at the `enforce.ts` gate regardless of which NUB domain issued the request. Contains at least one test per NUB domain covered. **Scope is split across two phases:** Phase 38 delivers 8/10 domains (identity, ifc, keys, media, notify, relay, storage, theme) — the 8 active NUB domains at v1.7 Phase 38 close. Phase 40 (NUB-RESOURCE) extends the same spec with 2 additional tests (config, resource) when those reference services ship. The checkbox flips to checked only when Phase 40 completes the extension (10/10 domains covered). This split is traceability-tracked below.
- [x] **E2E-21**: `tests/e2e/connect-consent.spec.ts` added — consent dialog approve flow (user grants; subsequent fetch succeeds) and dismiss=deny flow (user dismisses; fetch gets canonical refusal). Two tests.
- [x] **E2E-22**: `tests/e2e/connect-revocation.spec.ts` added — grant revocation triggers iframe destroy + recreate; the newly-mounted iframe receives the updated CSP header excluding the revoked origin. One test.
- [x] **E2E-23**: `tests/e2e/connect-csp-preview.spec.ts` added — CSP header is present on napplet HTML response when the demo is served by `pnpm preview` (not just `pnpm dev`), confirming `configurePreviewServer` wiring.
- [x] **E2E-24**: `tests/e2e/nub-config.spec.ts` added — config-demo napplet exercises `config.get` + `config.watch` round-trip against the shell-side reference service; config values propagate correctly.
- [x] **E2E-25**: `tests/e2e/nub-resource.spec.ts` added — resource-demo napplet: (a) successful `resource.bytes` fetch against a granted origin; (b) `denied` response for an ungranted origin (H-03 coupling test). Two tests.
- [ ] **E2E-26**: `tests/e2e/nip66-suggestions.spec.ts` added — demo shell surfaces relay suggestions from `createNip66Aggregator` fed by mock kind-30166 fixtures; at least one suggestion from each fixture event appears in the UI.
- [ ] **E2E-27** (soft-gated, DECRYPT): `tests/e2e/decrypt-single-target.spec.ts` added — two iframes present; one requests NIP-44 decrypt; only the requesting iframe receives the plaintext (the second iframe observes no decrypt-response envelope in its MessageTap).

### Category 11: Documentation (DOCS — continued from v1.6 DOCS-05)

- [x] **DOCS-06**: `specs/NIP-5D.md` header comment updated to reference v1.7 sync date and upstream commit SHA (per SPEC-04). `README.md` Specification section cross-reference verified as still valid.
- [x] **DOCS-07**: New `docs/policies/` directory added containing SHELL-CLASS-POLICY.md, SHELL-CONNECT-POLICY.md, SHELL-RESOURCE-POLICY.md. Each file's header records its canonical source (napplet repo path + commit SHA) and its copy date. Root README Packages table updated to reference the policies directory.

---

## Future Requirements

- **DECRYPT-01 (if upstream slips)** — receive-side NIP-44 decrypt surface, awaits napplet/napplet#3 → v1.8
- **Upstream NUB dep bump** — when `@napplet/nub@^0.2.2` and `@napplet/nub@^0.3.0` publish CLASS/CONNECT/RESOURCE subpaths, swap provisional local types for canonical imports + delete `packages/shell/src/types/provisional-*.ts`. Single-atomic-bump (lockfile churn strategy) post-milestone or at milestone-close.
- **`identitySource: 'auth' | 'source'` rename** — live type in SessionEntry (v1.7+ tech debt)
- **`bridge.injectEvent('auth:identity-changed', ...)` rename** — live surface with external consumers (v1.7+ tech debt)
- **Electron / Tauri HostXxxBridge reference impls** — HostKeys, HostMedia, HostCache reference impls (v1.4 carryover)
- **Multi-OS CI matrix** — macOS + Windows runners for Build + Playwright workflows (v1.4 carryover)
- **`@kehto/wm` concrete layouts** — if a future consumer surfaces a real need for kehto to ship BSP / master-stack / floating algorithms (not anticipated; consumer-driven)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full `@kehto/wm` layout engine (BSP / master-stack / floating algorithms) | Consumer-specific; each kehto impl has its own layout needs. v1.7 ships only the abstract primitives consumers implement. |
| Production HTTP-header middleware for CSP (Express / Fastify / Cloudflare Worker) | Host-app concern; kehto documents the requirement in SHELL-CONNECT-POLICY.md but does not ship a production-middleware reference impl. |
| `pnpm.overrides @napplet/nub>@napplet/core` retirement (SEED-001) | Gated on upstream publish-time workspace-specifier bug fix; not milestone-driven. |
| NUB-CONFIG as general key-value store | Anti-overlap with NUB-STORAGE. CONFIG is shell-writes / napplet-reads only. |
| NUB-CONNECT MIME / SVG filtering | Host-provided `fetch` concern, not the NUB wire contract. Documented in SHELL-RESOURCE-POLICY.md. |
| Dynamic mid-session class re-assignment | Canonical NUB-CLASS design forbids it (class is at-most-once per iframe lifecycle). |
| Napplet-provided CSP via `<meta http-equiv>` | Forbidden by canonical NUB-CONNECT; refuse-to-serve required (enforced by CONNECT-05 CI audit). |

---

## Traceability

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| SPEC-04 | Phase 37 | Gates all downstream phases |
| CLASS-01 | Phase 38 | Breaking API: `onNip5dIframeCreate` return type |
| CLASS-02 | Phase 38 | Synchronous class posture; no async class.assigned |
| CLASS-03 | Phase 38 | Centralized enforce.ts pre-filter |
| CLASS-04 | Phase 38 | CLASS_BY_DTAG data-driven map |
| CLASS-05 | Phase 38 | SHELL-CLASS-POLICY.md |
| CLASS-06 | Phase 38 | Provisional class types |
| CONNECT-01 | Phase 39 | connect-store.ts; prerequisite for RESOURCE-01 |
| CONNECT-02 | Phase 39 | Vite CSP plugin (configureServer + configurePreviewServer) |
| CONNECT-03 | Phase 39 | Consent flow UI; dismiss=deny |
| CONNECT-04 | Phase 39 | Revocation triggers iframe destroy+recreate |
| CONNECT-05 | Phase 39 | pnpm audit:csp CI gate |
| CONNECT-06 | Phase 39 | Hash-upgrade grant invalidation |
| CONNECT-07 | Phase 39 | SHELL-CONNECT-POLICY.md |
| CONFIG-01 | Phase 39 | Parallel with CONNECT; no connect dependency |
| CONFIG-02 | Phase 39 | Capabilities + dispatch wiring |
| CONFIG-03 | Phase 39 | config-demo napplet (11th) |
| CONFIG-04 | Phase 39 | Scope boundary documentation |
| RESOURCE-01 | Phase 40 | Requires CONNECT-01 grants store |
| RESOURCE-02 | Phase 40 | Capabilities + dispatch wiring |
| RESOURCE-03 | Phase 40 | resource.cancel correlation |
| RESOURCE-04 | Phase 40 | resource-demo napplet (12th) |
| RESOURCE-05 | Phase 40 | SHELL-RESOURCE-POLICY.md |
| RESOURCE-06 | Phase 40 | Provisional resource types |
| NIP66-06 | Phase 41 | Polish wave; stop() method + Vitest |
| NIP66-07 | Phase 41 | Polish wave; mock fixtures + live wiring |
| WM-04 | Phase 41 | Polish wave; LayoutStrategy + WindowState + WindowPlacement |
| WM-05 | Phase 41 | Polish wave; no-op default strategy |
| WM-06 | Phase 41 | Polish wave; file-size guard |
| WM-07 | Phase 41 | Polish wave; README "what this is / is not" |
| CACHE-01 | Phase 41 | Polish wave; additive HostCacheBridge alias |
| DECRYPT-01 | Phase 42 | Soft-gated on napplet/napplet#3 |
| DECRYPT-02 | Phase 42 | Soft-gated; class-forbidden gate |
| DECRYPT-03 | Phase 42 | Soft-gated; NIP-44 test vector |
| E2E-19 | Phase 37 | Baseline 54/0/0 confirmation |
| E2E-20 | Phase 38 (8/10 domains) + Phase 40 (+config+resource = 10/10) | class-invariant.spec.ts — Phase 38 ships the 8-domain subset (identity, ifc, keys, media, notify, relay, storage, theme); Phase 40 extends with config+resource. Checkbox stays unchecked until Phase 40 close. |
| E2E-21 | Phase 39 | connect-consent.spec.ts |
| E2E-22 | Phase 39 | connect-revocation.spec.ts |
| E2E-23 | Phase 39 | connect-csp-preview.spec.ts |
| E2E-24 | Phase 39 | nub-config.spec.ts |
| E2E-25 | Phase 40 | nub-resource.spec.ts |
| E2E-26 | Phase 41 | nip66-suggestions.spec.ts |
| E2E-27 | Phase 42 | Soft-gated; decrypt-single-target.spec.ts |
| DOCS-06 | Phase 37 | NIP-5D header comment + README cross-reference |
| DOCS-07 | Phase 40 | docs/policies/ directory (all three policy files present) |

**Coverage:** 45/45 v1 requirements mapped. No orphans.

---

*Requirements defined: 2026-04-24. Research consumed: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md.*
*Traceability filled: 2026-04-24 by roadmapper.*
