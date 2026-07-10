---
status: complete
created: 2026-07-10
quick_id: 260710-hmp
slug: make-paja-useful-for-development-with-runtime-tabs
---

# Make Paja useful for development with runtime tabs

## Target

Make the static `/web/paja/` runtime useful for loading real pointer-resolved
napplets:

- load the supplied Good Morning Protocol `naddr`
- support multiple loaded napplets as closeable header tabs
- create a tab every time a napplet is loaded
- show an in-page duplicate dialog with `load it again`, `open it in tab`, and
  `cancel` choices when the resolved napplet is already running
- keep local target-url mode as a single-iframe authoring runtime
- verify with real browser smoke, focused Paja tests, and repo gates

## Spec Check

- Checked local `napplet/naps` overview and `NAP-SHELL`: this branch does not
  add or change NAP wire fields.
- Checked `@napplet/nap` package surface: Paja still injects existing active web
  NAP domains; tabbing only creates distinct host runtime sessions/window IDs.
- NAP-KEYS behavior is unchanged by this work.

## Implementation Plan

1. Extend runtime-pointer host HTML with a tab strip, tab stage, empty state, and
   duplicate-load dialog.
2. Split browser helpers into tab lifecycle and target-frame modules.
3. Route incoming messages by source iframe/tab and preserve per-tab window IDs.
4. Resolve duplicate pointers by canonical resolved target key
   `(kind, pubkey, dTag, aggregateHash)`.
5. Generate `__kehto/config.json` in the static Paja Pages artifact to avoid
   optional config refresh 404s.
6. Update tests, docs, package doc version rows, and changeset.
7. Run focused, browser, and full repo verification before opening a PR.

## Verification Plan

- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja test:unit`
- `pnpm --filter @kehto/paja build`
- static `/web/paja/` Playwright smoke against the supplied `naddr`
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `node scripts/build-paja-pages.mjs`
- `node scripts/audit-pages-artifact.mjs`
- `npx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
