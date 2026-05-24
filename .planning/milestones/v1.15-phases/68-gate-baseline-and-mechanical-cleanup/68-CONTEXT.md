# Phase 68: Gate Baseline and Mechanical Cleanup - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the supplied `aislop 0.9.3` report reproducible enough for phase execution, then remove low-risk mechanical findings before deeper DOM security and type-safety work. This phase owns the undeclared import error, duplicate imports, unused symbols, unnecessary spread fallbacks, leftover production console calls, and decorative/trivial comments that can be cleaned without changing behavior.

</domain>

<decisions>
## Implementation Decisions

### Infrastructure Cleanup
- Treat the user-supplied `aislop 0.9.3` report as the baseline because `aislop` is not currently installed in the workspace.
- Keep Phase 68 behavior-preserving; do not touch direct `innerHTML` assignments except where a mechanical edit is unavoidable, because DOM security is Phase 69.
- Prefer deleting comments/imports/code over adding wrappers or abstractions.
- Keep intentional script output in `scripts/*.mjs`; Phase 68 targets production app/package source and report-flagged playground code.

### the agent's Discretion
All implementation choices are at the agent's discretion within the phase boundary. If a reported warning requires a broad refactor or behavior lock, defer it to Phase 70 instead of expanding Phase 68.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/playground/package.json` already declares `@kehto/services`, so the `@napplet/services` type import in `apps/playground/src/main.ts` should be corrected to the declared workspace package instead of adding a manifest edge.
- Existing v1.14 verification commands remain the behavior guard: `pnpm build`, `pnpm type-check`, and `pnpm test:unit`.
- Existing audit scripts intentionally use `console.log` for CLI success output and should not be treated as production app leftovers.

### Established Patterns
- Prior milestone artifacts use one plan per phase, a summary file after execution, and `status: passed` verification frontmatter.
- The repo prefers small, reviewable, reversible diffs and no new dependencies without explicit request.
- Playground UI code currently has many narrative section comments and direct DOM construction; only the narrative/mechanical pieces belong to this phase.

### Integration Points
- `apps/playground/src/main.ts` has duplicate imports from `@kehto/shell`, `./debugger.js`, and `./node-inspector.js`, plus the fatal `@napplet/services` type import.
- `apps/playground/src/shell-host.ts` and `apps/playground/src/main.ts` contain report-flagged production `console.info`/`console.log` calls that should either be removed or limited to intentional test hooks.
- `packages/runtime/src/runtime.ts`, `packages/services/src/media-service.ts`, and similar package files contain unnecessary spread fallbacks that can be simplified without behavior changes.

</code_context>

<specifics>
## Specific Ideas

Use the supplied report as a target list for this phase and keep the first pass focused on import/comment/console/spread cleanup. Leave `innerHTML`, unsafe casts, and warning-only complexity to later phases unless a line is already being touched safely.

</specifics>

<deferred>
## Deferred Ideas

- Direct `innerHTML` replacements belong to Phase 69.
- Unsafe cast and dependency warning triage belongs to Phase 70.
- Full function/file-size complexity work is out of scope unless protected by existing tests and low-risk.

</deferred>
