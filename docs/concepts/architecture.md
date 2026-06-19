# Architecture

Kehto is an early runtime implementation for NIP-5D napplets. It separates
napplet hosting into small packages with clear ownership boundaries.

> **Alpha status:** NIP-5D is still under development, and NAP contracts are not
> final. This architecture describes Kehto's current implementation, not a
> requirement that all napplet runtimes follow the same shape.

| Layer | Package | Responsibility |
|-------|---------|----------------|
| Capability state | `@kehto/acl` | Pure access-control state and capability mapping. |
| Protocol engine | `@kehto/runtime` | Dispatch, service routing, ACL checks, storage, manifest/session state. |
| Browser shell | `@kehto/shell` | iframe/session lifecycle, `postMessage`, gateway loading, hosted `supports()`, browser registries. |
| Services | `@kehto/services` | Reference service handlers registered with the runtime. |
| Optional utilities | `@kehto/nip`, `@kehto/wm` | Unique Nostr NIP utilities, including NIP-5A/5D artifact verification/cache helpers, and shell-owned window-management contracts. |

`@napplet` packages define portable napplet-side contracts and helpers. Kehto
implements one host-side runtime and shell behavior.
