# Vendored: Floorplan 0.11.0

This folder holds the Floorplan skill, copied verbatim from the Floorplan Claude Code
plugin version 0.11.0 (`skills/floorplan/`, MIT, © 2026 Hayden Smith; see `LICENSE`).
The bundled ELK layout engine and fonts keep their own licenses under
`assets/vendor/`.

It's vendored so the per-package maps can be refreshed and published without the
plugin installed: in CI (`scripts/floorplans.mjs check`), in the Pages build
(`scripts/floorplans.mjs pages`) and by the weekly scheduled refresh agent.

## Kehto patches

Both patches sit in `scripts/lib/common.mjs`, in `keepOutOfGit`, marked `KEHTO PATCH`.

1. Upstream writes a `floorplan/.gitignore` that ignores the whole map folder. Kehto
   commits the map inputs (`architecture.json`, `descriptions/`, `baseline.json`), so
   the patched file ignores only generated output: `.cache/`, `graph.json`,
   `index.html`, the copied `serve.mjs`, `query.mjs` and `page-safety.mjs`,
   `recent-work.json` and exports.
2. The "files in floorplan/ are tracked by git" warning skips those committed inputs.

## Upgrading

Copy the new release's `skills/floorplan/` over this folder, then re-apply the two
patches. Keep `LICENSE` and this file. Next, run `node scripts/floorplans.mjs check`
and `pnpm build:pages` and fix anything they report.
