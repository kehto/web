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

**Shipped:** v1.0 — NIP-5D Migration & Gap Analysis (2026-04-07)

Five migration/analysis documents produced covering the complete specification delta between the previous napplet protocol and NIP-5D v0.1.0. All 17 requirements satisfied, cross-document consistency verified.

**Deliverables in `/docs/`:**
- GAP-ANALYSIS.md — boundary contracts, wire format, silent failures
- ACL-MIGRATION.md — identity schema, capability mapping, data migration
- RUNTIME-MIGRATION.md — NUB dispatch, AUTH removal, handler rewrites, session identity
- SHELL-MIGRATION.md — envelope guard, window.nostr injection, capability advertisement
- SERVICES-MIGRATION.md — ServiceHandler interface, per-handler migration paths

**Next:** Code implementation of the migration changes documented in v1.0.

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Separate repo (not monorepo subfolder) | Independent release cadence, different maintainers possible | 2026-04-06 |
| 2 | @napplet/core as peer dep | Core types shared; @napplet publishes, @kehto consumes | 2026-04-06 |
| 3 | Mirror @napplet tooling exactly | Consistency, easy contributor onboarding | 2026-04-06 |

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
*Last updated: 2026-04-07*
