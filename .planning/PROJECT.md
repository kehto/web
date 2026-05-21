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

**Shipped:** v1.8 — Upstream Alignment & NIP-44 Decrypt (2026-05-21)

v1.8 completes the upstream-alignment and decrypt milestone. Kehto now consumes `@napplet/nub@^0.3.0` / `@napplet/core@^0.3.0`, no longer carries the SEED-001 pnpm override, and ships canonical `identity.decrypt` across ACL, runtime, services, shell playground wiring, demo napplet, and E2E coverage.

The final verification baseline is 543 unit tests and 86 Playwright E2E tests passing.

### Latest Milestone Accomplishments

- **Carryover cleanup:** topology connector lines, resource-demo label, SessionEntry provenance rename, and identity-topic soft rename all shipped.
- **Upstream alignment:** dependency bump to `@napplet/nub@^0.3.0` / `@napplet/core@^0.3.0`; override retired; SEED-001 resolved.
- **Internal type correction:** class/connect/resource shell-side models renamed to `internal-*` after upstream concept divergence was verified.
- **Decrypt surface:** `identity.decrypt` works for NIP-04, NIP-44 direct, and NIP-17 gift-wrap with 8 typed errors and class-2 pre-decrypt rejection.
- **Demo and coverage:** `decrypt-demo` is the 13th playground napplet; Layer-A and Layer-B specs lock happy paths, error paths, class-2 denial, and single-target response isolation.

27/27 v1.8 requirements satisfied; 5/5 phase VERIFICATION.md files passed; 12/12 integration paths wired; 0 critical gaps.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity), v1.4 (productionization), v1.5 (demo stability), v1.6 (downstream unblock), v1.7 (spec adoption + 2 new domains), v1.8 (upstream alignment + decrypt).

### Previously Shipped

<details>
<summary>v1.6 — Downstream Unblock & Shell Service Surface (2026-04-23)</summary>

v1.6 unblocked hyprgate v2.0 by closing 6 of 8 Kehto Migration gap-analysis issues (kehto#2, #3, #4, #5, #8 + v1.5-carryover PERF-01) and shipping two new publishable packages. Baseline rose from 53 → 54 E2E specs; turbo grew 22 → 24 build tasks (+@kehto/nip66, +@kehto/wm).

- **Dependency consolidation (DEP-01..05)**: all 4 `@kehto/*` packages migrated from 8 split `@napplet/nub-*` peer deps → consolidated `@napplet/nub@^0.2.1` subpath imports. Dual-instance pitfall structurally eliminated in kehto importer blocks. 4 minor-bump changesets staged. Added `pnpm.overrides @napplet/nub>@napplet/core: ^0.2.1` as workaround for upstream publish-time workspace-specifier bug (SEED-001; self-retires on fix).
- **Reserved chord surface (KEYS-04..06 + E2E-17)**: `createKeysService` accepts a `reservedChords?: ReadonlyArray<string>` option; reservation gates at 3 dispatch sites (Branch A/B `keys.forward` + Branch B document keydown); precedence contract `reserved > registered` locked by `tests/e2e/reserved-chord.spec.ts`. Keys README H2 extended with WM-launcher `@example`. `KEYS_SERVICE_VERSION` bumped 1.1.0 → 1.2.0.
- **`@kehto/nip66@0.1.0` (NIP66-01..05)**: new publishable package. Framework-agnostic `createNip66Aggregator` factory + pluggable `Nip66RelayPool` interface + closure-scoped state (multi-instance safe). `nostr-tools` as sole peer dep; zero `@napplet/*` footprint. 194-line README with SimplePool + ShellAdapter wiring example. Publish-only (no demo wiring; deferred to v1.7+).
- **`@kehto/wm@0.0.0` skeleton (WM-01..03)**: PR #7 squash-merged with dskvr authorship preserved. Generic WM type vocabulary + throwing `createWmService` factory stub. Implementation deferred to v1.7+.
- **README cleanup (DOCS-04..05)**: Dropped stale `@napplet/core not yet on npm` + `pnpm.overrides link:` claim (false since v1.4). Packages table extended with nip66 + wm rows. Quick-Integration Example verified against current dep surface via root `pnpm type-check`.
- **PERF-01 rescoped (AUTH deprecation cleanup)**: Audit revealed the v1.5 "18+ serial storage.get round-trips" claim inaccurate for current code. Real pattern: 7 vestigial `storage.getItem('<slug>-auth-probe')` calls across 7 napplets, surviving as dead code after v1.2+ removed AUTH protocol. Deleted all 7 probes + scrubbed D-04 / "shim AUTH completion" comment prose across 10 napplets + 6 E2E specs. Outbound-only napplets (composer/theme-switcher/toaster) replaced probe with semantically honest `await identity.getPublicKey()` AUTH-trigger call.
- **E2E baseline 54/0/0 preserved** through all of v1.6: Phase 33 added `reserved-chord.spec.ts` (53 → 54); Phases 34/35/36 all closed with identical 54/0/0 iteration loops.

21/21 requirements satisfied; 5/5 phase VERIFICATION.md passed; 12/12 cross-phase integration paths wired; 0 critical gaps.

</details>

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity), v1.4 (productionization), v1.5 (demo stability), v1.6 (downstream unblock), v1.7 (spec adoption + 2 new domains).

## Known Tech Debt (carried into next milestone)

- **RENAME-02 soft-rename window (v1.8 → v1.9)** — `bridge.injectEvent('auth:identity-changed', …)` dual-emits both `'auth:identity-changed'` and `'identity:changed'` for one release (Plan 42-04). Hard-remove in v1.9; the deletion sweep can locate the branch by grepping for `remove this branch in v1.9` in `packages/shell/src/shell-bridge.ts`. Subscribers should migrate to `'identity:changed'` before v1.9.
- **`@napplet/sdk` migration deferred (v1.9)** — 18 napplet `main.ts` files (12 demo + 6 fixtures) import namespace objects (`ipc`, `storage`, `relay`, `identity`, `keys`, `config`, `notify`) from `@napplet/sdk`. Upstream `@napplet/sdk@0.3.0` removed those namespace exports in favor of individual function exports (`ifcEmit`, `storageGetItem`, `relaySubscribe`, etc.). Phase 44 deliberately pinned the 18 packages at `@napplet/sdk@^0.2.1` to avoid scope creep — migrating all 18 napplets to the new function-based API is its own v1.9 phase. Note: `@napplet/sdk@0.2.1` depends on the legacy split-form `@napplet/nub-*` packages, which still resolve on npm (verified at the time of Phase 44).
- **Shell internal type adoption follow-up (v1.9+)** — Phase 44 reclassified `internal-{class,connect,resource}.ts` as kehto shell-side models after upstream `@napplet/nub@0.3.0` proved concept/shape divergence. Any future adoption of upstream resource/connect/class surfaces is a distinct migration, not a mechanical import swap.
- **Electron / Tauri host-bridge reference impls** — HostKeysBridge + HostMediaBridge + HostCacheBridge interfaces defined (v1.4 + v1.7); reference impls deferred.
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
| 23 | Synchronous class-posture resolution in `onNip5dIframeCreate` (no async `class.assigned` envelope) | PITFALLS.md C-01: async `class.assigned` creates a 200-500ms race window where class-restricted NUB requests evaluate under permissive default. Fix: class stored on session entry before `shell.init` emission; `shell.init` carries resolved class inline. Breaking API change to `onNip5dIframeCreate` return type (minor bump @kehto/shell). | 2026-04-24 |
| 24 | Class enforcement centralized in `packages/runtime/src/enforce.ts` only | C-02 prevention: per-handler class checks fragment the invariant and drift silently. `CLASS_CAPABILITY_ALLOWLIST` + class-before-capability check (D6) + `EnforceResult.reason` field kept in enforce.ts; no NUB handler receives class parameter. Layer-B `class-invariant.spec.ts` locks the invariant across all 10 active NUB domains. | 2026-04-24 |
| 25 | Shell is HTTP-header authority for napplet CSP (dev + preview); production is host-app reverse-proxy responsibility | Canonical NUB-CONNECT forbids meta-CSP (CI-enforced via `pnpm audit:csp`). Dev/preview handled via Vite `configureServer` + `configurePreviewServer` plugin (C-05 prevention) with `POST /__connect-grants` sync endpoint. Production reverse-proxy middleware is documented in SHELL-CONNECT-POLICY.md as host-app concern — kehto does not ship production middleware. | 2026-04-24 |
| 26 | Grant revocation triggers iframe destroy+recreate (not header mutation) | C-04: sent HTTP response headers cannot be mutated; revoke path destroys the iframe DOM element and recreates it so the new fetch picks up the updated CSP header from the Vite plugin's current grants Map. `shell:connect-revoked` CustomEvent is the signal. Phase 39-05 Dev 2 caught an infinite-loop bug — mitigation: snapshot `[...napps.entries()]` before mutation. | 2026-04-24 |
| 27 | NUB-CONFIG scope boundary: napplet reads, shell writes — NO `config.set` wire message | CONFIG-04: prevents overlap with NUB-STORAGE (the general KV surface). Shell owns writes via `publishValues(values)` host handle on the `createConfigService` factory return. Napplets exercise `config.get` + `config.subscribe` (8-message wire protocol, no writes). | 2026-04-24 |
| 28 | `createResourceService` factory REQUIRES `getConnectGrants` at construction | H-03 prevention: factory throws if `getConnectGrants` is missing. Makes the NUB-CONNECT → NUB-RESOURCE coupling explicit at construction, not emergent at runtime. High retrofit cost if omitted. | 2026-04-24 |
| 29 | Provisional local type files as staging ground for unpublished NUB domains | Research STACK.md: `@napplet/nub/class`, `/connect`, `/resource` not yet published on npm (`@napplet/nub@0.2.1` ships config only). Strategy: `packages/shell/src/types/provisional-{class,connect,resource}.ts` with `// provisional` + `TODO: swap import to @napplet/nub/<domain> when published at <version>` annotations. Single atomic bump at milestone close once upstream ships all three. | 2026-04-24 |
| 30 | Soft-gate policy for upstream-dependent requirements | v1.7 Phase 42 (DECRYPT) explicitly soft-gated on napplet/napplet#3. At Phase 41 close, evaluated upstream status (OPEN, 0 comments) → deferred to v1.8 with zero impact on shipped phases. Pattern codifies how kehto handles upstream-blocking work without stalling the whole milestone. | 2026-04-24 |
| 31 | Kehto's class/connect/resource "provisional" types are intentional shell-internal models, not staging-ground duplicates of upstream | Phase 44 audit (against published `@napplet/nub@0.3.0`): all three upstream domains diverge from kehto's provisional shapes. `NappletClass` upstream is a napplet-side accessor `{ class: number\|undefined }`; kehto's is a shell-side token type `string\|null` with `'class-1'`/`'class-2'`. `NappletConnect` upstream is the napplet accessor `{ granted, origins }`; kehto's provisional captures shell-side grant-store types (`ConnectGrant`, `ConsentResult`). Resource diverges in field names (`requestId`→`id`, `bodyBase64`→`blob`+`mime`), message-type names (`ResourceBytesRequest`→`ResourceBytesMessage`), AND error vocabularies (kehto: 5 codes; upstream: 8 disjoint codes). The v1.7 "provisional pending upstream publish" framing was a misnomer — these are kehto-internal types. Pattern: rename/relabel all three away from `provisional-`; future upstream-surface adoption is its own phase. | 2026-05-21 |
| 32 | Upstream `normalizeConnectOrigin` is canonical origin-validator; no local kehto implementation to migrate | Phase 44 VALIDATOR-01 audit: zero matches for `normalizeConnectOrigin` across `packages/` and `apps/`. Upstream `@napplet/nub/connect` ships the canonical implementation (21 rules, 28 smoke tests, pure function). Any future kehto origin-validation work consumes the upstream validator directly — no local divergence. | 2026-05-21 |

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
*Last updated: 2026-05-20 — v1.8 milestone started (Upstream Alignment & NIP-44 Decrypt: 8 target features; awaiting `@napplet/nub@0.3.0` publish for items 6–8)*
