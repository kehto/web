# API Reference

Generated API reference lives under `docs/api/` and is produced by:

```bash
pnpm docs:api
```

The docs site build runs API generation first through the root `docs:site:build` script.

## Package Modules

| Package | Generated API target |
|---------|----------------------|
| `@kehto/acl` | [`docs/api/modules/_kehto_acl.html`](../api/modules/_kehto_acl.html) |
| `@kehto/runtime` | [`docs/api/modules/_kehto_runtime.html`](../api/modules/_kehto_runtime.html) |
| `@kehto/shell` | [`docs/api/modules/_kehto_shell.html`](../api/modules/_kehto_shell.html) |
| `@kehto/services` | [`docs/api/modules/_kehto_services.html`](../api/modules/_kehto_services.html) |
| `@kehto/nip66` | [`docs/api/modules/_kehto_nip66.html`](../api/modules/_kehto_nip66.html) |
| `@kehto/wm` | [`docs/api/modules/_kehto_wm.html`](../api/modules/_kehto_wm.html) |

Do not hand-edit generated API files. Update source JSDoc and rerun `pnpm docs:api`.
