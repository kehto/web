# kehto

## Overview

**kehto** is the runtime half of the napplet protocol ecosystem. It provides the shell-side packages that host sandboxed Nostr iframe applications (napplets): protocol engine, ACL enforcement, service handlers, and browser adapter. Extracted from [@napplet](https://github.com/sandwichfarm/napplet) at the v0.13.0 Runtime Decoupling milestone, kehto lets any Nostr client embed sandboxed mini-apps by integrating `@kehto/shell`.

## Packages

- `packages/acl` — **@kehto/acl** — Pure ACL module (zero deps, WASM-ready)
- `packages/runtime` — **@kehto/runtime** — Protocol engine (message dispatch, AUTH, subscription lifecycle)
- `packages/shell` — **@kehto/shell** — Browser adapter (ShellBridge, signer proxy, storage proxy)
- `packages/services` — **@kehto/services** — Reference service handlers (audio, notifications)

## Specification

The authoritative protocol that kehto implements is **NIP-5D**.

- Local pinned copy: [`specs/NIP-5D.md`](./specs/NIP-5D.md)
- Canonical source: [`dskvr/nips` branch `nip/5d`](https://github.com/dskvr/nips/blob/nip/5d/5D.md) — authoritative; always.
- Sync policy: The local copy is re-synced from the canonical source at each kehto milestone boundary. Last synced at milestone **v1.2** (2026-04-17).

Do not edit `specs/NIP-5D.md` in-place — edit the canonical source and re-sync.

## Build

```bash
pnpm install
pnpm build          # Build all via turborepo
pnpm type-check     # TypeScript validation
```
