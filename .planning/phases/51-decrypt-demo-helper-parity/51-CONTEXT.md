# Phase 51: Decrypt Demo Helper Parity - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; focused helper-surface migration

<domain>
## Phase Boundary

Move `apps/playground/napplets/decrypt-demo` from the old shim/vite-plugin package graph and local raw `identity.decrypt` request/reply plumbing to the published `@napplet/nub@0.3.0` `identityDecrypt` helper. Preserve the existing decrypt-demo DOM sentinel behavior and Playwright coverage.

</domain>

<decisions>
## Implementation Decisions

### Helper Import Surface
- Use `@napplet/nub/identity/sdk` for `identityDecrypt`, matching the v1.9 direct helper import convention for shim-loaded demos.
- Keep `@napplet/shim` imported for shell handshake/global installation.

### Error Mapping
- Convert `identityDecrypt()` rejections into the existing `error:<code>` DOM strings by reading `Error.message`, because the helper documents typed error codes as the thrown error message.

### Package Graph
- Pin `@napplet/shim`, `@napplet/nub`, and `@napplet/vite-plugin` to exact `0.3.0`.
- Run `pnpm install` after manifest edits so `pnpm-lock.yaml` retires the old decrypt-demo importer graph.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/e2e/decrypt-demo.spec.ts` already covers all happy-path decrypt modes and the class-2 forbidden short-circuit.
- The existing demo UI helpers (`setText`, `log`, `parsePayload`) can stay unchanged.

### Established Patterns
- v1.9 migrated shim-loaded demos to `@napplet/nub/<domain>/sdk` helper imports.
- Package manifests use exact `0.3.0` pins for active demo helper packages.

### Integration Points
- `apps/playground/napplets/decrypt-demo/src/main.ts` receives fixture payloads from the parent shell.
- The playground shell host publishes deterministic fixtures and class changes through existing test hooks.

</code_context>

<specifics>
## Specific Ideas

- Delete `requestCounter`, the pending response map, and raw `window.parent.postMessage({ type: 'identity.decrypt', ... })`.
- Keep the parent `demo.decrypt.fixtures` listener.
- Run focused decrypt-demo build and Playwright spec before closing the phase.

</specifics>

<deferred>
## Deferred Ideas

Regression guard expansion and full workspace verification are Phase 52.

</deferred>
