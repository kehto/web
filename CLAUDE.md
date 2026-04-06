# CLAUDE.md

## Project Overview

This is the **kehto** monorepo — runtime packages for the napplet protocol. Kehto provides the server-side (shell) runtime that hosts napplet sandboxed iframe apps, including the protocol engine, ACL enforcement, service handlers, and browser adapter.

Extracted from [@napplet](https://github.com/sandwichfarm/napplet) (v0.13.0 milestone). The @napplet repo retains the portable SDK packages (core, shim, sdk, vite-plugin); this repo contains the runtime and shell implementation.

## Packages

- `packages/acl` — **@kehto/acl** — Pure ACL module (zero deps, WASM-ready)
- `packages/runtime` — **@kehto/runtime** — Protocol engine (message dispatch, AUTH, subscription lifecycle)
- `packages/shell` — **@kehto/shell** — Browser adapter (ShellBridge, signer proxy, storage proxy)
- `packages/services` — **@kehto/services** — Reference service handlers (audio, notifications)

## Tech Stack

- **TypeScript** (strict, ESM-only)
- **tsup** for building each package
- **turborepo** for monorepo orchestration
- **pnpm** workspaces
- **changesets** for versioning and publishing
- **@napplet/core** as peer dependency (protocol types and constants)
- **nostr-tools** as peer dependency (shell package)

## Build & Test

```bash
pnpm install
pnpm build          # Build all via turborepo
pnpm type-check     # TypeScript validation
```

## Relationship to @napplet

- This repo contains the **runtime/shell implementation** packages
- @napplet contains the **portable SDK** (core, shim, sdk, vite-plugin)
- @napplet/core is this repo's foundational dependency (protocol types, constants, message definitions)
- Both repos follow identical code conventions and monorepo tooling

## Code Conventions

- ESM-only (no CJS output)
- Zero framework dependencies (no Svelte, React, etc.)
- All public API exports have JSDoc with @param, @returns, @example
- 2-space indentation
- TypeScript strict mode with verbatimModuleSyntax
- File naming: lowercase with hyphens (acl-store.ts, storage-proxy.ts)
- PascalCase for interfaces/types, camelCase for functions/variables
- UPPER_SNAKE_CASE for constants

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
