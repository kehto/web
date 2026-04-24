# Project: Kehto Runtime

**Kehto** is the runtime half of the napplet protocol ecosystem. It provides the shell-side packages that host sandboxed Nostr iframe applications: protocol engine, ACL enforcement, service handlers, and browser adapter.

## Core Value

Provide a modular, framework-agnostic runtime for hosting napplet applications — so any Nostr client can embed sandboxed mini-apps by integrating @kehto/shell.

## Packages

| Package | Scope | Description |
|---------|-------|-------------|
| @kehto/acl | `packages/acl` | Pure ACL module — zero deps, WASM-ready capability enforcement |
| @kehto/runtime | `packages/runtime` | Protocol engine — message dispatch, AUTH, subscriptions, ACL gates |
| @kehto/shell | `packages/shell` | Browser adapter — ShellBridge, signer proxy, storage proxy, audio |
| @kehto/services | `packages/services` | Reference service handlers — audio, notifications, extensible |

## Constraints

- **ESM-only**: No CJS output
- **Zero framework deps**: Framework-agnostic (no Svelte, React, Vue)
- **@napplet/core peer dep**: All packages depend on @napplet/core for protocol types
- **nostr-tools peer dep**: Shell depends on nostr-tools >=2.23.3 <3.0.0
- **Monorepo tooling**: pnpm workspaces + turborepo + tsup + changesets

## Relationship to @napplet

This repo was extracted from the [@napplet monorepo](https://github.com/sandwichfarm/napplet) during the v0.13.0 Runtime Decoupling milestone. The split:

- **@napplet** (github.com/sandwichfarm/napplet): Portable SDK — core, shim, sdk, vite-plugin
- **@kehto** (github.com/kehto/runtime): Runtime implementation — acl, runtime, shell, services

@napplet/core is the shared foundation. It lives in @napplet and is consumed by @kehto as a peer dependency.

## Current State

**Shipped:** v1.6 — Downstream Unblock & Shell Service Surface (2026-04-23)

v1.6 unblocked hyprgate v2.0 by closing 6 of 8 Kehto Migration gap-analysis issues (kehto#2, #3, #4, #5, #8 + v1.5-carryover PERF-01) and shipping two new publishable packages. Baseline rose from 53 → 54 E2E specs; turbo grew 22 → 24 build tasks (+@kehto/nip66, +@kehto/wm).

- **Dependency consolidation (DEP-01..05)**: all 4 `@kehto/*` packages migrated from 8 split `@napplet/nub-*` peer deps → consolidated `@napplet/nub@^0.2.1` subpath imports. Dual-instance pitfall structurally eliminated in kehto importer blocks. 4 minor-bump changesets staged. Added `pnpm.overrides @napplet/nub>@napplet/core: ^0.2.1` as workaround for upstream publish-time workspace-specifier bug (SEED-001; self-retires on fix).
- **Reserved chord surface (KEYS-04..06 + E2E-17)**: `createKeysService` accepts a `reservedChords?: ReadonlyArray<string>` option; reservation gates at 3 dispatch sites (Branch A/B `keys.forward` + Branch B document keydown); precedence contract `reserved > registered` locked by `tests/e2e/reserved-chord.spec.ts`. Keys README H2 extended with WM-launcher `@example`. `KEYS_SERVICE_VERSION` bumped 1.1.0 → 1.2.0.
- **`@kehto/nip66@0.1.0` (NIP66-01..05)**: new publishable package. Framework-agnostic `createNip66Aggregator` factory + pluggable `Nip66RelayPool` interface + closure-scoped state (multi-instance safe). `nostr-tools` as sole peer dep; zero `@napplet/*` footprint. 194-line README with SimplePool + ShellAdapter wiring example. Publish-only (no demo wiring; deferred to v1.7+).
- **`@kehto/wm@0.0.0` skeleton (WM-01..03)**: PR #7 squash-merged with dskvr authorship preserved. Generic WM type vocabulary + throwing `createWmService` factory stub. Implementation deferred to v1.7+.
- **README cleanup (DOCS-04..05)**: Dropped stale `@napplet/core not yet on npm` + `pnpm.overrides link:` claim (false since v1.4). Packages table extended with nip66 + wm rows. Quick-Integration Example verified against current dep surface via root `pnpm type-check`.
- **PERF-01 rescoped (AUTH deprecation cleanup)**: Audit revealed the v1.5 "18+ serial storage.get round-trips" claim inaccurate for current code. Real pattern: 7 vestigial `storage.getItem('<slug>-auth-probe')` calls across 7 napplets, surviving as dead code after v1.2+ removed AUTH protocol. Deleted all 7 probes + scrubbed D-04 / "shim AUTH completion" comment prose across 10 napplets + 6 E2E specs. Outbound-only napplets (composer/theme-switcher/toaster) replaced probe with semantically honest `await identity.getPublicKey()` AUTH-trigger call.
- **E2E baseline 54/0/0 preserved** through all of v1.6: Phase 33 added `reserved-chord.spec.ts` (53 → 54); Phases 34/35/36 all closed with identical 54/0/0 iteration loops.

21/21 requirements satisfied; 5/5 phase VERIFICATION.md passed; 12/12 cross-phase integration paths wired; 0 critical gaps.

**Mid-milestone scope changes (documented in v1.6-MILESTONE-AUDIT.md):**
- **CACHE-01..05 dropped**: Phase 33 scoping revealed `createCacheService`'s existing `CacheServiceOptions` object IS the hostBridge injection hyprgate#1 asked for. Commented on kehto#1 with integration example; issue remains open as kehto-side tracker for optional v1.7+ cosmetic polish. Phases renumbered 34-37 → 33-36.
- **PERF-01 rescoped**: see above.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity), v1.4 (productionization), v1.5 (demo stability), v1.6 (downstream unblock).

## Current Milestone: v1.7 NIP-5D Spec Adoption & New NUB Domains

**Goal:** Resync canonical NIP-5D, adopt envelope-level NUB-CLASS + NUB-CONNECT with their shell-authority policy gates, and ship reference services for the two new NUB domains (CONFIG / RESOURCE) — bringing kehto's NUB surface from 8 → 10 domains.

**Target features — spine (spec-driven):**

- **SPEC resync** — re-copy `specs/NIP-5D.md` from `dskvr/nips` branch `nip/5d` (class-posture delegation ¶ is prerequisite for NUB-CLASS)
- **NUB-CLASS adoption** — shell emits `class.assigned` envelope after shim bootstrap; ACL + dispatch honor class posture; Layer-B cross-NUB invariant spec
- **NUB-CONNECT adoption** — per-napplet CSP `connect-src` emission, consent flow, residual meta-CSP refuse-to-serve scan, grants keyed on `(dTag, aggregateHash)`, SHELL-CONNECT-POLICY.md audit checklist. Requires shell to become HTTP-header authority (new infrastructure).
- **NUB-CONFIG reference service** — new 9th NUB domain; handler in `@kehto/services`; demo napplet; Layer-A + Layer-B coverage
- **NUB-RESOURCE reference service** — new 10th NUB domain; handler in `@kehto/services`; demo napplet; Layer-A + Layer-B coverage

**Target features — carryover / opportunistic:**

- **`@kehto/nip66` demo wiring** — NIP66-05 follow-up; ShellAdapter `getNip66Suggestions()` goes live against `createNip66Aggregator` + SimplePool in demo
- **`@kehto/wm` abstractions** — structural primitives / base classes / abstract interfaces consumers implement to wire up their own layouts. No concrete layout algorithms shipped.
- **CACHE polish (kehto#1)** — `HostCacheBridge` type alias + optional default for `createCacheService`; naming parity with HostKeysBridge / HostMediaBridge pattern
- **Shell NIP-44 decrypt (kehto#9)** — **soft-gated**: ship if napplet/napplet#3 unblocks during milestone; slip to v1.8 if not

**Key context:**

- NUB-CLASS + NUB-CONNECT require **new shell HTTP-header authority** (not just postMessage). Real infrastructure work, not paper adoption.
- All 4 new NUB domains (CLASS, CONNECT, CONFIG, RESOURCE) depend on canonical NUB spec availability in `@napplet/nub`. Upstream NUB publish state must be verified before locking phase plans.
- Phase numbering continues from 36 → **Phase 37 onwards**.
- E2E baseline to preserve: **54/0/0** (v1.6 close). Baseline expected to grow with 2 new demo napplets (config, resource) + NUB-CLASS invariant spec + NUB-CONNECT consent/CSP spec.

**Explicitly out of scope (deferred to v1.8+):**

- Electron / Tauri HostXxxBridge reference impls (v1.4 carryover)
- Multi-OS CI matrix (v1.4 carryover)
- `identitySource: 'auth' | 'source'` type-discriminant rename (v1.6 carryover)
- `bridge.injectEvent('auth:identity-changed', ...)` rename (v1.6 carryover)
- `pnpm.overrides @napplet/nub>@napplet/core` workaround (SEED-001 — retires on upstream publish-fix, not milestone-driven)

## Known Tech Debt (carried into next milestone)

- **pnpm.overrides transitive pin** — `@napplet/nub>@napplet/core: ^0.2.1` workaround for upstream `@napplet/nub@0.2.1` publish-time workspace-specifier bug. Self-retires on upstream fix. SEED-001 tracks follow-up.
- **`@kehto/nip66` demo wiring** — NIP66-05 explicitly scoped v1.6 to publish-only. ShellAdapter `getNip66Suggestions()` hook exists; demo wires to `() => null`. Full wiring + NIP-77 negentropy support deferred to v1.7+.
- **`@kehto/wm` implementation** — v1.6 merged skeleton only. BSP / master-stack / floating layout primitives deferred; hyprgate runs its local impl meanwhile. Awaits a real consumer use case in kehto-land.
- **`identitySource: 'auth' \| 'source'` type discriminant** — live type in SessionEntry; rename out of PERF-01 scope. v1.7+.
- **`bridge.injectEvent('auth:identity-changed', ...)` shell hook** — live surface with external consumers. v1.7+ rename.
- **CACHE naming parity (kehto#1)** — `HostCacheBridge` type alias + optional default for `createCacheService`. Existing options already provide injection point functionally; cosmetic polish only. v1.7+.
- **Upstream NUB for receive-side NIP-44 decrypt (kehto#9)** — tracked at napplet/napplet#3. Shell impl lands once upstream picks between `relay.subscribeEncrypted` vs `identity.decrypt`.
- **Electron / Tauri host-bridge reference impls** — HostKeysBridge + HostMediaBridge interfaces defined (v1.4); HostCacheBridge conceptually scoped (v1.6 dropped). Reference impls deferred.
- **Multi-OS CI matrix** — still ubuntu-latest only. Carryover from v1.4.

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Separate repo (not monorepo subfolder) | Independent release cadence, different maintainers possible | 2026-04-06 |
| 2 | @napplet/core as peer dep | Core types shared; @napplet publishes, @kehto consumes | 2026-04-06 |
| 3 | Mirror @napplet tooling exactly | Consistency, easy contributor onboarding | 2026-04-06 |
| 4 | Canonical NIP-5D source is `dskvr/nips` branch `nip/5d` | Single authoritative spec — napplet/specs is no longer the source of truth | 2026-04-17 |
| 5 | Shell MUST NOT provide `window.nostr` | Canonical spec forbids napplet-visible signing; shell mediates all signing/encryption via `relay.publish`/`publishEncrypted` | 2026-04-17 |
| 6 | `createDispatch()` + `registerNub()` from @napplet/core replaces hand-rolled switch | Spec dispatch contract rather than kehto reimplementation; per-runtime instance avoids cross-test pollution | 2026-04-17 |
| 7 | Stub-level services for keys/media/notify (no real backends) | Host apps plug real backends via `runtime.registerService()`; kehto remains framework-agnostic reference | 2026-04-17 |
| 8 | v1.3 is consume-and-showcase (no protocol changes) | `@kehto/*` API surface frozen at v1.2; demo + napplets + Playwright prove the surface works for host-app consumers | 2026-04-18 |
| 9 | Delete legacy fixtures + specs rather than migrate | `auth-napplet`/`publish-napplet`/`pure-napplet` were NIP-01-shaped; migration would duplicate Layer-A `nub-*.spec.ts` coverage. Cleanliness > backward compat. | 2026-04-18 |
| 10 | E2E-11 iteration-loop discipline (build → run → Playwright → fix) | Phases don't close on `tsc`/`vitest` alone; forces real integrated evidence per phase. Closed capstone-style in Phase 22. | 2026-04-18 |
| 11 | `@napplet/core` dedup via `pnpm.overrides` at workspace root | Single `link:` instance across all `@kehto/*` packages; prevents Pitfall 3 (two core instances breaking dispatch identity). | 2026-04-18 |
| 12 | v1.4 removes stub-scope for keys + media; HostKeysBridge + HostMediaBridge define the host-app extension surface | Stubs blocked the "shippable" promise — host apps need real behavior + a contract for plugging native backends. Browser-default impls satisfy the interfaces; Electron/Tauri reference impls deferred. | 2026-04-19 |
| 13 | Harness `__registerService__('name', 'real')` factory-key for Layer-A specs | Real backends are not stubs — capturing outbound envelopes requires proxy hook, not `window.__last*` globals. Single new surface covers both `keys` + `media` domains. | 2026-04-19 |
| 14 | Silent-audio prime for `navigator.mediaSession` visibility | Browsers refuse to render OS media controls without an active audio element. A minimal silent-loop `<audio>` (data URL) keeps the MediaSession API surface visible. Shell does NOT own an AudioContext — napplets own their own `<audio>` elements. | 2026-04-19 |
| 15 | Per-napplet `window.__grant*__` host hooks for E2E capability gates | Playwright specs need deterministic capability grants without UI click-through. Scoped per-napplet (not generic). Pattern: `__grantKeysForward__`, `__grantMediaControl__`. | 2026-04-19 |
| 16 | Data-driven shell UI (all napplet rendering loops over DEMO_NAPPLETS, not hardcoded per-napplet blocks) | v1.5 UAT surfaced the "add 10th napplet" failure mode — hardcoded lists silently drift. Pattern: single source-of-truth (shell-host.ts:DEMO_NAPPLETS) + UI loops iterate it. Applies to status-text, activity counters, ACL rows, sequence-diagram lanes. | 2026-04-20 |
| 17 | Playwright MCP automated UAT replaces manual UAT within autonomous GSD flow | Phase 29 established the pattern — instead of pausing for human browser testing, Claude drives the demo via MCP Playwright tools, captures DOM evidence, classifies into decision buckets. Reduces autonomous-flow interruptions; works whenever the demo is browser-testable. | 2026-04-20 |
| 18 | Pluggable `HostXxxBridge` interface pattern extends to any shell-backend injection (Keys + Media v1.4, Cache-options-as-bridge realized v1.6) | Any kehto reference service that wraps a host-capability should expose its options object AS the bridge — downstream shells provide implementations without monkey-patching. Cache proved this retroactively; new services (v1.7+) follow the same shape by default. | 2026-04-23 |
| 19 | Mid-milestone audit-first rescopes for stale v1.5 tech-debt claims | v1.6 dropped CACHE-01..05 and rescoped PERF-01 after Phase 33/36 scoping revealed the v1.5 audit observations didn't match current code. Pattern: when a carryover item surfaces in planning, audit BEFORE executing to catch inherited inaccuracies. Documented in v1.6-MILESTONE-AUDIT.md. | 2026-04-23 |
| 20 | `@napplet/nub` subpath consolidation as canonical consumer pattern — `@napplet/nub-*` split form retired | Phase 32 migrated kehto entirely onto `@napplet/nub/<domain>` subpaths. Anti-term enforcement added for split form in @kehto/* source. Transitive residue from @napplet/sdk/shim in the lockfile packages section is accepted as out-of-scope upstream footprint. | 2026-04-23 |
| 21 | `/<domain>/sdk` subpath variant when `@napplet/shim` is loaded (not root `/<domain>`) | Root `/<domain>` subpath calls `registerNub(DOMAIN, ...)` at module-init — collides with shim's own registerNub. SDK consumers running WITHOUT shim can use root; consumers WITH shim must use `/sdk` subpath variant (pure re-exports, no side effects). Plan 32-02 Rule 1 discovery. | 2026-04-23 |
| 22 | Seeds mechanism for upstream-dependent follow-ups | SEED-001 planted for `@napplet/nub>@napplet/core` workspace-specifier publish bug. Seeds defer filing upstream issues until next relevant milestone verifies the bug persists. Prevents duplicate issues if upstream fixes in the meantime. | 2026-04-23 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 — Phase 41 complete (Polish Wave: @kehto/nip66 demo wiring live with 3 kind-30166 fixtures + stop() method; @kehto/wm ships LayoutStrategy primitives + no-op default replacing throwing stub; HostCacheBridge additive alias closes kehto#1; 72/0/0 E2E)*
