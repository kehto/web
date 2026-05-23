# Docs Site Runbook

Use this guide when updating the VitePress site, package reference pages, or generated API reference.

## Local Commands

| Task | Command |
|------|---------|
| Install workspace dependencies | `pnpm install` |
| Generate API reference only | `pnpm docs:api` |
| Generate API reference with warning failures | `pnpm docs:api:strict` |
| Start VitePress locally | `pnpm docs:site:dev` |
| Build the site | `pnpm docs:site:build` |
| Run the full docs gate | `pnpm docs:check` |

`pnpm docs:check` is the phase-close command for documentation-only changes. It runs strict TypeDoc generation, builds VitePress, and audits package docs, API links, navigation routes, and CI wiring.

## Add a Package Page

1. Add `docs/packages/<slug>.md`.
2. Include manifest facts, install command, peer dependencies or dependency status, primary APIs, scope boundaries, and API reference links.
3. Add the package to `docs/packages/index.md`.
4. Add the package route to `docs/.vitepress/config.ts`.
5. Add the package entrypoint to `typedoc.json` if it is a public package.
6. Run `pnpm docs:check`.

Private demos such as `@kehto/playground` need package docs and navigation, but do not need TypeDoc entrypoints.

## Add a Guide or How-to

1. Place task-shaped recipes under `docs/how-tos/`.
2. Place durable explanations under `docs/guides/`.
3. Add the page to the nearest index page.
4. Add sidebar navigation only when the page should be a top-level route.
5. Run `pnpm docs:check`.

## Generated API Reference

Do not hand-edit `docs/api/`. It is generated from source packages by TypeDoc and ignored by git.

When an API link goes stale:

1. Run `pnpm docs:api`.
2. Find the generated target under `docs/api/`.
3. Update the authored Markdown link.
4. Run `pnpm docs:check`.

## Migration Archive

Historical migration pages remain under `docs/migrations/`. Keep archive warnings intact and promote only current guidance into `docs/concepts/`, `docs/tutorials/`, `docs/how-tos/`, or `docs/guides/`.
