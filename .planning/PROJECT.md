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

**Shipped:** v1.3 — Demo Functional & Playwright Parity (2026-04-18)

v1.3 was a consume-and-showcase milestone: no `@kehto/*` protocol changes. `apps/demo` and its 8 napplets (bot, chat, composer, preferences, toaster, feed, profile-viewer, theme-switcher) now exercise all 6 non-stub NUB domains end-to-end against canonical v1.2 APIs. The Playwright suite (47 specs, 26 active files) runs fully green on a fresh-build artifact with zero skipped tests.

- apps/demo: 8 napplets loaded; `createDemoHooks()` registers 5 reference services + 3 stub-only topology nodes; `getAclAdapter()` + `getMessageTap()` are the single seams for ACL/debugger wiring; node inspector renders per-role content; debugger taps NIP-5D envelope `type` strings live; zero `window.nostr` / `signer-service` / `BusKind` in demo source.
- apps/demo/napplets: all 8 napplets import from `@napplet/sdk` (no raw `window.addEventListener('message')` except 2 documented SDK-gap exemptions in toaster/preferences); composer exercises `relay.publish` + `relay.publishEncrypted`; preferences exercises `storage.*`; toaster exercises `notify.*`; feed exercises `relay.subscribe`; profile-viewer exercises `identity.*`; theme-switcher exercises host `publishTheme()` → `theme.changed` fan-out.
- tests/e2e: Layer-A (6 nub fixtures + 8 `nub-*.spec.ts` harness-driven specs) for runtime protocol correctness; Layer-B (18 domain/demo specs) for live demo behavior; 7 legacy fixtures + 7 legacy specs deleted per "cleanliness > backward compat"; full `pnpm clean && pnpm build && pnpm test:e2e` iteration loop recorded for E2E-11 closure.
- Docs: typedoc configured at root (`entryPointStrategy: packages`); 4 @kehto/* READMEs locked to canonical 7-section skeleton; root README + migration archive integrate apps/demo as the reference consumer.
- Release rehearsal: `publint` + `attw --profile esm-only` clean on all 4 @kehto/* packages; `pnpm changeset version` dry-run clean; 4 v1.3 `patch`-bump changesets staged at `.changeset/v1-3-{acl,runtime,shell,services}.md` with DEMO-/NAP-/E2E-/DOCS- citations. `changeset publish` deferred until `@napplet/core` publishes to npm.

37/37 requirements met; 47/47 phase must-haves verified; 7/7 cross-phase wiring checks passed; 0 gaps.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage), v1.3 (demo + Playwright parity).

## Current Milestone: v1.4 Productionization & Upstream Unblock

**Goal:** Move kehto from "demo-validated" to "shippable" — add CI/CD enforcement, publish to npm once `@napplet/core` lands upstream, remove the `DRIFT-CORE-06` compatibility shim, and replace stub `keys` / `media` services with real backends.

**Target features:**
- **CI/CD** — GitHub Actions for build + type-check + unit tests + Playwright on push and PR; release workflow gated on changeset version bumps.
- **Release publication** — execute `pnpm changeset publish` for staged v1.2 + v1.3 changesets once `@napplet/core` is on npm; verify published artifacts install clean from npm registry.
- **`DRIFT-CORE-06` removal** — delete `packages/runtime/src/core-compat.ts` and update all consumers to import directly from `@napplet/core` once upstream restores legacy exports.
- **Real `keys` backend** — replace stub `keys-service` with a real implementation; ship `hotkey-chord` napplet exercising it end-to-end.
- **Real `media` backend** — replace stub `media-service` with a real implementation; ship `media-controller` napplet exercising it end-to-end.
- **Doc polish** — refresh 2 JSDoc `@example` blocks in `tests/e2e/harness/harness.ts:10` + `tests/e2e/helpers/wait-for-napplet-ready.ts:21` (still cite deleted `auth-napplet`).

**Key context:**
- Themes 2 + 3 (`changeset publish` + `DRIFT-CORE-06`) depend on **upstream `@napplet/core` npm publication**; if upstream slips, those phases block until unblocked.
- Theme 4 + 5 (`keys` / `media` backends) need design discussion — kehto stays framework-agnostic, so "real backend" means defining what host-app integration looks like (hotkey daemon? OS APIs? Web Audio? MediaSession?). Design questions resolved at phase-discuss time.
- v1.4 phase numbering continues from Phase 22 → starts at **Phase 23**.

## Known Tech Debt (carried into next milestone)

- **DRIFT-CORE-06** — `packages/runtime/src/core-compat.ts` (98-line local shim) restores `@napplet/core` v0.1 legacy exports (`Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`, `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `TOPICS.STATE_*`). Deferred until `@napplet/core` restores the symbols upstream or a dedicated cleanup milestone addresses it.
- **Release deferral** — `changeset publish` blocked upstream by `@napplet/core` npm publication cadence. `changeset version` dry-run rehearsed clean in v1.3 (REL-03).
- **CI/CD** — No GitHub Actions for build/type-check/unit/Playwright. Scoped out of v1.3; candidate for v1.4.
- **Cosmetic doc refs** — `tests/e2e/harness/harness.ts:10` and `tests/e2e/helpers/wait-for-napplet-ready.ts:21` JSDoc `@example` blocks still cite the deleted `auth-napplet` fixture. Surfaced by v1.3 audit; candidate for v1.4 doc refresh.

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
*Last updated: 2026-04-19 — v1.4 milestone opened*
