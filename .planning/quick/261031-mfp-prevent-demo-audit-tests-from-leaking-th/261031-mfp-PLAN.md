---
mode: quick
status: complete
---

# Prevent demo audit tests from leaking their Vite server

Follow-up to https://github.com/kehto/web/pull/363, based on main 07e5ca84.

1. Remove the redundant pnpm/Vite lifecycle from demo-audit-correctness.spec.ts.
   Use the existing Playwright-managed playground preview at localhost:4174,
   matching neighboring specs. Preserve KEHTO_PLAYGROUND_BASE_URL. Keep the
   three browser assertions unchanged. No package output or protocol changes.
2. Prove the lifecycle with a real Chromium run from free ports, then verify
   both preview ports are released. Repeat to prove a subsequent run starts
   cleanly. Exercise the external URL override. Run build, type-check, unit,
   lint, full e2e and AI-slop gates; distinguish existing failures explicitly.
3. Record evidence, commit only scoped files, push and open a PR referencing #363.

Prefer deleting duplicate process ownership over adding a process-tree killer.
Graph coverage excludes tests/e2e, so inspect those sources directly.
