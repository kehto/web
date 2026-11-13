# Package Reference

Use these pages when you need to choose or integrate one part of Kehto. Each page is grounded in the package manifest and source barrel for the current repository state.

> **Alpha status:** Kehto is an early toolkit for a draft NIP-5D protocol. NAP
> contracts and package APIs are not final; use these package pages as current
> implementation guidance, not as a stability guarantee.

| Package | Page | Role |
|---------|------|------|
| `@kehto/acl` | [ACL](./acl.md) | Pure capability state and enforcement primitives. |
| `@kehto/cli` | [CLI](./cli.md) | Top-level `kehto` command namespace, including `kehto paja`. |
| `@kehto/paja` | [Paja](./paja.md) | Reference developer runtime and local authoring workshop. |
| `@kehto/firewall` | [Firewall](./firewall.md) | Pure scoped approval and access policy. |
| `@kehto/rate-limit` | [Rate limits](./rate-limit.md) | Optional host-installed temporal budgets. |
| `@kehto/runtime` | [Runtime](./runtime.md) | Browser-agnostic NIP-5D protocol engine. |
| `@kehto/shell` | [Shell](./shell.md) | Browser shell adapter over the runtime. |
| `@kehto/services` | [Services](./services.md) | Reference service handlers for runtime domains. |
| `@kehto/mocks` | [Mocks](./mocks.md) | Deterministic mock services for every NAP domain, for shells implementing NAPs without real data sources. |
| `@kehto/nip` | [NIP utilities](./nip.md) | Unique Nostr NIP utilities, including NIP-5A/5D napplet artifact verification and Cache Storage reuse. |
| `@kehto/wm` | [Window Management](./wm.md) | Structural window-management contracts. |

## Reading Order

1. Start with `@kehto/runtime` if you are building a host.
2. Add `@kehto/shell` when you need browser iframe/session integration.
3. Add `@kehto/services` for reference implementations of runtime services, or `@kehto/mocks` while a domain's real backend does not exist yet.
4. Use `@kehto/acl` directly when you need capability-state persistence or policy tests, and `@kehto/firewall` for scoped approval policy. Install `@kehto/rate-limit` separately when the host wants temporal protection.
5. Use `@kehto/nip` and `@kehto/wm` as optional utilities.
6. Use `@kehto/cli` for package scripts such as `kehto paja`.
7. Use `@kehto/paja` directly when embedding or extending the Paja implementation API.

Generated API reference lives under `docs/api/`. Package pages link to generated module pages for the public packages included in TypeDoc.
