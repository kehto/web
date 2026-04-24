# kehto

> Runtime half of the napplet protocol — sandboxed-iframe app hosting for Nostr clients.

kehto provides the shell-side packages a host application integrates to embed sandboxed mini-apps
(napplets) that communicate over the [NIP-5D](./specs/NIP-5D.md) protocol. It delivers the
protocol engine, ACL enforcement, reference service handlers, and a browser adapter —
extracted from [@napplet](https://github.com/sandwichfarm/napplet) at v0.13.0. The portable
SDK (core/shim/sdk/vite-plugin) lives in the @napplet repo; kehto is the runtime.

## Current milestone: v1.3 — Demo Functional & Playwright Parity

The [`apps/demo`](./apps/demo) application is the reference integration. It:

- Boots a full NIP-5D shell at `http://localhost:4174` with all 8 service topology nodes live.
- Hosts 8 domain napplets under `apps/demo/napplets/`: `bot`, `chat`, `composer`, `preferences`,
  `toaster`, `feed`, `profile-viewer`, `theme-switcher` — each exercising a single NUB domain end-to-end.
- Is covered by a two-tier Playwright suite: Layer A (harness at `:4173`, per-nub fixture specs) +
  Layer B (demo at `:4174`, UX integration specs). Full suite green under 5 minutes.

## Packages

| Package | Description |
|---------|-------------|
| [`@kehto/acl`](./packages/acl/README.md) | Pure ACL module (zero deps, WASM-ready). Capability grants, blocks, domain resolution. |
| [`@kehto/runtime`](./packages/runtime/README.md) | Protocol engine — message dispatch via `createDispatch()` + `registerNub()` across all 8 NIP-5D nub domains, AUTH, subscription lifecycle. |
| [`@kehto/shell`](./packages/shell/README.md) | Browser adapter — ShellBridge factory, per-domain proxies, keys-forwarder. |
| [`@kehto/services`](./packages/services/README.md) | Reference service handlers: identity, relay-pool, cache, notify, theme, audio (legacy), keys (stub), media (stub). |
| [`@kehto/nip66`](./packages/nip66/README.md) | Framework-agnostic NIP-66 kind-30166 relay-discovery aggregator (publish-ready at v0.1.0; zero napplet-protocol peer deps). |
| [`@kehto/wm`](./packages/wm/README.md) | Generic window manager service contract for NIP-5D shells (draft skeleton at v0.0.0 — see package README). |

## Quick Integration

Host app integration is a single `createShellBridge` call plus service registration:

```ts
import { createShellBridge } from '@kehto/shell';
import { createRuntime } from '@kehto/runtime';
import {
  createIdentityService,
  createNotificationService,
  createRelayPoolService,
} from '@kehto/services';

const runtime = createRuntime({ /* adapters */ });

runtime.registerService('identity', createIdentityService({ getPublicKey: () => pk }));
runtime.registerService('notifications', createNotificationService({ onChange: updateBadge }));
runtime.registerService('relay', createRelayPoolService({ /* ... */ }));

const shell = createShellBridge({
  runtime,
  target: window,
  /* hooks + adapter */
});
```

See [`apps/demo/src/shell-host.ts`](./apps/demo/src/shell-host.ts) for the full canonical example
(including the `createDemoHooks()` adapter factory and per-domain service registration).

## Specification

The authoritative protocol kehto implements is **NIP-5D**.

- Local pinned copy: [`specs/NIP-5D.md`](./specs/NIP-5D.md)
- Canonical source: [`dskvr/nips` branch `nip/5d`](https://github.com/dskvr/nips/blob/nip/5d/5D.md) — authoritative; always.
- Sync policy: re-synced at each kehto milestone boundary. Last synced at **v1.7** (2026-04-24).

Do not edit `specs/NIP-5D.md` in-place — edit the canonical source and re-sync.

## API Reference

Full typedoc-generated API reference:

```bash
pnpm docs:api
```

Output written to [`docs/api/`](./docs/api) (gitignored; generated on demand). Covers all 4 @kehto/* packages.

## Build & Test

```bash
pnpm install
pnpm build          # Build all via turborepo
pnpm type-check     # TypeScript validation
pnpm test:e2e       # Full Layer A + Layer B Playwright suite (~3-5 min)
```

## Architecture Notes

- **ESM-only.** No CJS output. All packages are `"type": "module"`.
- **Zero framework deps.** No Svelte, React, Vue — kehto is framework-agnostic.
- **NIP-5D anti-features:** window.nostr is not injected into napplet iframes; signing is shell-mediated via `relay.publish` / `relay.publishEncrypted`; sandbox uses `allow-scripts` without `allow-same-origin`.
- **Registry install.** `@napplet/*` ships to npm; consume `@kehto/*` directly from the registry. Workspace pins one transitive `pnpm.overrides` for `@napplet/nub>@napplet/core: ^0.2.1` (upstream publish-time workspace-specifier bug; Phase 32 Decision — see `package.json`).

## History

Archived migration docs and milestone audits live under [`docs/migrations/`](./docs/migrations/). Those are point-in-time snapshots (RUNTIME-SPEC v2.0.0 → NIP-5D, v1.1 → v1.2 conformance audit) and are retained for historical reference only.

## License

MIT
