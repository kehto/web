# Migration Archive

This directory contains terminal-state snapshots of historical migration and audit documents.
They are preserved for reference but do NOT describe the current state of kehto.

For current documentation, see:

- Repository root: [`README.md`](../../README.md)
- Per-package READMEs: [`packages/*/README.md`](../../packages/)
- Generated API reference: [`docs/api/`](../api/) (run `pnpm docs:api`)

## Documents

| File | Scope | Captured at |
|------|-------|-------------|
| [`GAP-ANALYSIS.md`](./GAP-ANALYSIS.md) | RUNTIME-SPEC v2.0.0 → NIP-5D v0.1.0 boundary contracts and change inventory | 2026-04-07 |
| [`ACL-MIGRATION.md`](./ACL-MIGRATION.md) | `@kehto/acl` identity schema + capability-to-NUB mapping migration | 2026-04-07 |
| [`RUNTIME-MIGRATION.md`](./RUNTIME-MIGRATION.md) | `@kehto/runtime` NUB dispatch, AUTH removal, session identity anchor | 2026-04-07 |
| [`SERVICES-MIGRATION.md`](./SERVICES-MIGRATION.md) | `@kehto/services` ServiceHandler interface + per-handler migration | 2026-04-07 |
| [`SHELL-MIGRATION.md`](./SHELL-MIGRATION.md) | `@kehto/shell` envelope guard, `window.nostr` removal, capability advertisement | 2026-04-07 |
| [`v1.2-NIP-5D-AUDIT.md`](./v1.2-NIP-5D-AUDIT.md) | v1.2 per-package drift audit vs canonical NIP-5D + 8 `@napplet/nub-*` packages | 2026-04-17 |

These describe transitions that have already shipped. Do not use them as integration guidance.
