# Phase 67: Docs Pages Publication and Deploy Gate - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Publish the VitePress docs under `/web/docs/`, upload a single unified GitHub Pages artifact, and add verification that fails when the portal, playground, docs, or gateway route shape is missing.

</domain>

<decisions>
## Implementation Decisions

### Docs Publication
- The public docs base path is `/web/docs/`.
- VitePress should continue using `VITEPRESS_BASE` as the base-path control.
- The Pages artifact must include both VitePress output and generated TypeDoc output under `/web/docs/api/`.
- Reuse `pnpm docs:check` so docs publication cannot bypass the v1.13 docs quality gate.

### Unified Deploy Gate
- The GitHub Pages workflow should upload `.pages`, not a nested playground directory.
- The workflow should set explicit `PLAYGROUND_BASE_PATH=/web/playground/` and `VITEPRESS_BASE=/web/docs/`.
- Add a local audit command that checks `.pages/web/index.html`, `.pages/web/playground/`, `.pages/web/docs/`, and representative static gateway/API routes.
- Keep the existing Build workflow docs gate unchanged for non-Pages CI.

### the agent's Discretion
The exact audit implementation is at the agent's discretion, but it must be dependency-free and suitable for local and CI use.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/.vitepress/config.ts` already uses `process.env.VITEPRESS_BASE ?? '/'`.
- `pnpm docs:check` already runs strict TypeDoc, VitePress build, and docs audits.
- `scripts/build-pages.mjs` now creates `.pages/web/` and includes playground output.

### Established Patterns
- Repo audits are dependency-free Node scripts under `scripts/`.
- GitHub Actions workflows run install, build, type-check, audits, then upload artifacts.
- Generated folders `.pages/`, `docs/api/`, and `docs/.vitepress/dist/` are ignored build outputs.

### Integration Points
- `scripts/build-pages.mjs` should copy `docs/.vitepress/dist` to `.pages/web/docs`.
- `scripts/build-pages.mjs` should copy generated TypeDoc output from `docs/api` to `.pages/web/docs/api`.
- `.github/workflows/playground-pages.yml` should run `pnpm audit:pages` before `actions/upload-pages-artifact`.

</code_context>

<specifics>
## Specific Ideas

The requested target URL is `kehto.github.io/web/docs`.

</specifics>

<deferred>
## Deferred Ideas

- Custom domain, analytics, and post-deploy live URL browser smoke remain future work.

</deferred>
