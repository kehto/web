---
quick_id: 260928-cpc
status: complete
completed: 2026-09-28
code_commit: d3706a9c
docs_commit: 40168a5c
---

# Quick Task 260928-cpc Summary

The Paja development console is now a collapsible left column. It still starts
expanded, and one chevron button in the top bar collapses it to the left and
restores it with a single press. The button stays visible in both states and
sits at the left edge when collapsed, so a hidden console is always one click
away.

Collapsing is presentation-only. The state lives as a `data-paja-console`
attribute on the document root, and CSS removes the console column plus its
top-bar cell so `main` and the top bar fall back to one full-width column. The
target iframe is never navigated or recreated: the running napplet keeps its
generation, message log, and shell state while the stage reclaims the width. The
same rules cover the wide side-by-side layout and the stacked `max-width: 900px`
layout, where the console row is what gets reclaimed.

A new `browser-console-panel.ts` controller parses the stored preference
(anything other than `collapsed` means expanded), applies the state attribute,
keeps `aria-expanded` and the accessible name in sync with the action, and
persists the choice per browser origin. Persistence is best-effort: a storage
failure still collapses the console in-session.

The toggle is a directional chevron (`«` expanded, `»` collapsed) rather than a
hamburger, because the action has a direction. A hamburger conventionally opens
a navigation overlay and would not tell the user which way the panel moves.

## Verification

- `pnpm build` — passed (32 tasks)
- `pnpm type-check` — passed (17 tasks)
- `pnpm test:unit` — 150 files, 1,776 tests passed
- `pnpm docs:check` — passed (9 package docs, TypeDoc targets, VitePress routes)
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH= npx playwright test tests/e2e/paja-single-window.spec.ts tests/e2e/paja-runtime-pointer.spec.ts`
  — 12 tests passed, including the new collapse/restore case
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json` — 100/100, zero findings
- Browser check at 1280x720: stage 900x652 → 1280x652, toggle at x=10
- Browser check at 640x720: stage 640x364 → 640x652, toggle at x=8
- `python3 -m http.server 4175 --directory .pages` served the built Pages artifact
  (`/paja/`): the pointer runtime booted `ready` with 17 services, collapsed the console
  (stage 900 → 1280), stayed collapsed through a host reload, restored on one press, and
  logged no console errors or failed requests
- The same host page served in external-target mode (Python stdlib server, host page
  rendered by `renderPajaHtml`) against the built `feed` napplet: `shell.ready`/
  `shell.init` completed, the app stayed live across the toggle, stage 900 → 1280

Local Playwright note: this machine has no `/usr/bin/chromium`, so the focused
runs use the bundled browser via an empty `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
CI keeps using its pinned `/usr/bin/chromium`.

## Out of scope

The branch could not be pushed: the only available GitHub credential
(`sh1ftred`) has `READ` permission on `kehto/web`, so branch push and PR
creation are blocked until a writable credential is provided.

## Rebase onto current `main`

Rebased the three task commits from the old branch point `a7e0d12f`
(Version Packages #270) onto `088a51c8` (Version Packages #273), picking up
`11d9e907` (`paja: add ContextVM framed streaming transport`, #265). The rebase
applied cleanly with no conflicts and no manual resolution.

No semantic overlap: #265 changes `packages/services/src/cvm-nostr-transport.ts`
and package versions, while this task changes `packages/paja/src/browser-console-panel*`,
`packages/paja/src/host-page.ts`, and docs. `docs/packages/paja.md` was touched by
both, but only in disjoint regions — the `| Version | \`0.16.5\` |` row from #273
is intact next to this task's collapsible-console documentation.

Gates re-run at `251e3d2d` on top of `088a51c8`:

- `pnpm build` — passed (32 tasks)
- `pnpm type-check` — passed (17 tasks)
- `pnpm test:unit` — 150 files, 1,801 tests passed (includes #265's new
  `cvm-nostr-transport` suite)
- `pnpm docs:check` — passed (9 package docs, TypeDoc targets, VitePress routes)
- `pnpm test:e2e tests/e2e/paja-single-window.spec.ts tests/e2e/paja-runtime-pointer.spec.ts`
  — 12 passed, including the new collapse/restore case
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` — 100/100, zero findings

Note: a whole-repo `aislop scan` now reports 99/100 because of one pre-existing
warning on `main` — `packages/services/src/cvm-nostr-transport.ts` is 1200 lines
against the 700-line limit, introduced by `11d9e907`. That is upstream debt, not
this branch's; this change is clean at 100/100. Splitting that file belongs in a
separate change.

The push blocker below still applies.
