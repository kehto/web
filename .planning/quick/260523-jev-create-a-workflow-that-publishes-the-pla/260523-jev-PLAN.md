# Quick Task 260523-jev — Publish playground to GitHub Pages

## Request

Create a workflow that publishes the playground to GitHub Pages.

## Constraints

- GitHub Pages is static; the local playground gateway currently serves `/napplet-gateway/...` with Vite middleware.
- The active playground load path must remain `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.
- Project Pages for `kehto/web` needs a non-root base path.
- Keep the workflow aligned with the existing pnpm + Node 20 GitHub Actions style.

## Plan

1. Add a static Pages artifact builder that copies the playground build and materializes gateway manifests plus hosted napplet HTML routes.
2. Make gateway fetch/navigation URLs base-aware so the same shell works under `/` locally and `/web/` on GitHub Pages.
3. Add a GitHub Pages workflow using `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.
4. Add static guards for the workflow/script/base-aware gateway behavior.
5. Verify with build/type-check/unit/audit commands, then summarize.
