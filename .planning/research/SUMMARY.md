# Project Research Summary

**Project:** kehto v1.7 — NIP-5D Spec Adoption & New NUB Domains
**Domain:** Napplet runtime / shell-side protocol adoption, NIP-5D spec compliance
**Researched:** 2026-04-24
**Confidence:** HIGH

---

## Executive Summary

v1.7 is a spec-adoption milestone. The primary deliverables are: resync `specs/NIP-5D.md` against the upstream `dskvr/nips` `nip/5d` branch (three discrete diffs, one new paragraph that canonically authorizes NUB-CLASS's class-posture delegation), implement NUB-CLASS shell emission with cross-NUB ACL enforcement, add NUB-CONFIG and NUB-RESOURCE reference services as the 9th and 10th domains, and implement NUB-CONNECT CSP header authority as a stretch target. The new NUB domains follow the same established `createXxxService(options)` factory pattern used by all existing services; no new npm dependencies are required for the core feature set.

The single largest structural risk is upstream publish state: as of 2026-04-24, `@napplet/nub@0.2.1` (the only published version) contains neither `class`, `connect`, nor `resource` subpaths — these do not exist anywhere in published form. `resource` exists in the `napplet/napplet` main branch (unpublished since commit `45661375e9df` on 2026-04-20) but `class` and `connect` have no source anywhere in the napplet repo. The recommended mitigation is to define provisional local types within `@kehto/shell` and `@kehto/services`, marked `// provisional — pending @napplet/nub/{class,connect,resource} publish`, and swap to the published subpath imports when upstream ships. All four domains must be treated as "provisional local types until confirmed published" in phase plans (config is already published and can be imported directly from `@napplet/nub/config`).

Three inter-researcher conflicts surface in this synthesis and are resolved below with concrete recommendations. The most important: NUB-CLASS timing must be resolved synchronously at iframe creation — not as an async `class.assigned` envelope dispatched after `shell.init`. This requires an `onNip5dIframeCreate` return-type expansion. The E2E spec baseline is projected to grow from 54 to 62–64 (not 60 as ARCHITECTURE.md estimated), accounting for all pitfall-driven additions. The milestone is executable without waiting for upstream publishes provided the provisional local type strategy is followed consistently.

---

## Conflict Resolution

### Conflict 1: NUB-CLASS Timing — Synchronous vs Async `class.assigned`

**ARCHITECTURE.md position:** emit `class.assigned` at `shell-bridge.ts:224` AFTER `shell.init` is sent.

**PITFALLS.md position (C-01):** structural race condition. The napplet shim starts sending NUB requests immediately after receiving `shell.init`. Requests arriving before the async `class.assigned` are evaluated under the permissive default — class-restricted napplets can issue privileged operations in a 200–500ms window.

**Resolved recommendation:** PITFALLS.md is correct. Class posture MUST be resolved synchronously inside `onNip5dIframeCreate`, BEFORE `shell.init` is sent. The class value is stored in the session entry at iframe registration time and read by the ACL enforce gate from the session. The `shell.init` payload should include the resolved class so the shim receives it atomically. This requires expanding the `onNip5dIframeCreate` return type to include `class: string | null` — a breaking API expansion. Any host-app implementing this hook must be updated. The async `class.assigned` envelope pattern from ARCHITECTURE.md should NOT be implemented.

### Conflict 2: Upstream NUB Publish State

**STACK.md (authoritative):** `class` and `connect` do not exist anywhere in the napplet repo or on npm (hard blocker); `resource` exists in `napplet/napplet` main but unpublished (soft blocker); `config` published in `@napplet/nub@0.2.1`.

**FEATURES.md:** Wire types read from local napplet source — correct data for the types that DO exist (config, resource), but those types cannot be imported via `@napplet/nub/class` etc. because those subpaths do not exist in the published tarball nor in the napplet source for class/connect.

**ARCHITECTURE.md:** proceeds assuming subpaths will be resolvable, with a "verification checkpoint" before Wave 2.

**Resolved recommendation:** STACK.md's publish-state findings are ground truth. Use provisional local type files for all three unpublished domains (`packages/shell/src/types/provisional-class.ts`, `provisional-connect.ts`, `provisional-resource.ts`), each marked with `// provisional — pending @napplet/nub/{domain} publish`. Do not plan more than one lockfile-churn cycle mid-milestone — hold all NUB peer dep bumps until all domains are published, then do one atomic upgrade. When published: `resource` needs `@napplet/nub@^0.2.2`; `class` and `connect` need `@napplet/nub@^0.3.0`.

### Conflict 3: E2E Spec-Count Estimate

**ARCHITECTURE.md estimate:** +6 specs (54 → 60/61).

**PITFALLS.md additions not counted:** CSP revocation → iframe reload spec (C-04), NIP-44 single-target isolation spec (C-06), meta-CSP CI audit gate (C-03), NUB-RESOURCE × NUB-CONNECT coupling spec (H-03), consent dismiss = deny spec (M-04).

**Resolved recommendation:** +8 to +10 new specs, **62–64 baseline**.

| Source | Specs | Notes |
|--------|-------|-------|
| NUB-CLASS cross-NUB invariant | +2 | +1 over ARCH estimate; must cover all 9+ NUB domains |
| NUB-CONNECT consent approve | +1 | |
| NUB-CONNECT consent dismiss = deny | +1 | M-04 requirement |
| NUB-CONNECT revocation + iframe reload | +1 | C-04 requirement |
| NUB-CONNECT CSP header in preview mode | +1 | C-05 requirement |
| NUB-CONFIG Layer-B round-trip | +1 | |
| NUB-RESOURCE with grant | +1 | |
| NUB-RESOURCE denied without grant | +1 | H-03 coupling spec |
| nip66 suggestions live | +1 | |
| NIP-44 single-target isolation (soft-gated) | +1 if unblocked | C-06 |

Guaranteed minimum: **+8 (62/0/0)**. With all pitfall-driven specs and NIP-44: **+10 (64/0/0)**.

---

## Key Findings

### Recommended Stack

No new npm dependencies required. Existing stack is fully compatible. `nostr-tools/nip44` (installed at 2.23.3) provides `getConversationKey` + `decrypt`. CSP `connect-src` construction is a string join — no library needed. Vite `configureServer` / `configurePreviewServer` hooks (already present in `apps/demo/vite.config.ts`) are the correct CSP injection points.

| NUB Domain | npm 0.2.1 | napplet/napplet main | v1.7 strategy |
|------------|-----------|----------------------|---------------|
| config | YES | YES | Import directly from `@napplet/nub/config` |
| resource | NO | YES (unpublished) | Provisional local types; swap on `^0.2.2` |
| class | NO | NO | Provisional local types; swap on `^0.3.0` |
| connect | NO | NO | Provisional local types; swap on `^0.3.0` |

### v1.7 Feature Inventory (9 features)

| # | Feature | Status | Depends On | Complexity | Phase Slot | Upstream Blocker |
|---|---------|--------|------------|------------|------------|-----------------|
| 1 | SPEC resync (NIP-5D.md) | Spine | — | S | Phase 1 | None |
| 2 | NUB-CLASS adoption (class.assigned, ACL, Layer-B) | Spine | Phase 1 + provisional class types | M | Phase 2 | YES — class types provisional |
| 3 | NUB-CONFIG reference service + config-demo | Spine | `@napplet/nub/config` (published) | M | Phase 3 | None |
| 4 | NUB-RESOURCE reference service + resource-demo | Spine | Phase 3 grants store + provisional resource types | M | Phase 4 | YES — resource types provisional |
| 5 | NUB-CONNECT adoption (CSP, consent, grants, scan) | Spine | Phase 2 (class), HTTP infra | L | Phase 3 (parallel with CONFIG) | YES — connect types provisional |
| 6 | SHELL-CLASS-POLICY.md audit checklist | Spine | Phase 2 | S | Phase 2 close | None |
| 7 | @kehto/nip66 demo wiring (NIP66-05 follow-up) | Carryover/Polish | mock-relay-pool fixtures | S | Phase 5 | None |
| 8 | @kehto/wm structural primitives (WM-04..07) | Carryover/Polish | — (independent) | S | Phase 5 | None |
| 9 | NIP-44 decrypt surface | Soft-gated | napplet/napplet#3 | M | Phase 6 or v1.8 | YES — upstream issue |

**Anti-features (do not build):** dynamic mid-session class re-assignment, shell-side `window.nostr` injection, generic `config.set` wire message, CSP via `<meta http-equiv>`, NUB-CONNECT MIME/SVG filtering.

### Architecture Approach

v1.7 extends the existing layered architecture without introducing new packages. The capability-before-dispatch enforcement pattern (`enforce.ts` gate before `nubDispatch.dispatch()`) is the correct chokepoint for NUB-CLASS — class enforcement belongs here, not in individual handlers. New services follow the options-as-bridge pattern (Decision 18). `connect-store.ts` follows the `acl-store.ts` singleton pattern.

**New files:** `packages/shell/src/connect-store.ts`, `packages/services/src/config-service.ts`, `packages/services/src/resource-service.ts`, `apps/demo/napplets/config-demo/`, `apps/demo/napplets/resource-demo/`

**Modified files (highest risk):** `shell-bridge.ts` (class posture sync + shell.init payload), `hooks-adapter.ts` (`onNip5dIframeCreate` return type), `enforce.ts` (class pre-filter), `apps/demo/vite.config.ts` (CSP injection plugin)

**Data-driven pattern extension (Decision 16):** `CLASS_BY_DTAG` map must live alongside `DEMO_NAPPLETS` so adding a napplet to the demo array automatically requires a class assignment entry — preventing the silent drift described in H-05.

### Critical Pitfalls (top 5)

1. **NUB-CLASS pre-assignment race (C-01)** — Class MUST resolve synchronously in `onNip5dIframeCreate` before `shell.init`. Never async. Phase 2 first requirement.
2. **Cross-NUB class invariant regression (C-02)** — Class gating in `enforce.ts` only, never in individual handlers. Layer-B spec must cover ALL 9+ NUB domains.
3. **CSP allowlist surviving revocation (C-04)** — Grant revocation MUST trigger iframe destroy + recreate. UX tradeoff, but only correct mechanism. Phase 3 hard requirement.
4. **NUB-RESOURCE without connect-grant validation (H-03)** — `createResourceService` MUST accept `getConnectGrants` as a required factory parameter from day one. Recovery cost is HIGH if retrofitted.
5. **Shell-HTTP-header authority in production (C-05)** — `configurePreviewServer` MUST be added alongside `configureServer`. E2E must assert CSP header in preview mode, not just dev mode.

---

## Implications for Roadmap

### Phase 1: SPEC Resync + Foundation Gates
**Rationale:** Everything downstream depends on updated spec text (class-posture delegation paragraph) and on knowing provisional type strategy. Gates all subsequent phases.
**Delivers:** Updated `specs/NIP-5D.md`, provisional local type files for class/connect/resource, publish-state documented, prefix collision grep clean, anti-term list updated, single-bump lockfile strategy confirmed.
**Avoids:** H-08 (lockfile churn), H-09 (prefix collision), M-05 (stale anti-term)
**Research flag:** None — well-documented procedure.

### Phase 2: NUB-CLASS Adoption
**Rationale:** NUB-CLASS is prerequisite for NUB-CONNECT (cross-NUB invariant requires class posture in session before CONNECT grants are evaluated). Class posture seeding must be in session registry before any other NUB work.
**Delivers:** `onNip5dIframeCreate` return type expanded with `class: string | null`; class resolved synchronously before `shell.init`; `enforce.ts` pre-filter; `CLASS_BY_DTAG` data-driven map; SHELL-CLASS-POLICY.md audit checklist; Layer-B cross-NUB invariant spec across all 9+ domains.
**Breaking API change:** `onNip5dIframeCreate` hook return type. Must coordinate with all host-app implementors.
**Avoids:** C-01, C-02, M-01, H-05
**Research flag:** None — architecture fully derived from source.

### Phase 3: NUB-CONNECT Adoption + NUB-CONFIG Reference Service (parallel sub-phases)
**Rationale:** NUB-CONFIG has no blockers after Phase 2 and is independent of NUB-CONNECT. NUB-CONNECT must precede NUB-RESOURCE (grants store required).
**NUB-CONNECT delivers:** `connect-store.ts` singleton; Vite CSP plugin (configureServer + configurePreviewServer); consent flow (dismiss=deny, timeout=deny); residual meta-CSP CI audit (`pnpm audit:csp`); srcdoc prohibition check; grant hash-upgrade policy; SHELL-CONNECT-POLICY.md; E2E: consent approve, dismiss, revocation+reload, preview CSP.
**NUB-CONFIG delivers:** `createConfigService` factory with schema-validated messages; capabilities in `capabilities.ts` + `resolve.ts`; dispatch registration in `runtime.ts`; scope boundary documented (NOT general key-value store).
**Avoids:** C-03, C-04, C-05, H-01, H-02, H-07, M-04
**Research flag:** NUB-CONNECT grants-to-middleware data flow needs concrete design decision in Phase 3 plan (grants in localStorage, Vite middleware in Node — recommend file-based sidecar `connect-grants.json`).

### Phase 4: NUB-RESOURCE Reference Service + Demo Napplets
**Rationale:** NUB-RESOURCE requires Phase 3 grants store. Demo napplets scaffold here after their services are registered.
**Delivers:** `createResourceService({ fetch, isOriginGranted })` factory with `getConnectGrants` explicit at construction; NUB-RESOURCE capabilities in ACL; config-demo and resource-demo napplets (11th, 12th); `DEMO_NAPPLETS` 10→12; `CLASS_BY_DTAG` updated; `CANONICAL_NUB_DOMAINS` extended; E2E: NUB-CONFIG Layer-B, NUB-RESOURCE with grant, NUB-RESOURCE denied without grant.
**Avoids:** H-03, H-05
**Research flag:** None — follows established factory pattern exactly.

### Phase 5: Polish (nip66 demo + wm primitives + CACHE, parallel)
**Rationale:** All independent of spine. Low risk.
**nip66 delivers:** `Nip66Aggregator.stop()` method; mock-relay-pool kind-30166 fixtures; `getNip66Suggestions` wired live; E2E roundtrip spec.
**wm delivers:** `LayoutStrategy`, `WindowState`, `WindowPlacement` interfaces (Option B); `createWmService` signature updated; no concrete algorithms; file stays under ~200 lines.
**CACHE delivers:** `HostCacheBridge = CacheServiceOptions` additive alias; `CacheServiceOptions` preserved; changeset=patch.
**Avoids:** M-03, H-04, M-02, M-06
**Research flag:** None.

### Phase 6: NIP-44 Decrypt Surface (soft-gated, may slip to v1.8)
**Rationale:** Gates on `napplet/napplet#3` upstream decision. Plan now, execute immediately if unblocked.
**Delivers (if unblocked):** Shell-side NIP-44 decrypt via `nostr-tools/nip44`; decrypt response routed exclusively to requesting `windowId`; NIP-44 test-vector unit test; class-forbidden enforcement for Class-2; E2E single-target isolation spec.
**Avoids:** C-06, H-06, H-10 (documented as known limitation)
**Research flag:** Soft-gated. Defer to v1.8 without impact on Phases 1–5 if upstream issue unresolved.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry verified; installed .d.ts verified; Vite middleware pattern confirmed in existing code |
| Features | HIGH | Wire types from authoritative local napplet source; changeset ship notes confirm scope |
| Architecture | HIGH | All integration points grounded in actual source file:line reads |
| Pitfalls | HIGH | Derived from direct codebase analysis; all warning signs are grep-verifiable |

**Overall confidence: HIGH**

### Gaps to Address

1. **NUB-CONNECT grants-to-middleware data flow** — Mechanism for surfacing localStorage grants to Vite Node.js middleware is unspecified. Recommended starting point: `connect-grants.json` sidecar file. Must be decided in Phase 3 plan.
2. **Provisional local type file structure** — Recommend one file per domain (`provisional-class.ts`, `provisional-connect.ts`, `provisional-resource.ts`) in `packages/shell/src/types/` for clean deletion on upstream publish.
3. **`onNip5dIframeCreate` breaking change scope** — Which host-apps beyond the demo implement this hook? If hyprgate implements it, coordinate before Phase 2. Verify by grepping the hyprgate repo.
4. **NUB-CONNECT consent UI component** — No existing component covers the SHELL-CONNECT-POLICY.md origin-list display requirements (full verbatim list, cleartext-origin warnings). Scope this as a UI task in Phase 3 planning.

---

## Prioritized Risk Ladder

### Upstream Blockers (address in Phase 1)
1. **@napplet/nub publish gap (class + connect + resource)** — HARD BLOCKER for import resolution. Mitigation: provisional local types decided in Phase 1.
2. **napplet/napplet#3 unresolved (NIP-44)** — SOFT BLOCKER for Phase 6 only. Mitigation: defer Phase 6 to v1.8.

### Infrastructure / Structural (address in phase planning)
3. **NUB-CLASS pre-assignment race (C-01)** — Synchronous resolution in `onNip5dIframeCreate` is the fix; Phase 2 first requirement.
4. **NUB-RESOURCE × NUB-CONNECT coupling (H-03)** — Factory signature must include `getConnectGrants` from day one; HIGH recovery cost if retrofitted.
5. **CSP revocation iframe reload (C-04)** — Hard requirement in Phase 3, not polish.
6. **Grants-to-middleware data flow (gap)** — Design decision required before Phase 3 implementation.

### Security / Protocol Correctness (validate in E2E)
7. **Cross-NUB class invariant regression (C-02)** — `enforce.ts` gate; Layer-B spec across all 9+ domains.
8. **Meta-CSP in napplet dist (C-03)** — CI audit script (`pnpm audit:csp`) is Phase 3 success criterion.
9. **CSP header in preview mode (C-05)** — `configurePreviewServer` required; E2E must assert preview mode.
10. **NIP-44 decrypt broadcast routing (C-06)** — Never `getAllWindowIds()` for decrypt; single-target routing with E2E isolation spec.

### Polish / Cleanup (Phase 5)
11. **@kehto/nip66 resource leak (M-03)** — Add `stop()` to aggregator before wiring demo.
12. **HostCacheBridge additive alias (M-02)** — Preserve `CacheServiceOptions`; changeset=patch.
13. **@kehto/wm over-prescription (H-04)** — No algorithm-specific types; file under ~200 lines.

---

## Sources

**Primary (HIGH confidence):** Local napplet specs (`SHELL-CLASS-POLICY.md`, `SHELL-CONNECT-POLICY.md`, `SHELL-RESOURCE-POLICY.md`), napplet NUB source type files, npm registry verification, GitHub API for upstream source state, installed nostr-tools `.d.ts`, kehto source code (`packages/acl/`, `packages/runtime/`, `packages/shell/`, `packages/services/`, `packages/wm/`, `apps/demo/`)

**Secondary (MEDIUM confidence):** W3C CSP Level 2 spec; MDN CSP documentation (meta-CSP behavioral differences)

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*
