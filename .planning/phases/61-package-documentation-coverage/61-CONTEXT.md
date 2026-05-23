# Phase 61: Package Documentation Coverage - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Autonomous smart discuss

<domain>
## Phase Boundary

Make every public package and the playground consistently documentable and verifiable. The phase creates authored package reference pages that are grounded in package manifests, source barrels, and existing READMEs.

</domain>

<decisions>
## Implementation Decisions

### Package pages

Create one package reference page per package:

- `@kehto/acl`
- `@kehto/runtime`
- `@kehto/shell`
- `@kehto/services`
- `@kehto/nip66`
- `@kehto/wm`
- `@kehto/playground`

### Export/source rule

Document manifest entry points and primary exports from the package `package.json` and `src/index.ts`. Avoid inventing signatures; link to TypeDoc where it exists and mark package API targets that will be generated later.

### README relationship

Package READMEs stay npm/GitHub entry points. Docs-site package pages are the navigable package-reference layer and should link back to READMEs where useful instead of replacing them.

</decisions>

<code_context>
## Existing Code Insights

- `typedoc.json` currently includes `acl`, `runtime`, `shell`, and `services`.
- Local generated docs currently include module files for `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, and `@kehto/services`.
- `@kehto/nip66`, `@kehto/wm`, and `@kehto/playground` need stable API/reference placeholders until TypeDoc and site integration phases wire them.
- `@kehto/wm` currently exports TypeScript source directly from `src/index.ts`, unlike the dist-based public packages.

</code_context>

<specifics>
## Specific Ideas

- Add `docs/packages/index.md` as package reference hub.
- Add seven package pages under `docs/packages/`.
- Each page includes purpose, install/run command, peer dependencies or private status, entry points, primary APIs, scope boundaries, API reference target, and verification source.

</specifics>

<deferred>
## Deferred Ideas

- TypeDoc config updates for `nip66` and `wm`: Phase 63.
- Automated package docs coverage script: Phase 64.

</deferred>
