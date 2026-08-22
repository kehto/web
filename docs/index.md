# Kehto Runtime Toolkit Documentation

Kehto is an unopinionated toolkit and protocol kernel for building NIP-5D
napplet runtimes. It supplies reusable host-side machinery without choosing one
origin, signer, or deployment policy for every implementer. Paja is Kehto's
reference developer runtime; the playground is a visualization and verification
fixture.

> **Alpha status:** NIP-5D is still under development, and NAP contracts are not
> final. Package APIs, capability names, `requires` declarations, and
> injected-domain behavior may change as the spec evolves. See
> [Alpha Status](./alpha-status.md).

Kehto provides host-side packages that let a Nostr client embed sandboxed napplet iframe applications: access control, protocol dispatch, browser shell integration, service building blocks, relay discovery, and shell-owned window-management contracts.

Kehto works with the `@napplet` packages. `@napplet/core`, `@napplet/shim`, `@napplet/nap`, and `@napplet/vite-plugin` define the portable napplet-side protocol and build surface. Kehto consumes those contracts and provides runtime and shell implementation tools.

## Start Here

| Reader | Start path | What you are trying to do |
|--------|------------|----------------------------|
| Host-app implementer | Runtime implementation guide | Build a shell that hosts sandboxed napplets. |
| Protocol evaluator | Alpha status | Understand what remains draft-stage and distinguish Kehto's toolkit from Paja's reference choices. |
| Package API consumer | Package reference | Understand one `@kehto/*` package and its exports. |
| Napplet author | Napplet integration tutorial | Declare `requires`, check injected domains, and use NAP helpers safely. |
| Maintainer | Docs maintenance guide | Keep README, site, API reference, and milestone history aligned. |

## Package Map

| Package | Role |
|---------|------|
| `@kehto/acl` | Pure capability state and enforcement primitives. |
| `@kehto/runtime` | Browser-agnostic protocol engine, dispatch, ACL gates, service registry, and lifecycle. |
| `@kehto/shell` | Browser adapter: iframe/session lifecycle, `postMessage`, gateway loading, injected `window.napplet` domains, and shell policy. |
| `@kehto/services` | Reference service handlers for identity, relay, keys, media, notify, config, resource, cache, theme, and audio. |
| `@kehto/nip` | Framework-agnostic unique Nostr NIP utilities (NIP-51 lists, NIP-65 outbox, NIP-66 relay discovery, NIP-89 app handlers). |
| `@kehto/wm` | Structural window-management contracts for consumer-owned layout strategies. |
| `@kehto/paja` | Reference developer runtime with concrete browser and service policies. |
| `@kehto/playground` | 9-napplet protocol visualization and Playwright verification target. |

## Current Documentation Shape

- **Start** explains the project, packages, and reader routes.
- **Concepts** explain architecture, security boundaries, capability negotiation, and source-of-truth decisions.
- **[Napplet Web Cache Strategy](./concepts/napplet-web-cache-strategy.md)** explains the recommended browser cache layer and eviction policy for verified napplet artifacts.
- **[Implement a Napplet Artifact Cache](./how-tos/implement-napplet-artifact-cache.md)** shows how to wire the shipped `@kehto/nip/5d` Cache Storage adapter into a host resolver.
- **Tutorials** walk through complete implementation paths.
- **How-tos** answer focused operational tasks.
- **Package Reference** documents each public package and links to generated API pages.
- **API Reference** links to generated TypeDoc output under `docs/api/`.
- **Policies** host current shell/NIP-5D policy documents.
- **Migration Archive** keeps historical transition documents clearly marked as non-current guidance.

## Historical Material

Documents under `docs/migrations/` are preserved for project history. They describe already-shipped transitions and should not be used as current integration guidance unless a current guide links to a specific section deliberately.
