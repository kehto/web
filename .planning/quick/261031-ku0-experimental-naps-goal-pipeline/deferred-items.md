# Deferred items (261031-ku0)

These came up during the ku0 pass. They are out of scope because none of them was caused by this
pass's changes, and none of the specs involved is touched by `feat/experimental-naps`.

## 1. `demo-audit-correctness.spec.ts` leaks a playground `vite` dev server on 4174

- **File:** `tests/e2e/demo-audit-correctness.spec.ts` l.77-96 (`beforeAll` / `afterAll`)
- **What:** `beforeAll` spawns `pnpm --filter @kehto/playground exec vite --host 127.0.0.1 --port 4174 --strictPort`.
  `afterAll` sends `SIGTERM` only to the outer `pnpm` process. The `vite` grandchild is reparented to
  launchd and keeps listening on `127.0.0.1:4174`. Playwright's `webServer` preview for 4174 uses
  `reuseExistingServer: !process.env.CI`, so a later local run can reuse that stale dev server instead
  of a fresh preview. This explains the "stray dev server on 4174" in the environment notes.
- **Evidence:** reproduced in both ku0 e2e runs (PIDs 48328/48332/48339 and 59583/59607/59653, all
  started mid-run, with the outer pnpm's PPID 1). ku0 stopped them after each run.
- **Suggested fix:** spawn with `detached: true` and kill the process group
  (`process.kill(-demoServer.pid, 'SIGTERM')`), or call vite's binary directly instead of going through
  `pnpm exec`. CI is unaffected, because it does not reuse servers and its runner is torn down.

## 2. `paja-llm.spec.ts` l.101-104: one-shot read of a reloading frame

- **What:** after the toggle is clicked to `disabled`, the spec checks `body` for `LLM probe`, which the old
  frame already contains, then reads `typeof window.napplet.llm` once. When the reload has not finished,
  the old frame still reports `object`.
- **Evidence:** failed once in the first ku0 full run (`Expected "undefined", Received "object"`). Then
  passed 1/1 in isolation and 3/3 with `--repeat-each=3`. Main CI at `f5c3ee82` is green.
- **Suggested fix:** wrap the read in `expect.poll(...)`.

## 3. `paja-intent-links.spec.ts` l.223: include-checkbox click race

- **What:** `locator.check: Clicking the checkbox did not change its state` on the first
  `Include subject` checkbox in the intent builder dialog.
- **Evidence:** failed once in the first ku0 full run. Then passed 19/19 in isolation and 3/3 with
  `--repeat-each=3`.
- **Suggested fix:** wait until the builder has rendered its parameter rows before calling `check()`, or
  retry the check through `expect(...).toPass()`.
