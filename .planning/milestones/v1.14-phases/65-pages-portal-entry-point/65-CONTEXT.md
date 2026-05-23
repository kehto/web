# Phase 65: Pages Portal Entry Point - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the public `/web/` entry point for the GitHub Pages artifact. This phase owns the static Kehto portal page and the shared artifact root contract. It does not move the playground yet and does not publish docs yet.

</domain>

<decisions>
## Implementation Decisions

### Artifact Root
- Upload root must contain a `web/` directory so GitHub Pages serves `https://kehto.github.io/web/`.
- The portal source should live in repo-controlled static content, not be assembled by unrelated runtime code.
- The packer should fail closed when the portal source is missing.
- Keep the packer dependency-free and Node-only.

### Portal Content
- The entry page should be static HTML/CSS with direct links to `/web/playground/` and `/web/docs/`.
- It should identify Kehto as the runtime-side package set for sandboxed Nostr napplets.
- It should avoid depending on playground JavaScript, VitePress runtime, or remote assets.
- It should use quiet, utilitarian styling appropriate for developer documentation and runtime tooling.

### the agent's Discretion
All visual and copy details are at the agent's discretion as long as the required links and static artifact contract are preserved.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-playground-pages.mjs` already uses dependency-free Node filesystem helpers for static Pages packaging.
- `.gitignore` already excludes `.pages/`.
- Root `package.json` already exposes Pages-related scripts.

### Established Patterns
- Build and audit scripts live under `scripts/*.mjs`.
- GitHub Pages artifacts are generated under `.pages/`.
- Existing scripts fail closed with explicit missing-file errors.

### Integration Points
- Phase 65 adds the shared `.pages/web/` root; later phases will place playground and docs under that directory.
- The GitHub Actions Pages workflow will eventually upload `.pages`.

</code_context>

<specifics>
## Specific Ideas

User requested a slash page for Kehto with links to playground and docs.

</specifics>

<deferred>
## Deferred Ideas

- Moving playground to `/web/playground/` is Phase 66.
- Publishing docs to `/web/docs/` and deploy verification is Phase 67.

</deferred>
