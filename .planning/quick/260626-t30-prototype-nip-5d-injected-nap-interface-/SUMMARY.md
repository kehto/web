---
id: 260626-t30
slug: prototype-nip-5d-injected-nap-interface-
status: complete
date: 2026-06-26
---

# Summary

Complete. Added a prototype shell namespace prelude and wired the playground
loader to inject current shell NAP domains into verified `srcdoc` HTML before
artifact scripts run.

Verification so far:

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts tests/unit/playground-gateway-guard.test.ts`
- `pnpm type-check`
- `pnpm --filter @kehto/playground build`
- `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts --workers=1`
- `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/demo-boot.spec.ts --workers=1`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.9.3 scan --changes`
- `git diff --check`
- `pnpm test:e2e` (69 passed)

Notes:

- Full `pnpm dlx aislop@0.9.3 scan` still reports pre-existing repo-wide warnings
  outside this diff; changed-file scan is clean at 100/100.
