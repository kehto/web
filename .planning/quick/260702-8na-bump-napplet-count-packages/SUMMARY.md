---
status: complete
completed_at: 2026-07-02T04:25:00Z
prerequisite: https://github.com/kehto/web/pull/128
---

# Summary

Refreshed Kehto's napplet package graph after the NAP-COUNT-capable
`@napplet/*` releases landed.

## Changes

- Widened published Kehto `@napplet/core` and `@napplet/nap` peer/dev ranges
  to accept `0.25.x`.
- Updated playground and fixture napplets to `@napplet/core@0.25.0`,
  `@napplet/nap@0.25.0`, `@napplet/sdk@0.22.0`, and
  `@napplet/shim@0.26.0` where each package is used.
- Kept `@napplet/vite-plugin@0.10.1` unchanged because it remains the registry
  latest.
- Regenerated `pnpm-lock.yaml` and refreshed docs package dependency rows.
- Updated the SDK migration guard and Paja upstream-domain parity list for the
  newly published `count` web domain.
- Expanded the pending NAP-COUNT changeset to include `@kehto/cli` and
  `@kehto/firewall` package metadata bumps.

## Verification

- `npm view @napplet/{core,nap,sdk,shim,vite-plugin} version dist-tags --json`
- `pnpm install --lockfile-only`
- `pnpm install`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm lint` (no lint tasks configured)
- `npx aislop scan`
- `git diff --check`
- `node --input-type=module -e "const mod = await import('@napplet/nap/count'); console.log(Object.keys(mod).sort().join('\n'))"` from `packages/paja`
