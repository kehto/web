---
status: resolved
trigger: "kehto paja --target-url http://127.0.0.1:5173 -- vite opens Paja at 127.0.0.1:5197, but the iframe points at 127.0.0.1:5173 while Vite bound localhost:5174, so Firefox shows Unable to connect."
created: 2026-06-30
updated: 2026-06-30
---

# Debug Session: Paja Managed Target Port

## Symptoms

- Expected behavior: `kehto paja --target-url http://127.0.0.1:5173 -- vite` should show the managed napplet app inside Paja.
- Actual behavior: Paja loads, but its iframe displays Firefox "Unable to connect" for `127.0.0.1:5173`.
- Error messages: The managed child logs `VITE v8.0.16 ready` with `Local: http://localhost:5174/`.
- Timeline: Reported from a live run on 2026-06-30.
- Reproduction: Run `pnpm run paja` in `/home/sandwich/Develop/hyprgate/napplets/feed`; script runs `kehto paja --target-url http://127.0.0.1:5173 -- vite`.

## Current Focus

- hypothesis: Paja stores and renders the configured `targetUrl` once, but managed Vite may auto-select a different port when the requested port is unavailable.
- test: Inspect Paja CLI managed-command startup, host-page rendering, and readiness code; reproduce with a forced alternate Vite port if needed.
- expecting: Runtime URL stays healthy while target iframe is stale at the configured URL.
- next_action: gather initial evidence

## Evidence

- 2026-06-30: `packages/paja/src/cli.ts` rendered the Paja server and inline host config before launching the managed command, then waited on only the configured `options.targetUrl`.
- 2026-06-30: `packages/paja/src/host-page.ts` embedded `config.target.url` into the iframe bootstrap, so the browser had no path to consume a corrected managed target URL after the child process selected a different port.
- 2026-06-30: Added focused regressions for updating served host config when the managed target announces `http://localhost:5174/` and for CLI-managed target URL update behavior.
- 2026-06-30: Verification passed: `pnpm --filter @kehto/paja type-check`, `pnpm --filter @kehto/paja test`, `pnpm --filter @kehto/paja build`, and `git diff --check`.

## Eliminated

- Paja runtime server bind failure: eliminated by the live symptom and tests showing the runtime served successfully at `127.0.0.1:5197`.
- Browser-only iframe failure: eliminated by source inspection; the stale target URL was generated server-side before browser navigation.

## Resolution

- root_cause: Managed-command mode treated `--target-url` as immutable even when the child dev server chose a different local port.
- fix: Capture managed child stdout/stderr, detect the first local HTTP URL, wait for it to become ready, update the running Paja host config, and have browser startup fetch `/__kehto/config.json` before navigating the iframe.
- verification: `pnpm --filter @kehto/paja type-check`; `pnpm --filter @kehto/paja test`; `pnpm --filter @kehto/paja build`; `git diff --check`.
- files_changed: `packages/paja/src/cli.ts`, `packages/paja/src/server.ts`, `packages/paja/src/browser-host.ts`, `packages/paja/src/node-compat.d.ts`, `packages/paja/src/cli.test.ts`, `packages/paja/src/server.test.ts`.
