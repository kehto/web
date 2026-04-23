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

## Current Milestone: v1.6 Downstream Unblock & Shell Service Surface

**Goal:** Unblock hyprgate v2.0 by landing the kehto-side capability gaps it hit during its Kehto Migration gap analysis — extending the shell service surface (cache multi-tab, keys reserved chords, wm library skeleton), publishing `@kehto/nip66`, consolidating onto `@napplet/nub` subpath imports, and fixing stale README claims.

**Target features:**

- `createCacheService` + `HostCacheBridge` for multi-tab OPFS coordination (kehto#1)
- `@kehto/nip66` — new publishable package for kind-30166 relay discovery (kehto#2)
- `@kehto/wm` skeleton merged from PR #7 (kehto#3)
- Consolidate `@kehto/*` peer deps from split `@napplet/nub-*` → `@napplet/nub` subpath imports (kehto#4)
- Reserved chord-set surface on `createKeysService` for shell-absolute chords (kehto#8)
- README cleanup — drop stale `pnpm.overrides link:` pattern + "core not on npm" claim (kehto#5)
- PERF-01 (v1.5 carryover) — chat boot storage.get storm batch/parallelize

**Explicitly deferred to v1.7 (spec-alignment milestone):**

- NIP-5D re-sync (class-posture delegation paragraph from dskvr/nips nip/5d)
- NUB-CLASS adoption — shell emits `class.assigned` envelope
- NUB-CONNECT adoption — per-napplet CSP, consent flow, SHELL-*-POLICY audits
- NUB-CONFIG reference service (domain #9)
- NUB-RESOURCE reference service (domain #10)

**Tracking only / upstream-first:**

- kehto#6 (Vite 8 × @napplet/vite-plugin): tracking only; reopens if hyprgate regresses
- kehto#9 (receive-side NIP-44 decrypt): upstream-first; cross-linked to napplet/napplet#3; shell impl awaits NUB surface decision

## Current State

**Shipped:** v1.4 — Productionization & Upstream Unblock (2026-04-19)

v1.4 moved kehto from "demo-validated" to "shippable": CI/CD enforcement on every PR, `@kehto/*@0.2.0` published to npm, `DRIFT-CORE-06` compatibility shim deleted, and the last two stub services (`keys`, `media`) replaced with real backends. The demo now exercises 8 non-stub NUB domains end-to-end across 10 napplets; Playwright runs 49 specs fully green.

- **CI/CD**: 3 GitHub Actions workflows (build.yml, unit.yml, e2e.yml) gate every push/PR. release.yml staged for tag-triggered publishing.
- **Publication**: `@kehto/{acl,runtime,shell,services}@0.2.0` live on registry.npmjs.org. Smoke-tested via fresh `npm install`.
- **DRIFT-CORE-06 cleanup**: `packages/runtime/src/core-compat.ts` deleted. Live types re-homed (`Capability` → `@kehto/acl/capabilities`; `ServiceDescriptor` → `@kehto/runtime/types`; `REPLAY_WINDOW_SECONDS` inlined). Dead NIP-01 paths (`BusKind`, `AUTH_KIND`, `DESTRUCTIVE_KINDS`, `STATE_TOPICS`) purged from runtime + shell.
- **Real keys backend**: `createKeysService` ships a document-level chord listener + subscription registries + `keys.action` push. `HostKeysBridge` interface + hotkey-chord demo napplet + Layer-B E2E-12 spec.
- **Real media backend**: `createMediaService` mirrors metadata/playbackState to `navigator.mediaSession` + emits `media.command` pushes via action handlers. `HostMediaBridge` interface + `createBrowserMediaBridge()` factory + media-controller demo napplet + Layer-B E2E-13 (DUAL-PATH assertion: DOM sentinel + browser API read).
- **Layer-A upgrade**: `nub-keys.spec.ts` + `nub-media.spec.ts` rewritten in place to exercise real backends via `__registerService__('name', 'real')` harness factory-key.
- **Docs**: `packages/services/README.md` extended with Keys + Media H2 sections. `apps/demo/README.md` created with 10-napplet inventory + host-hook catalog.

20/20 requirements satisfied; 6/6 phase VERIFICATION.md passed; 18/18 cross-phase integration chains wired; 0 critical gaps.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity), v1.4 (productionization), v1.5 (demo stability).

**v1.5 (shipped 2026-04-20):** Demo Stability & UAT Coverage — all 5 correctness issues from post-v1.4 UAT closed with CI coverage; PERF-01 deferred to v1.6. 53/0/0 Playwright baseline (up from 49). Key fixes: data-driven refreshAclPanelsIfNeeded loop (10/10 napplets show AUTHENTICATED), service-level activity routing (6/8 services tick), aclAdapter.snapshot authenticated-gate (10 napplets in ACL Matrix), dynamic sequence-diagram lanes (11 lanes). Two new Layer-B specs lock the contracts.

## Known Tech Debt (carried into next milestone)

- **Phase 27 CI evidence** — Phase 27 commits on local main; push + CI workflow URL record deferred (pattern established in Phase 26). Local iteration loop 49/0/0 green; tracked in `milestones/v1.4-phases/27-real-media-backend/27-HUMAN-UAT.md`.
- **release.yml first-fire** — Workflow file committed after v0.2.0 tag. First real execution awaits next `v*` tag. Non-blocking.
- **Electron / Tauri host-bridge reference impls** — HostKeysBridge + HostMediaBridge interfaces defined; reference impls for native OS backends deferred past v1.4 per REQUIREMENTS.md Future Requirements.
- **Multi-OS CI matrix** — v1.4 runs on `ubuntu-latest` only. Cross-OS coverage deferred.

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
*Last updated: 2026-04-23 — v1.6 milestone started*
