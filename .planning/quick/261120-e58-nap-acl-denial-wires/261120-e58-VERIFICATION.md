---
status: passed
---

# Verification: NAP ACL denial wires (kehto/web#458)

- `pnpm build`: 18/18 tasks.
- `pnpm type-check`: 20/20 tasks.
- `pnpm test:unit`: 287 files, 3746 tests passed.
- `pnpm docs:check`: OK.
- `npx playwright test tests/e2e/paja-cvm.spec.ts tests/e2e/paja-cvm-discovery.spec.ts tests/e2e/paja-multiplayer.spec.ts --workers=1`: 5 passed.
- `npx playwright test tests/e2e/nap-relay.spec.ts tests/e2e/paja-firewall-rules.spec.ts tests/e2e/paja-relay.spec.ts --workers=1`: 11 passed.
- `npx aislop@0.12.0 scan`: 100/100 (baseline `origin/staging/issue-sweep-2611` `ffa9726b`: 100/100).
