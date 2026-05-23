# Phase 64: Reference Integration and Docs Quality Gates - Context

**Gathered:** 2026-05-23
**Status:** Ready for execution
**Mode:** Autonomous smart discuss

<domain>
## Phase Boundary

Add repeatable documentation verification for the v1.13 docs system. This phase owns strict TypeDoc generation, VitePress build gating, package docs/API reference drift checks, CI wiring, an authoring runbook, and final no-runtime-regression proof. It may make additive type-export repairs required to make generated API docs complete, but must not change runtime protocol behavior.

</domain>

<decisions>
## Implementation Decisions

### Strict TypeDoc

Use `typedoc --treatWarningsAsErrors` for the docs gate. The phase repaired existing TypeDoc warnings instead of allowing warning noise to become part of the normal docs workflow.

### Docs audit scope

Use a local Node script with no new dependencies. The script validates package pages, generated TypeDoc module targets, VitePress route coverage, authored API links, and CI command wiring.

### CI integration

Wire `pnpm docs:check` into the existing Build workflow after build/type-check prerequisites. Do not add a separate workflow unless docs deployment or hosted publication becomes in scope later.

</decisions>

<code_context>
## Existing Code Insights

- Phase 63 added `@kehto/docs`, `docs/.vitepress/config.ts`, root docs scripts, and TypeDoc entrypoints for all six public packages.
- TypeDoc warnings were caused by stale `@kehto/acl` README function links and two public-signature helper types not exported from package barrels.
- Existing static guard style uses Node scripts in `scripts/` with root package script entries, e.g. `audit:csp` and `audit:gateway-artifacts`.

</code_context>

<specifics>
## Specific Work

- Add `scripts/audit-docs.mjs`.
- Add root `docs:api:strict` and `docs:check` scripts.
- Update `docs:site:build` to use strict TypeDoc.
- Wire `pnpm docs:check` into `.github/workflows/build.yml`.
- Add docs site runbook and maintenance guidance.
- Run docs gate plus build/type/unit/static verification.

</specifics>

<deferred>
## Deferred Ideas

- Hosted docs publication and custom domain.
- Versioned docs for multiple package release lines.
- Browser proof of the built docs site in CI.

</deferred>
