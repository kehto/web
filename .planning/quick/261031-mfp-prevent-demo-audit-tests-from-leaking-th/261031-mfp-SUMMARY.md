---
status: complete
---

# Demo audit server lifecycle

Implementation: `ac4ae564`. Follow-up to https://github.com/kehto/web/pull/363.

The audit spec now uses the playground preview owned by `playwright.config.ts`.
Its default URL matches the other playground specs (`localhost:4174`), including
IPv6 preview binding. Removed its pnpm spawn, HTTP polling, pipe draining and
wrapper-only SIGTERM. All three browser assertions and the external URL override
remain. External servers must already be available, as in the neighboring specs.
No runtime/protocol changes, dependencies, package output or changesets.

## Verification

- `pnpm build`: 32/32 tasks.
- `pnpm type-check`: 17/17 tasks.
- `pnpm test:unit`: 190 files, 2453 tests. An initial run overlapped the first
  build and could not import the not-yet-built Paja CLI; the post-build run passes.
- `pnpm lint`: exit 0; repository currently defines no package lint tasks.
- `npx -y aislop@0.12.0 ci --json`: exit 0, 95/100 Healthy, zero errors,
  five existing complexity warnings. Each warning's source file is byte-identical
  to origin/main. No rule/config changes. The 100/100 target remains existing debt.
- Two sequential invocations of
  `pnpm exec playwright test tests/e2e/demo-audit-correctness.spec.ts`:
  each passes 3/3. Before/after each run,
  `ss -H -ltn '( sport = :4173 or sport = :4174 )'` returns no listeners.
- External override: start a separate Vite preview bound to `127.0.0.1:4184`,
  run the same spec with `KEHTO_PLAYGROUND_BASE_URL=http://127.0.0.1:4184`:
  3/3 pass. HTTP 200 and the live PID prove the external server survives teardown;
  ports 4173/4174 are free. The validation harness stops its own external preview.
- Full `pnpm test:e2e`: first run 159 passed, one failure at
  `paja-llm.spec.ts:104` (disabled-frame namespace still present during reload).
  This spec and Paja sources are unchanged from origin/main; PR #363 already
  records timing failures in this test. The full rerun passed all 160 tests (2.2 minutes).
  Both managed ports were free after both full runs; the external preview
  validation port 4184 is also free.
- Independent read-only review: no defects found.
- `git diff --check`: clean.

Graph verification could not cover the spec because tests/e2e is excluded from
indexing; the complete spec and shared config were read directly.
