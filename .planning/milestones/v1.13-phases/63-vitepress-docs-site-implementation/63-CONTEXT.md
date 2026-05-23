# Phase 63: VitePress Docs Site Implementation - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Autonomous smart discuss

<domain>
## Phase Boundary

Add docs-owned VitePress site configuration, docs workspace metadata, monorepo scripts, TypeDoc entrypoint integration, and authored index pages required by the VitePress navigation. This phase wires the site build; quality-gate scripts and CI checks are deferred to Phase 64.

</domain>

<decisions>
## Implementation Decisions

### Dependency isolation

Install VitePress as a docs-owned workspace package under `docs/package.json`. Do not add VitePress metadata to root except for root scripts that delegate into the docs workspace.

### Version

Use `vitepress@^1.6.4`, the current `latest` dist-tag from npm. Avoid `next` because it is `2.0.0-alpha.*`.

### Build shape

Root `docs:site:build` must generate TypeDoc first, then run the docs VitePress build. The docs package build itself only builds VitePress so Turborepo can run it directly.

### TypeDoc

Add `@kehto/nip66` and `@kehto/wm` to `typedoc.json` so every public package has a generated API reference target. Playground remains private and excluded from API generation.

</decisions>

<code_context>
## Existing Code Insights

- Official VitePress docs recommend a nested `docs/` root for existing projects and note that VitePress is ESM-only.
- Node 22 and pnpm 10 satisfy VitePress requirements.
- Existing generated API docs live under `docs/api/` and are gitignored.
- Current `typedoc.json` includes `acl`, `runtime`, `shell`, and `services` only.

</code_context>

<specifics>
## Specific Ideas

- Add `docs/.vitepress/config.ts`.
- Add `docs/package.json`.
- Add docs workspace to `pnpm-workspace.yaml`.
- Add root docs scripts and Turbo `docs:build` task.
- Add `docs/reference/api.md`, `docs/policies/index.md`, `docs/migrations/index.md`, and concept pages to satisfy navigation targets.

</specifics>

<deferred>
## Deferred Ideas

- Automated nav/package/link checking: Phase 64.
- CI wiring: Phase 64.

</deferred>
