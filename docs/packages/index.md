# Package Reference

Use these pages when you need to choose or integrate one part of Kehto. Each page is grounded in the package manifest and source barrel for the current repository state.

| Package | Page | Role |
|---------|------|------|
| `@kehto/acl` | [ACL](./acl.md) | Pure capability state and enforcement primitives. |
| `@kehto/runtime` | [Runtime](./runtime.md) | Browser-agnostic NIP-5D protocol engine. |
| `@kehto/shell` | [Shell](./shell.md) | Browser shell adapter over the runtime. |
| `@kehto/services` | [Services](./services.md) | Reference service handlers for runtime domains. |
| `@kehto/nip66` | [NIP-66](./nip66.md) | Relay-discovery aggregation utility. |
| `@kehto/wm` | [Window Management](./wm.md) | Structural window-management contracts. |
| `@kehto/playground` | [Playground](./playground.md) | 13-napplet demo and verification target. |

## Reading Order

1. Start with `@kehto/runtime` if you are building a host.
2. Add `@kehto/shell` when you need browser iframe/session integration.
3. Add `@kehto/services` for reference implementations of runtime services.
4. Use `@kehto/acl` directly when you need capability-state persistence or policy tests.
5. Use `@kehto/nip66` and `@kehto/wm` as optional utilities.
6. Use the playground page to reproduce integrated behavior locally.

Generated API reference lives under `docs/api/`. Package pages link to generated module pages where they exist and reserve stable targets for packages added to TypeDoc in later phases.
