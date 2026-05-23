# Phase 60: Content Strategy and Docs Information Architecture - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Autonomous smart discuss

<domain>
## Phase Boundary

Establish the documentation structure before writing or moving content. This phase defines reader personas, documentation jobs, taxonomy, start paths, migration archive boundaries, content source-of-truth rules, and the proposed VitePress navigation shape.

</domain>

<decisions>
## Implementation Decisions

### Reader groups

Use four primary reader groups:

| Reader | Primary job |
|--------|-------------|
| Host-app implementer | Build a shell that embeds sandboxed napplets. |
| Package API consumer | Pick and use one `@kehto/*` package correctly. |
| Napplet author | Declare requirements and use NUB helpers safely inside a hosted iframe. |
| Maintainer | Keep docs, generated API reference, package READMEs, and milestone history aligned. |

### Documentation taxonomy

Use a Diataxis-style split without naming it in navigation: Start, Concepts, Tutorials, How-tos, Package Reference, API Reference, Policies, and Migration Archive.

### Source-of-truth rule

Package READMEs remain npm/GitHub package entry points. The docs site links to them and may carry expanded guides, but package README facts must not be contradicted. Generated API reference stays under `docs/api/` and is linked from package docs instead of duplicated.

### Archive boundary

Migration docs under `docs/migrations/` are terminal historical snapshots. They can be indexed, but every entry point must label them as historical and redirect current integration readers to active package/tutorial docs.

</decisions>

<code_context>
## Existing Code Insights

- Root `typedoc.json` writes generated API reference to `docs/api/` for `acl`, `runtime`, `shell`, and `services`.
- Package READMEs already exist for `acl`, `runtime`, `shell`, `services`, `nip66`, and `wm`.
- `apps/playground/README.md` documents the 13-napplet demo and gateway artifact path.
- `docs/migrations/README.md` already says migration documents are terminal-state snapshots.
- There is no existing VitePress config or docs-owned package metadata.

</code_context>

<specifics>
## Specific Ideas

- Create `docs/index.md` as the public docs entry path.
- Create `docs/strategy/content-strategy.md`, `docs/strategy/information-architecture.md`, and `docs/strategy/maintenance.md`.
- Keep Phase 60 implementation to docs strategy and navigation design; defer VitePress config to Phase 63.

</specifics>

<deferred>
## Deferred Ideas

- Package-specific docs pages: Phase 61.
- Tutorials/how-tos/troubleshooting content: Phase 62.
- VitePress dependency/config/build scripts: Phase 63.
- Link/package docs verification scripts and CI: Phase 64.

</deferred>
