# Kehto Runtime

Kehto is a web-based runtime for NIP-5D nostr applets ("napplets"). 

It provides a series of packages that can be used to more easily build a napplet host-client, by handling enforcment capabilities, routing, registration of host services, and development tooling. There are applet-side packages that act as a reference implementation (`@napplet/core`, `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin`) and they live in the [@napplet](https://github.com/sandwichfarm/napplet) repo; Kehto implements an example runtime and NIP-5D shell. 

## Start Here

- Public web portal: <https://kehto.github.io/web/>
- Playground demo: <https://kehto.github.io/web/playground/>
- Dcs: <https://kehto.github.io/web/docs/>
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
| `@kehto/runtime` | Browser-agnostic NIP-5D dispatch, ACL gates, service registry, sessions, manifests, replay checks, and event buffering. | [packages/runtime](./packages/runtime/) | [docs/packages/runtime.md](./docs/packages/runtime.md) | [Runtime docs](https://kehto.github.io/web/docs/packages/runtime) |
| `@kehto/shell` | Browser iframe/session adapter over the runtime, gateway loading, postMessage transport, hosted `supports()`, and shell policy. | [packages/shell](./packages/shell/) | [docs/packages/shell.md](./docs/packages/shell.md) | [Shell docs](https://kehto.github.io/web/docs/packages/shell) |
| `@kehto/services` | Reference handlers for identity, relay, keys, media, notify, config, resource, cache, theme, and audio surfaces. | [packages/services](./packages/services/) | [docs/packages/services.md](./docs/packages/services.md) | [Services docs](https://kehto.github.io/web/docs/packages/services) |
| `@kehto/nip66` | Framework-agnostic NIP-66 kind-30166 relay discovery aggregation. | [packages/nip66](./packages/nip66/) | [docs/packages/nip66.md](./docs/packages/nip66.md) | [NIP-66 docs](https://kehto.github.io/web/docs/packages/nip66) |
| `@kehto/wm` | Structural window-management contracts for shell-owned layout strategies. | [packages/wm](./packages/wm/) | [docs/packages/wm.md](./docs/packages/wm.md) | [WM docs](https://kehto.github.io/web/docs/packages/wm) |
| `@kehto/playground` | 13-napplet browser demo and integration verification target. | [apps/playground](./apps/playground/) | [docs/packages/playground.md](./docs/packages/playground.md) | [Playground docs](https://kehto.github.io/web/docs/packages/playground) |

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

The playground is the reference host application. It loads 13 sandboxed napplets
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
| [packages/runtime](./packages/runtime/) | Protocol runtime and service routing. |
| [packages/shell](./packages/shell/) | Browser shell adapter and gateway/session integration. |
| [packages/services](./packages/services/) | Reference service implementations. |
| [packages/nip66](./packages/nip66/) | Relay discovery aggregator. |
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
