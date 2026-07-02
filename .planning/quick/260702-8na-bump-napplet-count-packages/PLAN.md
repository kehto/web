---
status: in-progress
created_at: 2026-07-02T04:13:33Z
prerequisite: https://github.com/kehto/web/pull/128
---

# Bump napplet packages for published NAP-COUNT support

## Scope

- Verify the released `@napplet/*` package versions after `kehto/web#128` merged.
- Widen Kehto peer/dev ranges so `@napplet/core` and `@napplet/nap` `0.25.x` are accepted.
- Refresh playground and fixture napplet pins to the current `@napplet/nap`, `@napplet/sdk`, and `@napplet/shim` releases that include the NAP-COUNT line.
- Keep `@napplet/vite-plugin` unchanged if the registry latest is still the current pinned version.
- Regenerate `pnpm-lock.yaml` and open a follow-up PR.

## Verification

- `pnpm install --lockfile-only`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `npx aislop scan`
- `git diff --check`
