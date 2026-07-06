---
status: complete
completed_at: 2026-07-04T14:22:00+02:00
commit: 0b75d3a
---

# Quick Task 260704-jrn Summary

## Result

Removed stale public and compatibility language that implied optional browser
sandbox relaxations are a NIP-5D capability surface. Kehto still emits the
legacy `ShellCapabilities.sandbox` field, but it is documented and tested as an
empty compatibility field.

## Changed Files

- `packages/shell/src/shell-init.ts` — removed host-extension wording and the
  no-op sandbox-to-domains merge.
- `packages/shell/src/types.ts` — narrowed `ShellCapabilities` docs around the
  empty sandbox field.
- `packages/shell/tests/perm-namespace.test.ts` and
  `packages/shell/src/shell-supports-conformance.test.ts` — replaced positive
  sandbox-permission tests with assertions that sandbox capabilities are absent.
- `packages/shell/src/napplet-namespace.test.ts` and
  `tests/e2e/gateway-artifact-parity.spec.ts` — kept guard coverage without
  naming removed optional sandbox tokens.
- `docs/migrations/SHELL-MIGRATION.md`,
  `docs/migrations/v1.2-NIP-5D-AUDIT.md`, and `packages/shell/CHANGELOG.md` —
  removed stale public guidance around browser sandbox permission checks.

## Verification

- `pnpm exec vitest run --config vitest.config.ts packages/shell/src/shell-supports-conformance.test.ts packages/shell/tests/perm-namespace.test.ts packages/shell/src/napplet-namespace.test.ts packages/paja/src/host-page.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm --filter @kehto/shell type-check`
- `pnpm test:unit`
- `pnpm build`
- `pnpm docs:check`
- `pnpm type-check`
- `pnpm audit:gateway-artifacts`
- `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts --workers=1`
- `npx aislop scan`
- `git diff --check`
- Static sweep: no remaining `perm:popups`, `perm:modals`, `perm:downloads`,
  `allow-popups`, `allow-modals`, `allow-downloads`, or `allow-forms` in the
  checked public/source surfaces.

## Remaining Risks

- Full Playwright suite was not run; the touched e2e spec passed.
