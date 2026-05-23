# Architecture

Kehto separates napplet hosting into small packages with clear ownership boundaries.

| Layer | Package | Responsibility |
|-------|---------|----------------|
| Capability state | `@kehto/acl` | Pure access-control state and capability mapping. |
| Protocol engine | `@kehto/runtime` | Dispatch, service routing, ACL checks, storage, manifest/session state. |
| Browser shell | `@kehto/shell` | iframe/session lifecycle, `postMessage`, gateway loading, hosted `supports()`, browser registries. |
| Services | `@kehto/services` | Reference service handlers registered with the runtime. |
| Optional utilities | `@kehto/nip66`, `@kehto/wm` | Relay discovery and shell-owned window-management contracts. |

`@napplet` packages define portable napplet-side contracts and helpers. Kehto implements the host-side runtime and shell behavior.
