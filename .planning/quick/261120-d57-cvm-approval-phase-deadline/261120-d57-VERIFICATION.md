---
status: passed
---

# Verification: approval-phase deadline (kehto/web#457)

- Repro before the fix (coordinator source reverted, new tests kept): `tests/unit/cvm-deadline-runtime.test.ts` 2 failed / 2 passed (the 90 s completion and the 120 s `relay timeout` cases); `approval-coordinator.test.ts` 2 failed / 33 passed.
- `pnpm build`: 18/18 tasks.
- `pnpm type-check`: 20/20 tasks.
- `pnpm test:unit`: 287 files, 3704 tests passed.
- `pnpm docs:check`: OK.
- `npx playwright test tests/e2e/paja-cvm.spec.ts tests/e2e/paja-cvm-discovery.spec.ts tests/e2e/paja-multiplayer.spec.ts --workers=1`: 5 passed.
- `npx aislop@0.12.0 scan`: 100/100 (baseline `origin/staging/issue-sweep-2611` `ffa9726b`: 100/100, same single pre-existing warning).
