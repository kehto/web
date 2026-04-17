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

**Shipped:** v1.2 — NIP-5D Conformance & Full NUB Coverage (2026-04-17)

Kehto fully conforms to the canonical NIP-5D spec (`dskvr/nips` branch `nip/5d`) and covers all 8 napplet NUB domains end-to-end.
- @kehto/acl: 8-domain `resolveCapabilitiesNub`, new `capabilities.ts` module with 14 capability constants; signer caps removed
- @kehto/runtime: formal `createDispatch()` / `registerNub()` / `dispatch()` routing; 8 domains (identity, ifc, keys, media, notify, relay, storage, theme); shell-mediated `relay.publishEncrypted` via internal NIP-44 (default) / NIP-04 (opt-in)
- @kehto/shell: `window.nostr` hard-removed (canonical MUST NOT), `perm:<permission>` namespace for sandbox permissions, `bridge.publishTheme(theme)` host-facing API, 5 per-domain proxies + keys-forwarder
- @kehto/services: 4 new reference services (identity, keys, media, notify) + theme-service; signer-service deleted outright (sign/encrypt moved inside shell via relay.publishEncrypted)

449 tests passing / 0 skipped; `pnpm build` + `type-check` green; 4 staged changesets at `.changeset/v1-2-*.md`.

**Previous milestones:** v1.0 (migration docs), v1.1 (5-nub implementation), v1.2 (canonical conformance + 8-nub coverage)

## Current Milestone: v1.3 Demo Functional & Playwright Parity

**Goal:** Adapt `apps/demo` and bundled napplets to the canonical v1.2 `@kehto/*` + `@napplet/*` NIP-5D interfaces, rewrite the Playwright suite, and ship a build-run-debug loop until every panel, napplet, and spec is green.

**Target features:**
- Demo app rewire — all surfaces (shell host/topology/animators, ACL panels/modal/history, signer demo + NIP-46, notifications + kinds + constants panels) migrated to canonical v1.2 APIs (no `window.nostr`, no signer-service, no legacy BusKind/AUTH).
- Napplet showcase — migrate `bot`/`chat` to envelope-only `@napplet/sdk`; expand with purpose-built napplets (feed, composer, profile-viewer, …) so all 8 nub domains are exercised end-to-end.
- Canonical signer UX — NIP-46 + signer-demo produce successful `identity.*` reads and `relay.publish` / `relay.publishEncrypted` flows (NIP-44 default, NIP-04 opt-in).
- Playwright suite rewrite — triage `tests/e2e/*`, delete obsolete signer/AUTH/BusKind specs, migrate survivors to NIP-5D envelopes, add demo-functional golden-path specs; `pnpm test:e2e` green with zero skipped/legacy specs.
- Iteration discipline — each phase ends with a build → run → Playwright (MCP) → fix loop.
- Docs refresh — `docs/` + READMEs updated to match the canonical v1.2 contract being showcased.
- Release rehearsal — stage changesets + changelog + dry-run `changeset version`; actual `publish` deferred until `@napplet/core` ships to npm.

**Key context:**
- Starts Phase 16 (continues numbering from v1.2 Phase 15).
- No protocol-level changes in kehto packages — v1.3 *consumes* v1.2's surface.
- `@napplet/*` resolves via pnpm workspace overrides to `/home/sandwich/Develop/napplet/*`; npm publish upstream blocks downstream `changeset publish`.
- Carried tech debt: `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) stays intact.
- No CI/CD in this milestone (deferred).

## Known Tech Debt (carried into next milestone)

- **DRIFT-CORE-06** — `packages/runtime/src/core-compat.ts` (98-line local shim) restores `@napplet/core` v0.1 legacy exports (`Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`, `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `TOPICS.STATE_*`). Deferred until `@napplet/core` restores the symbols upstream or a dedicated cleanup milestone addresses it.
- **Release deferral** — `changeset version` / `changeset publish` blocked upstream by `@napplet/core` npm publication cadence.

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
*Last updated: 2026-04-18 — v1.3 milestone opened*
