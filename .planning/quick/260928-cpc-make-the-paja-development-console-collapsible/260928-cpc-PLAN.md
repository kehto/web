---
quick_id: 260928-cpc
status: complete
description: Make the Paja development console collapsible to the left
---

# Quick Task 260928-cpc Plan

The Paja host page puts its whole development surface (pointer entry, interface
toggles, ACL, signer, message log) in a fixed left column that always claims
320-380px of the stage. Napplet authors need that width back when they are
looking at the app rather than the controls, without losing the panel or
reloading the napplet.

Add one directional toggle that collapses the left column and restores it:
expanded by default, one click to collapse to the left, one click to bring it
back.

## Task 1: Host page layout and toggle markup

- Add `id="paja-console"` to the console `aside` and a chevron toggle button in
  the top bar, before the runtime tabs, that stays visible in both states.
- Collapse through one `data-paja-console` attribute on the document root:
  the console cell and the console column are removed, `main`/`.top` fall back
  to a single full-width column, and the stage gets the reclaimed width.
- Collapse with CSS only, in both the wide (side-by-side) and narrow (stacked)
  layouts, so toggling never navigates or recreates the target iframe.

## Task 2: Persistence controller

- Add `browser-console-panel.ts`: parse the stored preference (anything that is
  not `collapsed` is `expanded`), apply the state attribute plus
  `aria-expanded`/`aria-label`, persist the choice per browser origin, and keep
  the toggle listener host-owned.
- Wire it first thing in `installPajaHost()` so the stored preference applies
  before any runtime work awaits, and dispose the listener on `pagehide`.

## Task 3: Guards and docs

- Unit-test the state parse/apply/persist paths against a fake document, root,
  button, and storage, including a failing storage backend and a missing button.
- Extend the host-page render guard with the toggle markup, the `aria-controls`
  relationship, the collapsed CSS contract, and the expanded default.
- Extend the Paja Playwright spec: collapse hides the console and widens the
  stage, the napplet keeps running (same generation and load id), the choice
  survives a host reload, and the same button restores it.
- Document the control in the root README, the package README, `docs/packages/paja.md`,
  and the local-authoring how-to, plus a minor `@kehto/paja` changeset.
