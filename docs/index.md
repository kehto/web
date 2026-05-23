# Kehto Runtime Documentation

Kehto is an early runtime implementation for NIP-5D napplets. It is one runtime,
not the runtime for the napplet ecosystem. It is likely the first implementation
and may become a useful reference implementation as other runtimes are built.

> **Alpha status:** NIP-5D is still under development, and NUB contracts are not
> final. Package APIs, capability names, `requires` declarations, and
> `supports()` behavior may change as the spec evolves. See
> [Alpha Status](./alpha-status.md).

Kehto provides host-side packages that let a Nostr client embed sandboxed napplet iframe applications: access control, protocol dispatch, browser shell integration, reference services, relay discovery, and shell-owned window-management contracts.

Kehto works with the `@napplet` packages. `@napplet/core`, `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` define the portable napplet-side protocol and build surface. Kehto consumes those contracts and implements the shell/runtime side.

## Start Here

| Reader | Start path | What you are trying to do |
|--------|------------|----------------------------|
| Host-app implementer | Runtime implementation guide | Build a shell that hosts sandboxed napplets. |
| Protocol evaluator | Alpha status | Understand what is still draft-stage before treating Kehto as a reference implementation. |
| Package API consumer | Package reference | Understand one `@kehto/*` package and its exports. |
| Napplet author | Napplet integration tutorial | Declare `requires`, check `supports()`, and use NUB helpers safely. |
| Maintainer | Docs maintenance guide | Keep README, site, API reference, and milestone history aligned. |

## Package Map

| Package | Role |
|---------|------|
| `@kehto/acl` | Pure capability state and enforcement primitives. |
| `@kehto/runtime` | Browser-agnostic protocol engine, dispatch, ACL gates, service registry, and lifecycle. |
| `@kehto/shell` | Browser adapter: iframe/session lifecycle, `postMessage`, gateway loading, hosted `supports()`, and shell policy. |
| `@kehto/services` | Reference service handlers for identity, relay, keys, media, notify, config, resource, cache, theme, and audio. |
| `@kehto/nip66` | Framework-agnostic NIP-66 kind-30166 relay-discovery aggregator. |
| `@kehto/wm` | Structural window-management contracts for consumer-owned layout strategies. |
| `@kehto/playground` | 13-napplet browser demo and Playwright verification target. |

## Current Documentation Shape

- **Start** explains the project, packages, and reader routes.
- **Concepts** explain architecture, security boundaries, capability negotiation, and source-of-truth decisions.
- **Tutorials** walk through complete implementation paths.
- **How-tos** answer focused operational tasks.
- **Package Reference** documents each public package and links to generated API pages.
- **API Reference** links to generated TypeDoc output under `docs/api/`.
- **Policies** host current shell/NIP-5D policy documents.
- **Migration Archive** keeps historical transition documents clearly marked as non-current guidance.

## Historical Material

Documents under `docs/migrations/` are preserved for project history. They describe already-shipped transitions and should not be used as current integration guidance unless a current guide links to a specific section deliberately.
