---
status: complete
completed: 2026-07-10
quick_id: 260710-hmp
slug: make-paja-useful-for-development-with-runtime-tabs
---

# Make Paja useful for development with runtime tabs

## Delivered

- Added closeable runtime-pointer tabs to the static Paja Runtime header.
- Added an in-page duplicate dialog with the exact text
  `this napplet is already running.` and the requested actions.
- Preserved local target-url mode as a single iframe.
- Split browser host code into focused tab lifecycle and target-frame helpers.
- Routed runtime messages by source iframe so each loaded tab has a distinct
  `kehto-paja-window:tab-N:generation` session/window ID.
- Wrote `__kehto/config.json` into the static Pages artifact and audited it so
  the browser host no longer falls back through a missing config request.
- Updated Paja docs, package docs version rows, focused source guards, host page
  tests, and the `@kehto/paja` changeset.

## Spec Check

- Checked `/home/sandwich/Develop/naps/README.md` and
  `/home/sandwich/Develop/naps/naps/NAP-SHELL.md`.
- Checked `/home/sandwich/Develop/napplet/packages/nap/README.md`.
- Result: no NAP wire contract changed; the branch only changes host/runtime
  composition around existing web projection injection and ShellBridge traffic.
  NAP-KEYS behavior is unchanged.

## Browser Proof

- Served regenerated `.pages` through `scripts/serve-pages.mjs` at
  `http://127.0.0.1:4185/web/`.
- Loaded the supplied Good Morning Protocol `naddr`.
- Observed iframe text sample:
  `GM ... no GMs from your contacts today`.
- Duplicate dialog title matched exactly:
  `this napplet is already running.`
- `open it in tab` kept one tab.
- `load it again` produced two ready tabs and two iframes.
- Closing the active duplicate returned to one ready tab/iframe.
- Final state: `status=ready`, `tabTitle=Good Morning Protocol`,
  `pointerStatus=good-morning:c922cf30dc1e`,
  `aggregateHash=c922cf30dc1e12b135462057631ba3017cdaeea591725f077c5a20a6d9967b68`.
- Browser proof had `pageErrors=[]`, `consoleErrors=[]`, and `notFound=[]`.
- Screenshot: `/tmp/paja-tabs-loaded.png`.

## Verification

- `pnpm --filter @kehto/paja type-check` passed.
- `pnpm --filter @kehto/paja test:unit` passed: 10 files, 45 tests.
- `pnpm --filter @kehto/paja build` passed.
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1`
  passed: 4 tests.
- `pnpm build` passed.
- `pnpm type-check` passed.
- `pnpm test:unit` passed: 102 files, 1300 tests.
- `pnpm docs:check` passed.
- `node scripts/build-paja-pages.mjs` passed.
- `node scripts/audit-pages-artifact.mjs` passed.
- `npx aislop@0.12.0 scan --changes --base origin/main` passed: 100/100.
- `git diff --check` passed.

## Notes

- The first final browser smoke used a 20s duplicate-dialog timeout and hit relay
  resolution latency after the initial load had already reached ready. The same
  smoke passed with a 60s duplicate resolve timeout.
