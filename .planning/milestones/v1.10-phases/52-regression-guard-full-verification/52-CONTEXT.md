# Phase 52: Regression Guard + Full Verification - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; final guard and verification phase

<domain>
## Phase Boundary

Lock the v1.10 cleanup results so the removed identity-topic compatibility path, the old decrypt-demo `0.2.1` helper graph, and the manual decrypt request/reply shim cannot quietly return.

This phase is a guard, documentation, and verification pass. It does not broaden v1.10 into resource/toaster helper migration, host bridge work, CI expansion, or a v2 boundary.

</domain>

<decisions>
## Implementation Decisions

### Guard Scope
- Keep the existing 18-package SDK migration guard intact for packages that consume `@napplet/sdk`.
- Add decrypt-demo as a helper-only migration target because it intentionally has no `@napplet/sdk` dependency but must still stay on exact `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` `0.3.0`.
- Add decrypt-demo source assertions for `identityDecrypt` and against the deleted raw-envelope plumbing (`requestCounter`, pending response map, and direct `identity.decrypt` postMessage requests).

### Lockfile Scope
- Check the active lockfile graph for old napplet helper package resolutions that v1.10 retired: `@napplet/shim@0.2.1`, `@napplet/vite-plugin@0.2.1`, `@napplet/core@0.2.1`, and split `@napplet/nub-* @0.2.1` package keys.
- Allow unrelated third-party `0.2.x` packages in `pnpm-lock.yaml`; the milestone target is the napplet helper graph, not every version string containing `0.2`.

### Documentation Scope
- Update current source/release-note teaching to point to `identity:changed` and `identityDecrypt`.
- Leave historical changesets and migration documents as point-in-time records unless they describe current v1.10 behavior incorrectly.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/unit/sdk-migration-guard.test.ts` is already included by `pnpm test:unit` and covers migrated demo/fixture manifests plus legacy `@napplet/sdk` namespace imports.
- `packages/shell/src/shell-bridge.test.ts` covers canonical `identity:changed` single emission and deprecated literal-topic behavior.
- `tests/e2e/decrypt-demo.spec.ts` covers decrypt-demo happy paths and class-2 forbidden behavior through the built preview.

### Current Gaps
- `decrypt-demo` is not yet represented in the SDK migration guard because it was outside the v1.9 `@napplet/sdk` namespace-export migration set.
- Current comments still describe decrypt-demo as posting `identity.decrypt` requests without naming the new helper.
- README/config-service text still contains stale `0.2.1` package-graph references that no longer describe the current install surface.

</code_context>

<specifics>
## Specific Ideas

- Split guard package groups into `sdkTargetDirs` and `helperTargetDirs` so decrypt-demo can be exact-0.3 guarded without requiring `@napplet/sdk`.
- Add lockfile package-key assertions for the old helper graph.
- Add a v1.10 changeset for `@kehto/playground` describing decrypt-demo helper parity.
- Run focused guard/shell tests first, then full `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and `pnpm test:e2e`.

</specifics>

<deferred>
## Deferred Ideas

- Resource-demo and toaster raw-envelope rewrites remain deferred until upstream helper coverage exists.
- Host bridge reference implementations and multi-OS CI matrix expansion stay in future requirements.

</deferred>
