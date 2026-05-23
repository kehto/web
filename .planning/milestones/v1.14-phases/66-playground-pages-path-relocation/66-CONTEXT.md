# Phase 66: Playground Pages Path Relocation - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the existing playground Pages artifact from a root playground-only upload shape to the unified `/web/playground/` segment. This phase owns playground base path, playground output directory, and static NIP-5A gateway metadata paths.

</domain>

<decisions>
## Implementation Decisions

### Playground Base Path
- The public playground base path is `/web/playground/`.
- Do not derive the public path from `github.event.repository.name`.
- Keep `PLAYGROUND_BASE_PATH` support so local and CI builds can override explicitly.
- The packer must fail if `apps/playground/dist/index.html` was built for a different base path.

### Artifact Layout
- The unified Pages artifact root remains `.pages/web/` from Phase 65.
- Playground files must live under `.pages/web/playground/`.
- Static gateway manifests must live under `.pages/web/playground/napplet-gateway/<dTag>/manifest.json`.
- Gateway `htmlUrl` values must point to `/web/playground/napplet-gateway/<dTag>/<aggregateHash>/index.html`.

### the agent's Discretion
Keep the existing static gateway materialization logic and make only the path/output changes required by the new public contract.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-playground-pages.mjs` already copies playground dist and materializes static gateway routes.
- `apps/playground/vite.config.ts` already normalizes `PLAYGROUND_BASE_PATH`.
- `apps/playground/src/shell-host.ts` already fetches gateway manifests through `import.meta.env.BASE_URL`.

### Established Patterns
- The playground packer validates the built Vite asset base before copying.
- Gateway metadata is generated from each napplet `.nip5a-manifest.json`.
- Console output reports artifact path, napplet count, and base path.

### Integration Points
- `scripts/build-pages.mjs` should invoke the playground packer with `PLAYGROUND_PAGES_OUT_DIR=.pages/web/playground`.
- Phase 67 will update the GitHub Actions workflow to use the explicit `/web/playground/` base.

</code_context>

<specifics>
## Specific Ideas

The requested target URL is `kehto.github.io/web/playground`.

</specifics>

<deferred>
## Deferred Ideas

Docs publication and unified workflow upload are Phase 67.

</deferred>
