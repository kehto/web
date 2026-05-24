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
| @kehto/nip66 | `packages/nip66` | Relay-discovery aggregation utility |
| @kehto/wm | `packages/wm` | Structural window-management contracts |
| @kehto/playground | `apps/playground` | Public 13-napplet integration demo and verification surface |

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

**Status:** Planning v1.16 Structural Code Quality Refactor.

v1.15 restored the local quality gate from the `aislop 0.9.3` report: formatting, linting, AI Slop, and security now report 0 issues. The remaining scanner output is structural code-quality debt only: 10 long functions, 3 large files, and 3 deep-nesting findings.

The baseline after v1.15 is pinned-spec NIP-5D conformance, a buildable docs site, a pre-deploy GitHub Pages artifact contract for `https://kehto.github.io/web/`, and a local scanner result of `64 / 100 Needs Work` with 0 errors, 16 warnings, and 0 fixable findings. Verification stands at `npx --no-install aislop scan -d`, `pnpm build`, `pnpm type-check`, `pnpm test:unit` (563 tests), `pnpm --dir docs docs:build`, and `git diff --check`. The new v1.16 focus is behavior-preserving structural refactor work to remove those 16 remaining warnings.

## Current Milestone: v1.16 Structural Code Quality Refactor

**Goal:** Eliminate the remaining 16 `aislop` structural code-quality warnings without changing Kehto runtime behavior.

**Target features:**
- Split or extract the 10 functions currently over the configured 150-line threshold.
- Split the 3 files currently over the configured 700-line threshold: `apps/playground/src/main.ts`, `apps/playground/src/shell-host.ts`, and `packages/runtime/src/runtime.ts`.
- Reduce the 3 deep-nesting findings in `bootShell`, `createRuntime`, and `handleRelayMessage`.
- Keep Formatting, Linting, AI Slop, and Security at 0 issues throughout the refactor.
- Preserve runtime, service, playground, and docs behavior through focused tests plus full build/type/unit verification.

## Latest Milestone: v1.15 Address AI Slop

**Goal:** Restore a credible quality-gate baseline by fixing AI-slop/security findings and reducing the corrected local scanner from Critical to Needs Work without changing Kehto runtime behavior.

**Shipped features:**
- Corrected the stale `@napplet/services` import path and removed direct playground DOM assignment sinks.
- Removed auto-fixable slop: decorative comments, duplicate imports, leftover console debugging, unused code, and unnecessary spread fallbacks.
- Narrowed safe type and wrapper findings without changing public contracts.
- Resolved dependency scanner advisories through existing `pnpm.overrides`.
- Added repo-local `.aislop/config.yml` so the local scanner policy is explicit.
- Reduced `npx --no-install aislop scan -d` to `64 / 100 Needs Work`, with Formatting, Linting, AI Slop, and Security all clean.

### Latest Milestone Accomplishments

- **Fatal scanner repair:** AI Slop and Security error categories are closed; the corrected local scanner path is `npx --no-install aislop`.
- **Safe DOM cleanup:** report-flagged direct `innerHTML` assignments were replaced with DOM construction, `textContent`, `replaceChildren`, or named trusted internal insertion.
- **Mechanical source cleanup:** normal `aislop fix` removed hundreds of narrative/trivial comment and import/code hygiene findings.
- **Type and duplication cleanup:** low-risk duplicate blocks, thin wrappers, and narrowable assertions were cleaned without broad module rewrites.
- **Dependency scanner cleanup:** existing dependency overrides resolve the Vite/esbuild/PostCSS/brace-expansion security scanner paths.
- **Verification:** local scanner, build, type-check, unit tests, docs build, and diff checks are green enough to make the remaining risk structural only.

20/20 v1.15 requirements satisfied; 5/5 phase VERIFICATION.md files passed; local `aislop` no longer reports Critical status.

## Previous Milestone: v1.14 GitHub Pages Web Portal

**Goal:** Turn the GitHub Pages deployment into a public `/web/` portal that links to the playground and docs, with the playground deployed at `/web/playground/` and VitePress docs deployed at `/web/docs/`.

**Shipped features:**
- A static Kehto slash page at `kehto.github.io/web/` with clear links to playground and docs.
- Playground build and static gateway artifact deployment moved under `kehto.github.io/web/playground/`.
- Docs build deployed under `kehto.github.io/web/docs/`.
- GitHub Pages workflow packs one unified artifact and verifies the expected portal, playground, and docs routes.

### v1.14 Accomplishments

- **Static portal:** `web/index.html` builds to `.pages/web/index.html` and links users to `/web/playground/` and `/web/docs/`.
- **Playground route relocation:** playground assets and static gateway metadata now use `/web/playground/`, including all 13 napplet gateway `htmlUrl` values under `/web/playground/napplet-gateway/`.
- **Docs publication:** VitePress builds with `VITEPRESS_BASE=/web/docs/`, docs output is copied into `.pages/web/docs`, and generated API reference files publish under `.pages/web/docs/api`.
- **Unified Pages deploy gate:** the GitHub Actions Pages workflow runs docs checks, builds one `.pages` artifact, audits portal/playground/docs/gateway routes, and uploads that artifact to Pages.
- **Cache correctness:** `turbo.json` includes `VITEPRESS_BASE` for `docs:build`, preventing stale cached docs assets with the wrong public base path.
- **Verification:** route-shape, docs, build, type, unit, gateway, diff, and open-artifact gates are green.

13/13 v1.14 requirements satisfied; 3/3 phase VERIFICATION.md files passed; 4/4 integration paths wired; 0 critical gaps.

## Previous Milestone: v1.13 Documentation Strategy & Monorepo Docs Site

**Goal:** Turn Kehto's shipped runtime packages into a coherent public documentation system: content strategy, package docs, implementation tutorials, runtime/site guides, reference docs, and how-tos.

**Shipped features:**
- Content strategy and docs information architecture for the whole monorepo.
- Package-by-package documentation for `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services`, `@kehto/nip66`, `@kehto/wm`, and `@kehto/playground`.
- VitePress documentation site covering reference docs, tutorials, guides, how-tos, and tips.
- Implementer tutorials for building with Kehto packages and creating a runtime host.
- Monorepo docs workflows that keep TypeDoc/API reference, package README content, and site navigation aligned.

Deferred candidates remain host bridge reference implementations, multi-OS CI matrix expansion, a public gateway product, CI/release packaging, and package publication.

### v1.13 Accomplishments

- **Docs IA:** reader personas, documentation jobs, taxonomy, archive boundaries, source-of-truth rules, and site navigation are documented.
- **Package docs:** every public package plus playground has consistent purpose/install/API/scope documentation grounded in manifests and public barrels.
- **Tutorials and how-tos:** host-shell, runtime implementation, napplet integration, common host tasks, troubleshooting, and docs-site maintenance paths are documented.
- **VitePress site:** `@kehto/docs` owns local dev/build/preview scripts, navigation/sidebar, concepts, reference pages, policy index, and migration archive entry points.
- **Generated API integration:** TypeDoc covers all six public packages and package docs link to generated module pages.
- **Docs gates:** `pnpm docs:check` runs strict TypeDoc, VitePress build, package/API route audit, and CI wiring checks.
- **Full verification:** docs/build/type/unit/static gates are green at 27/27 build tasks, 11/11 type-check tasks, 562 unit tests, 13 CSP-scanned napplets, and 13 gateway artifacts.

28/28 v1.13 requirements satisfied; 5/5 phase VERIFICATION.md files passed; 5/5 integration paths wired; 0 critical gaps.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity), v1.4 (productionization), v1.5 (demo stability), v1.6 (downstream unblock), v1.7 (spec adoption + 2 new domains), v1.8 (upstream alignment + decrypt), v1.9 (SDK migration), v1.10 (compatibility cleanup + decrypt-demo parity), v1.11 (gateway artifact parity), v1.12 (NIP-5D contract conformance), v1.13 (docs site and docs gates), v1.14 (GitHub Pages web portal), v1.15 (quality-gate cleanup).

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

## Known Tech Debt (carried forward)

- **Shell internal type adoption follow-up** — Phase 44 reclassified `internal-{class,connect,resource}.ts` as kehto shell-side models after upstream `@napplet/nub@0.3.0` proved concept/shape divergence. Any future adoption of upstream resource/connect/class surfaces is a distinct migration, not a mechanical import swap.
- **Electron / Tauri host-bridge reference impls** — HostKeysBridge + HostMediaBridge + HostCacheBridge interfaces defined (v1.4 + v1.7); reference impls deferred.
- **Multi-OS CI matrix** — still ubuntu-latest only. Carryover from v1.4.
- **Live Pages smoke** — v1.14 verifies the local and CI Pages artifact shape before upload; browser smoke against `https://kehto.github.io/web/` remains a post-push/deployment follow-up.
- **Decrypt-demo fixture pending repair** — Backlog 999.1 remains valid and intentionally separate from the static publication route milestone.
- **Lint task surface** — `pnpm lint` succeeds but turbo currently reports no configured package lint tasks; type-check, unit tests, E2E, and static guards carry verification.
- **Structural scanner warnings** — v1.16 targets the remaining 16 `aislop` code-quality warnings: 10 long functions, 3 large files, and 3 deep-nesting findings.

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Separate repo (not monorepo subfolder) | Independent release cadence, different maintainers possible | 2026-04-06 |
| 2 | @napplet/core as peer dep | Core types shared; @napplet publishes, @kehto consumes | 2026-04-06 |
| 3 | Mirror @napplet tooling exactly | Consistency, easy contributor onboarding | 2026-04-06 |
| 4 | Canonical NIP-5D source is pinned raw `dskvr/nips` commit `d80d7b25f9c4331acbeb40dbeb3b077caa80e885` | Single authoritative spec for v1.12; moving branch heads, `RUNTIME-SPEC.md`, and `napplet/specs/NIP-5D.md` are not authority for this milestone | 2026-05-22 |
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
| 33 | Identity-topic compatibility removal stays in v1, not v2 | User explicitly scoped v1.10 as a v1 cleanup/continuity release. The deprecated `auth:identity-changed` compatibility branch was removed after its v1.8/v1.9 window, while the literal deprecated topic remains a generic injected event if host code still emits it. | 2026-05-22 |
| 34 | Helper-only demo guards are separate from SDK migration guards | `decrypt-demo` intentionally has no `@napplet/sdk` dependency, so v1.10 split guard coverage into SDK-bearing targets and helper-graph targets. This keeps exact `0.3.0` helper enforcement without inventing a fake SDK dependency. | 2026-05-22 |
| 35 | Local playground loading must match the production NIP-5D/NIP-5A gateway path | NIP-5D requires opaque-origin sandboxed iframes, and local verification is only meaningful if it exercises the same artifact shape production gateways serve. A separate dev convenience path would break continuity between development and production. | 2026-05-22 |
| 36 | `.planning/NIP-5D-DELTA-AUDIT.md` is the v1.12 delta inventory | The audit already compares the pinned NIP-5D contract to current shell/runtime/napplet behavior; milestone planning should use it instead of rediscovering drift. | 2026-05-22 |
| 37 | Public GitHub Pages contract is `/web/`, not repository-name-derived | v1.14 publishes the portal, playground, docs, assets, and gateway metadata under the explicit requested path contract. `github.event.repository.name` must not drive the public playground base path for this deployment. | 2026-05-23 |
| 38 | VitePress public base is a build cache input | `VITEPRESS_BASE=/web/docs/` changes generated asset URLs, so `turbo.json` includes it in `docs:build` env to prevent cached docs output from reusing an old base path. | 2026-05-23 |

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
*Last updated: 2026-05-24 — v1.16 milestone started (Structural Code Quality Refactor)*
