# Phase 49: Migration Guard + Full Verification - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; verification and guard phase

<domain>
## Phase Boundary

Lock the SDK 0.3 migration by adding a regression guard over the 18 migrated package directories, cleaning stale namespace-teaching prose, proving the lockfile no longer resolves old SDK for the active graph, and running the full build/typecheck/unit/E2E loop.
</domain>

<decisions>
## Implementation Decisions

### Guard placement

Use a Vitest unit guard under `tests/unit/` so the normal `pnpm test:unit` gate fails if a migrated package reintroduces `from '@napplet/sdk'` or drifts off exact `0.3.0` package versions. This is stronger than a standalone script because it runs in the existing unit suite.

### Documentation cleanup

Update comments and fixture README text that still described old namespace imports as the current SDK pattern. Preserve wire-envelope names such as `relay.publish`, `identity.getPublicKey`, and `storage.get` when they are explicitly describing debugger/envelope assertions rather than source import style.

### Lockfile proof

`decrypt-demo` remains out of scope and still carries old shim/vite-plugin package entries; Phase 49 proof must distinguish those unrelated legacy lockfile entries from the 18 migrated active package graph.
</decisions>

<code_context>
## Existing Code Insights

- Phase 47 and 48 targeted builds passed.
- Active demo/fixture source has no `@napplet/sdk` imports after Phase 48.
- `pnpm-lock.yaml` still contains `@napplet/shim@0.2.1`, `@napplet/vite-plugin@0.2.1`, and old split-nub packages because `decrypt-demo` is explicitly excluded from the 18-package scope.
- `pnpm test:e2e` baseline entering v1.9 is 86 passed / 0 failed / 0 skipped.
</code_context>

<specifics>
## Specific Ideas

- Run `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e`.
- If `pnpm type-check` surfaces type drift from direct helper imports, fix the import/manifest shape rather than weakening the guard.
- Record final E2E count exactly in the verification artifact.
</specifics>

<deferred>
## Deferred Ideas

- `decrypt-demo` can migrate to `identityDecrypt` in a separate follow-up because it is not one of the 18 SDK-bearing packages.
- Resource wire convergence with upstream `@napplet/nub/resource` remains a future runtime/service migration.
</deferred>
