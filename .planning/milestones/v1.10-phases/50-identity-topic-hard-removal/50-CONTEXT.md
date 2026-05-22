# Phase 50: Identity Topic Hard Removal - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; infrastructure/API cleanup with explicit roadmap boundary

<domain>
## Phase Boundary

Remove the one-release identity-topic compatibility branch from `ShellBridge.injectEvent()`. Canonical `identity:changed` host injections should emit once. Deprecated `auth:identity-changed` input should no longer receive any special fan-out behavior and should pass through as a literal topic if a caller still supplies it.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
- Treat Phase 50 as a focused compatibility cleanup, not a broader shell event redesign.
- Preserve the generic `injectEvent(topic, payload)` API shape; only remove the special-case dual emit.
- Keep a regression test for deprecated-topic literal pass-through so future maintainers do not accidentally restore the soft-rename branch.
- Add release-note coverage because the behavior change is observable to host consumers.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shell/src/shell-bridge.test.ts` already spies on `bridge.runtime.injectEvent()` and can assert exact call sequences.
- Existing changesets use pre-1.0 minor bumps for shell behavior changes that downstream hosts must notice.

### Established Patterns
- Shell API docs are generated from JSDoc via `pnpm docs:api`.
- Phase summaries and verifications record focused command evidence before phase completion.

### Integration Points
- `packages/shell/src/shell-bridge.ts` JSDoc and implementation define the public behavior.
- `RUNTIME-SPEC.md` has an IPC peer topic table that should use the canonical identity topic.
- `docs/api/interfaces/_kehto_shell.ShellBridge.html` is the generated API surface for `ShellBridge.injectEvent()`.

</code_context>

<specifics>
## Specific Ideas

- Remove the `OLD_IDENTITY_TOPIC` / `NEW_IDENTITY_TOPIC` branch entirely.
- Update tests to assert single emission for both canonical and deprecated literal topics.
- Regenerate API docs after source JSDoc changes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
