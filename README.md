# Kehto Runtime

[![CI](https://github.com/kehto/web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kehto/web/actions/workflows/ci.yml)
[![Release](https://github.com/kehto/web/actions/workflows/release.yml/badge.svg)](https://github.com/kehto/web/actions/workflows/release.yml)
[![Publish Web to GitHub Pages](https://github.com/kehto/web/actions/workflows/playground-pages.yml/badge.svg?branch=main)](https://github.com/kehto/web/actions/workflows/playground-pages.yml)
[![AI Slop Score](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkehto%2Fweb%2Fmain%2F.github%2Fbadges%2Faislop-score.json)](https://github.com/kehto/web/actions/workflows/aislop-badge.yml)

Kehto is an early web-based runtime implementation for NIP-5D Nostr applets
("napplets"). It is one runtime, not the runtime for the ecosystem. It is likely
the first implementation and may become a useful reference implementation as
other napplet runtimes emerge.

> **Alpha status:** NIP-5D is still under development, and NAP contracts are not
> final. Package APIs, capability names, `requires` declarations, and
> `supports()` behavior may change as the spec evolves.

It provides packages for building a napplet host client by handling capability
enforcement, message routing, host service registration, gateway artifacts, and
development tooling. The applet-side packages (`@napplet/core`, `@napplet/shim`,
`@napplet/sdk`, and `@napplet/vite-plugin`) live in the
[@napplet](https://github.com/sandwichfarm/napplet) repo; Kehto implements an
example runtime and NIP-5D shell.

## Start Here

- Public web portal: <https://kehto.github.io/web/>
- Playground demo: <https://kehto.github.io/web/playground/>
- Docs: <https://kehto.github.io/web/docs/>
- Alpha status: [docs/alpha-status.md](./docs/alpha-status.md)
- Local docs entry: [docs/index.md](./docs/index.md)
- Package reference index: [docs/packages/index.md](./docs/packages/index.md)
- Generated API reference index: [docs/reference/api.md](./docs/reference/api.md)

If you are building a host app, start with the
[minimal host shell tutorial](./docs/tutorials/minimal-host-shell.md), then use
the package table below to jump into the implementation surface you need.

## Packages

| Package | Use it for | Package root | Markdown docs | VitePress docs |
|---------|------------|--------------|---------------|----------------|
| `@kehto/acl` | Pure capability state, grants, blocks, quotas, and policy checks. | [packages/acl](./packages/acl/) | [docs/packages/acl.md](./docs/packages/acl.md) | [ACL docs](https://kehto.github.io/web/docs/packages/acl) |
| `@kehto/firewall` | Pure, zero-dependency behavioral anti-abuse engine — rate/burst/content rules with allow/deny/ask policy and focus-aware tightening. | [packages/firewall](./packages/firewall/) | [docs/packages/firewall.md](./docs/packages/firewall.md) | [Firewall docs](https://kehto.github.io/web/docs/packages/firewall) |
| `@kehto/runtime` | Browser-agnostic NIP-5D dispatch, ACL gates, service registry, sessions, manifests, replay checks, and event buffering. | [packages/runtime](./packages/runtime/) | [docs/packages/runtime.md](./docs/packages/runtime.md) | [Runtime docs](https://kehto.github.io/web/docs/packages/runtime) |
| `@kehto/shell` | Browser iframe/session adapter over a Kehto runtime, gateway loading, postMessage transport, hosted `supports()`, and shell policy. | [packages/shell](./packages/shell/) | [docs/packages/shell.md](./docs/packages/shell.md) | [Shell docs](https://kehto.github.io/web/docs/packages/shell) |
| `@kehto/services` | Reference handlers for identity, relay, keys, media, notify, config, resource, cache, theme, and audio surfaces. | [packages/services](./packages/services/) | [docs/packages/services.md](./docs/packages/services.md) | [Services docs](https://kehto.github.io/web/docs/packages/services) |
| `@kehto/nip` | Tree-shakable bundle of unique Nostr NIP utilities (NIP-51/65/66/89) not shipped by `nostr-tools` — each NIP at its own subpath (e.g. `@kehto/nip/65` for the outbox model). | [packages/nip](./packages/nip/) | [docs/packages/nip.md](./docs/packages/nip.md) | [NIP docs](https://kehto.github.io/web/docs/packages/nip) |
| `@kehto/wm` | Structural window-management contracts for shell-owned layout strategies. | [packages/wm](./packages/wm/) | [docs/packages/wm.md](./docs/packages/wm.md) | [WM docs](https://kehto.github.io/web/docs/packages/wm) |
| `@kehto/playground` | 10-napplet browser demo and integration verification target. | [apps/playground](./apps/playground/) | [docs/packages/playground.md](./docs/packages/playground.md) | [Playground docs](https://kehto.github.io/web/docs/packages/playground) |

Package roots link to package-local READMEs and source. Markdown docs are the
same pages used by the VitePress site.

## Documentation Map

| Need | Local markdown | Published docs |
|------|----------------|----------------|
| Understand the architecture | [docs/concepts/architecture.md](./docs/concepts/architecture.md) | [Architecture](https://kehto.github.io/web/docs/concepts/architecture) |
| Understand runtime vs shell boundaries | [docs/concepts/runtime-shell-boundaries.md](./docs/concepts/runtime-shell-boundaries.md) | [Runtime and shell boundaries](https://kehto.github.io/web/docs/concepts/runtime-shell-boundaries) |
| Build a minimal host shell | [docs/tutorials/minimal-host-shell.md](./docs/tutorials/minimal-host-shell.md) | [Minimal host shell](https://kehto.github.io/web/docs/tutorials/minimal-host-shell) |
| Integrate a napplet with Kehto | [docs/tutorials/napplet-integration.md](./docs/tutorials/napplet-integration.md) | [Napplet integration](https://kehto.github.io/web/docs/tutorials/napplet-integration) |
| Register runtime services | [docs/how-tos/register-service.md](./docs/how-tos/register-service.md) | [Register a service](https://kehto.github.io/web/docs/how-tos/register-service) |
| Grant capabilities | [docs/how-tos/grant-capability.md](./docs/how-tos/grant-capability.md) | [Grant a capability](https://kehto.github.io/web/docs/how-tos/grant-capability) |
| Verify gateway artifacts | [docs/how-tos/verify-gateway-artifact.md](./docs/how-tos/verify-gateway-artifact.md) | [Verify gateway artifacts](https://kehto.github.io/web/docs/how-tos/verify-gateway-artifact) |
| Read shell policy documents | [docs/policies/index.md](./docs/policies/index.md) | [Policies](https://kehto.github.io/web/docs/policies/) |
| Browse generated API docs | [docs/reference/api.md](./docs/reference/api.md) | [API reference](https://kehto.github.io/web/docs/reference/api) |

## Playground Demo

The playground is the reference host application. It loads 10 sandboxed napplets
through the same gateway artifact shape used by the static Pages build.

- Public demo: <https://kehto.github.io/web/playground/>
- Local app root: [apps/playground](./apps/playground/)
- Playground README: [apps/playground/README.md](./apps/playground/README.md)
- Playground docs: [docs/packages/playground.md](./docs/packages/playground.md)

Run it locally from the repository root:

```bash
pnpm install
pnpm --filter "./apps/playground/napplets/*" build
pnpm --filter @kehto/playground dev
```

Use the preview command when reproducing the production build used by the
Playwright suite:

```bash
pnpm --filter @kehto/playground preview
```

## Repository Layout

| Path | Contents |
|------|----------|
| [packages/acl](./packages/acl/) | Capability and ACL primitives. |
| [packages/firewall](./packages/firewall/) | Pure behavioral anti-abuse firewall engine. |
| [packages/runtime](./packages/runtime/) | Protocol runtime and service routing. |
| [packages/shell](./packages/shell/) | Browser shell adapter and gateway/session integration. |
| [packages/services](./packages/services/) | Reference service implementations. |
| [packages/nip](./packages/nip/) | Standalone Nostr NIP utilities (per-NIP subpaths). |
| [packages/wm](./packages/wm/) | Window-management type contracts. |
| [apps/playground](./apps/playground/) | Demo host and demo napplets. |
| [docs](./docs/) | VitePress documentation source. |
| [specs](./specs/) | Pinned protocol specifications consumed by this repo. |
| [scripts](./scripts/) | Build and audit helpers. |

## Local Commands

```bash
pnpm install
pnpm build
pnpm type-check
pnpm test:unit
pnpm test:e2e
```

Docs and Pages artifact commands:

```bash
pnpm docs:site:dev
pnpm docs:check
pnpm build:pages
pnpm audit:pages
```

Generated API docs are produced by:

```bash
pnpm docs:api
```

## License

MIT
