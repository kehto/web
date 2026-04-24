# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** — 5 phases (32–36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))

---

## v1.7: NIP-5D Spec Adoption & New NUB Domains

**Goal:** Resync canonical NIP-5D, adopt NUB-CLASS + NUB-CONNECT with their shell-authority policy gates, and ship reference services for NUB-CONFIG (9th domain) and NUB-RESOURCE (10th domain). Four carryover items ride along: nip66 demo wiring, wm structural primitives, CACHE naming parity, and soft-gated NIP-44 decrypt.

**E2E baseline entering v1.7:** 54/0/0. Projected close: 62–64/0/0.

**Coverage:** 45/45 requirements mapped.

### Phases

- [x] **Phase 37: SPEC Resync + Foundation Gates** — Update NIP-5D from upstream; establish provisional type strategy; record baseline; gates all downstream phases. (completed 2026-04-24)
- [x] **Phase 38: NUB-CLASS Adoption** — Shell assigns class posture synchronously at iframe creation; enforce.ts pre-filter; cross-NUB class invariant spec; downstream coordination note. (completed 2026-04-24)
- [x] **Phase 39: NUB-CONNECT Adoption + NUB-CONFIG Reference Service** — Per-napplet CSP header authority (Vite middleware); consent flow; grants store; meta-CSP CI audit; config service (9th domain) ships in parallel. (completed 2026-04-24)
- [ ] **Phase 40: NUB-RESOURCE Reference Service + Demo Napplets + Policy Docs** — Resource service factory with required connect-grant dependency; config-demo and resource-demo napplets (11th, 12th); all three policy docs complete.
- [ ] **Phase 41: Polish Wave** — nip66 demo wiring live; wm structural primitives; CACHE naming parity. All independent; ship together.
- [ ] **Phase 42: NIP-44 Decrypt Surface (soft-gated)** — Ship if napplet/napplet#3 resolves during milestone; defer to v1.8 if not.

---

## Phase Details

### Phase 37: SPEC Resync + Foundation Gates
**Goal**: The canonical NIP-5D spec is current, the provisional local type strategy is established, and the v1.6 E2E baseline is confirmed unbroken — so all downstream phases build on verified ground.
**Depends on**: Nothing (first v1.7 phase; continues from v1.6 Phase 36)
**Requirements**: SPEC-04, E2E-19, DOCS-06
**Success Criteria** (what must be TRUE):
  1. `specs/NIP-5D.md` is byte-identical to the upstream `dskvr/nips` nip/5d branch at a recorded commit SHA; the class-posture delegation paragraph is present and the sync header comment is refreshed.
  2. Provisional local type files exist for all three unpublished NUB domains (`provisional-class.ts`, `provisional-connect.ts`, `provisional-resource.ts`) each marked with `// provisional` annotations and `TODO: swap import` comments.
  3. `pnpm clean && pnpm build && pnpm test:e2e` records 54/0/0 — no regression from the spec file update.
  4. `README.md` Specification section cross-reference to the spec file is still valid after the update.
**Plans**: 2 plans
  - [x] 37-01-PLAN.md — Resync specs/NIP-5D.md from upstream + update README sync date + create provisional class/connect/resource type files (SPEC-04, DOCS-06)
  - [x] 37-02-PLAN.md — Run canonical `pnpm clean && pnpm build && pnpm test:e2e` loop; record 54/0/0 baseline in 37-ITERATION-LOG.md (E2E-19)

### Phase 38: NUB-CLASS Adoption
**Goal**: Shell resolves class posture synchronously at iframe creation and enforces it uniformly across all NUB domains via a centralized `enforce.ts` gate — so a class-restricted napplet cannot invoke capabilities outside its posture regardless of which NUB domain it uses.
**Depends on**: Phase 37
**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, CLASS-05, CLASS-06, E2E-20
**Rationale**: NUB-CLASS must precede NUB-CONNECT — the cross-NUB invariant requires class posture to be in the session registry before CONNECT grant evaluation. Resolving class synchronously in `onNip5dIframeCreate` (before `shell.init`) is the fix for the C-01 pre-assignment race (PITFALLS.md). Downstream coordination with hyprgate (primary consumer of the breaking `onNip5dIframeCreate` return type) is a phase-close deliverable — no dedicated coordination phase is needed.
**Breaking API change**: `onNip5dIframeCreate` return type expands with `class: string | null`. Coordinate with hyprgate in parallel.
**Success Criteria** (what must be TRUE):
  1. A class-restricted demo napplet attempting a NUB request outside its class posture is rejected at the `enforce.ts` gate regardless of which NUB domain issued the request (identity, ifc, keys, media, notify, relay, storage, theme — all covered in `class-invariant.spec.ts`).
  2. `shell.init` carries the resolved class inline (no post-init `class.assigned` async envelope); the session entry is written before `shell.init` is sent.
  3. `CLASS_BY_DTAG` data-driven map exists alongside `DEMO_NAPPLETS`; a CI assertion fails if a napplet is added to `DEMO_NAPPLETS` without a corresponding `CLASS_BY_DTAG` entry.
  4. `docs/policies/SHELL-CLASS-POLICY.md` is present with kehto file:line cross-references into `enforce.ts`, `shell-bridge.ts`, and `shell-host.ts`.
  5. The class enforcement grep (`grep -rn 'class' packages/runtime/src/enforce.ts`) shows the gate is centralized in `enforce.ts` — not scattered across individual NUB handler files.
**Plans**: 3 plans
  - [x] 38-01-PLAN.md — Establish types + session-entry class + shell.init inline class + breaking changeset (CLASS-01, CLASS-02, CLASS-06)
  - [x] 38-02-PLAN.md — Centralize class pre-filter in enforce.ts + runtime.ts wiring + EnforceResult.reason (CLASS-03)
  - [x] 38-03-PLAN.md — Demo CLASS_BY_DTAG + module-load assertion + test hook + SHELL-CLASS-POLICY.md + class-invariant.spec.ts + canonical 62/0/0 close (CLASS-04, CLASS-05, E2E-20)
**UI hint**: yes

### Phase 39: NUB-CONNECT Adoption + NUB-CONFIG Reference Service
**Goal**: Shell becomes the HTTP-header authority for napplet CSP (`connect-src`), a consent flow gates origin grants, and the 9th NUB domain (config) is live as a reference service — so napplets can only connect to origins they have been granted and can read shell-owned configuration.
**Depends on**: Phase 38 (NUB-CLASS required for cross-NUB enforcement; class posture in session before CONNECT grant evaluation)
**Requirements**: CONNECT-01, CONNECT-02, CONNECT-03, CONNECT-04, CONNECT-05, CONNECT-06, CONNECT-07, CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, E2E-21, E2E-22, E2E-23, E2E-24
**Rationale**: NUB-CONFIG has no dependency on NUB-CONNECT (config subpath already published at `^0.2.1`; independent service factory). Running CONFIG in parallel with CONNECT in the same phase captures the natural delivery boundary — both produce demo-testable outputs by phase close and share the same E2E iteration loop. NUB-RESOURCE is NOT in this phase because it requires the `getConnectGrants` factory parameter from CONNECT-01's `connect-store.ts` (H-03 prevention). Grants-to-middleware data flow (grants in localStorage vs Node-side middleware) is a concrete design decision deferred to the Phase 39 plan — the roadmap does not pre-commit a mechanism.
**Success Criteria** (what must be TRUE):
  1. Per-napplet `Content-Security-Policy: connect-src <origins>` header is present on napplet HTML responses in both `vite dev` and `vite preview` modes (asserted by `connect-csp-preview.spec.ts`).
  2. Consent dialog approve flow enables subsequent fetch; dismiss = deny flow returns canonical refusal (asserted by `connect-consent.spec.ts`).
  3. Revoking a connect grant triggers iframe destroy + recreate; the newly-mounted iframe receives the updated CSP header excluding the revoked origin (asserted by `connect-revocation.spec.ts`).
  4. `pnpm audit:csp` runs post-build, recursively scans built napplet `dist/index.html` files, and exits non-zero if any `<meta http-equiv="Content-Security-Policy">` tag is found.
  5. config-demo napplet exercises `config.get` + `config.watch` round-trip against the shell-side reference service; values propagate correctly (asserted by `nub-config.spec.ts`).
**Plans**: 5 plans
  - [x] 39-01-PLAN.md — connect-store singleton + ShellBridge.connectStore + config:read capability + resolve.ts + scripts/audit-csp.mjs (CONNECT-01, CONNECT-05, CONNECT-06, CONFIG-02)
  - [x] 39-02-PLAN.md — createConfigService factory + scope boundary documentation (CONFIG-01, CONFIG-04)
  - [x] 39-03-PLAN.md — Vite serveNappletCsp plugin (dev + preview) + POST /__connect-grants endpoint + GitHub Actions audit:csp step (CONNECT-02)
  - [x] 39-04-PLAN.md — consent modal DOM + iframe destroy+recreate on revoke + config-demo napplet (11th) + __grantConnectOrigin__/__revokeConnect__ test hooks + setDemoConfigValue (CONNECT-03, CONNECT-04, CONFIG-03)
  - [x] 39-05-PLAN.md — SHELL-CONNECT-POLICY.md + 4 E2E specs (connect-consent, connect-revocation, connect-csp-preview, nub-config) + canonical phase-close iteration loop recording 67/0/0 (CONNECT-07, E2E-21, E2E-22, E2E-23, E2E-24)
**UI hint**: yes

### Phase 40: NUB-RESOURCE Reference Service + Demo Napplets + Policy Docs
**Goal**: Shell acts as an authenticated fetch proxy for the 10th NUB domain; config-demo and resource-demo napplets are live in the demo (DEMO_NAPPLETS 10 → 12); all three policy docs are complete — so developers have a verifiable reference implementation for both new domains and a complete policy audit trail.
**Depends on**: Phase 39 (CONNECT-01 `connect-store.ts` grants store is a required factory dependency of RESOURCE-01)
**Requirements**: RESOURCE-01, RESOURCE-02, RESOURCE-03, RESOURCE-04, RESOURCE-05, RESOURCE-06, E2E-25, DOCS-07
**Rationale**: RESOURCE-01 requires `getConnectGrants` as a non-optional factory parameter from day one (H-03 prevention — HIGH recovery cost if retrofitted). This hard dependency on Phase 39's grants store makes RESOURCE a natural Phase 40 item. Demo napplets (config-demo, resource-demo) are scaffolded here after their services are registered — both `DEMO_NAPPLETS` 10→12 and `CLASS_BY_DTAG` updates land together. DOCS-07 (new `docs/policies/` directory with all three policy files) completes here once SHELL-RESOURCE-POLICY.md (RESOURCE-05) exists; the earlier CLASS and CONNECT policy files are already present from Phases 38–39 and simply move under the new directory header.
**Success Criteria** (what must be TRUE):
  1. `createResourceService` factory throws on construction if `getConnectGrants` is missing (the dependency is required, not optional).
  2. resource-demo napplet successfully fetches from a granted origin and receives a `denied` response for an ungranted origin (asserted by `nub-resource.spec.ts`, two tests).
  3. `resource.cancel` correctly correlates to the corresponding `resource.bytes` request and emits `resource.bytes.error` with `canceled` typed-error code.
  4. `DEMO_NAPPLETS` is 12 entries; `CLASS_BY_DTAG` has a corresponding entry for every napplet; `CANONICAL_NUB_DOMAINS` is extended to include `config` and `resource`.
  5. `docs/policies/` directory exists with SHELL-CLASS-POLICY.md, SHELL-CONNECT-POLICY.md, and SHELL-RESOURCE-POLICY.md — each with a canonical source header (napplet repo path + commit SHA + copy date).
**Plans**: 3 plans
  - [x] 40-01-PLAN.md — createResourceService factory (H-03 guard) + resource:fetch capability + resolve.ts + runtime.ts nubDispatch.registerNub('resource', ...) + shell-init CANONICAL_NUB_DOMAINS extension + shell barrel re-export of provisional-resource wire types + changeset (RESOURCE-01, RESOURCE-02, RESOURCE-03, RESOURCE-06)
  - [ ] 40-02-PLAN.md — resource-demo napplet scaffolding + demo-data.json fixture + shell-host.ts wiring (services.resource + DEMO_NAPPLETS[12] + CLASS_BY_DTAG[12]) + main.ts auto-grant fixture (D3) (RESOURCE-04)
  - [ ] 40-03-PLAN.md — SHELL-RESOURCE-POLICY.md + README Policies section + nub-resource.spec.ts (2 tests) + class-invariant.spec.ts extension (8→10 domains) + canonical phase-close iteration loop recording 71/0/0 (RESOURCE-05, E2E-25, DOCS-07, E2E-20)

### Phase 41: Polish Wave
**Goal**: Three independent carryover items ship: nip66 demo wiring goes live against real relay fixtures, `@kehto/wm` gains structural primitives consumers can implement against, and `HostCacheBridge` naming parity closes the kehto#1 cosmetic gap — so the carryover slate from v1.6 is clean.
**Depends on**: Phase 37 (logically; all three items are independent of CLASS/CONNECT/RESOURCE spine; can plan in parallel with Phases 38–40 but execute after Phase 40 to keep the E2E baseline stable)
**Requirements**: NIP66-06, NIP66-07, WM-04, WM-05, WM-06, WM-07, CACHE-01, E2E-26
**Rationale**: All three items (nip66 wiring, wm primitives, CACHE alias) are mutually independent and have no dependencies on the NUB-CLASS/CONNECT/RESOURCE spine beyond Phase 37's foundation. Grouping them into a single polish phase avoids three separate E2E iteration loops for low-risk items. `@kehto/wm` ships structural primitives only — no concrete layout algorithms (H-04 prevention; file stays under ~200 lines).
**Success Criteria** (what must be TRUE):
  1. `getNip66Suggestions()` is live in the demo (not `() => null`); demo shell surfaces at least one relay suggestion from mock kind-30166 fixtures fed through `createNip66Aggregator` (asserted by `nip66-suggestions.spec.ts`).
  2. `Nip66Aggregator.stop()` method exists, disposes pool subscription + timers, and is tested via Vitest (M-03 resource-leak prevention).
  3. `@kehto/wm` exports `LayoutStrategy`, `WindowState`, and `WindowPlacement` with no concrete algorithm types in the public surface; `wc -l packages/wm/src/index.ts` < 200.
  4. `createWmService` accepts `{ hooks, strategy? }` where `strategy` defaults to a no-op (returning windows unchanged) — no longer throws unconditionally.
  5. `packages/services/src/cache-service.ts` exports `type HostCacheBridge = CacheServiceOptions` as an additive alias; `CacheServiceOptions` export is preserved unchanged; changeset is `patch`.
**Plans**: TBD

### Phase 42: NIP-44 Decrypt Surface (soft-gated)
**Goal**: Shell exposes a NIP-44 decrypt surface that routes decrypted plaintext exclusively to the requesting iframe — so a napplet can decrypt DMs without the shell broadcasting plaintext to all running napplets.
**Depends on**: Phase 38 (class enforcement must be in place before decrypt class-posture gating can be added); SOFT-GATED on napplet/napplet#3 upstream resolution
**Requirements**: DECRYPT-01, DECRYPT-02, DECRYPT-03, E2E-27
**Rationale**: This phase is planned now and executed immediately if napplet/napplet#3 resolves during the milestone. If upstream does not resolve, the phase slips to v1.8 with zero impact on Phases 37–41. Planning it explicitly prevents the "discover mid-milestone it was forgotten" problem. The single-target routing constraint (never `getAllWindowIds()` for decrypt — C-06 prevention) is a hard requirement stated here so the phase plan cannot soften it.
**Soft-gate behavior**: At Phase 41 close, evaluate napplet/napplet#3 status. If resolved: execute Phase 42. If unresolved: mark Phase 42 deferred to v1.8, close milestone at Phase 41.
**Success Criteria** (what must be TRUE):
  1. Decrypted plaintext is delivered exclusively to the requesting `windowId` iframe; a second iframe present in the same session observes no decrypt-response envelope in its MessageTap (asserted by `decrypt-single-target.spec.ts`).
  2. A Class-2 napplet requesting a class-forbidden decrypt operation receives `class-forbidden` typed-error from the `enforce.ts` gate.
  3. The canonical NIP-44 test vector passes as a Vitest unit test in `packages/shell/tests/nip44.test.ts`.
  4. No `getAllWindowIds()` call appears in the decrypt response path (`grep -n 'getAllWindowIds' packages/shell/src/` returns no match in the decrypt handler).
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. SPEC Resync + Foundation Gates | 2/2 | Complete    | 2026-04-24 |
| 38. NUB-CLASS Adoption | 3/3 | Complete    | 2026-04-24 |
| 39. NUB-CONNECT + NUB-CONFIG | 5/5 | Complete    | 2026-04-24 |
| 40. NUB-RESOURCE + Demo Napplets + Policy Docs | 1/3 | In Progress|  |
| 41. Polish Wave | 0/? | Not started | - |
| 42. NIP-44 Decrypt (soft-gated) | 0/? | Not started | - |

---

*ROADMAP.md last restructured: 2026-04-24 — v1.7 milestone roadmap created.*
