# Phase 73: Runtime Core Decomposition - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all runtime-core structural scanner warnings from `packages/runtime/src/runtime.ts` while preserving the runtime public API, NIP-5D message behavior, ACL enforcement, relay semantics, session registry access, manifest/ACL persistence, and runtime package tests.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
- This is infrastructure-only refactor work; implementation choices are at the agent's discretion.
- Prefer moving existing nested runtime handlers into focused runtime-local modules over changing protocol behavior.
- Keep extraction boundaries behavior-preserving and test-driven by existing runtime unit coverage.
- Do not alter `.aislop/config.yml`, package exports, or public runtime types to satisfy scanner warnings.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/runtime/src/event-buffer.ts` already owns subscription buffering and filter matching helpers.
- `packages/runtime/src/state-handler.ts` already isolates storage NUB handling.
- `packages/runtime/src/service-dispatch.ts` already owns service-dispatch lifecycle helpers.
- Runtime unit coverage lives in `packages/runtime/src/runtime.test.ts`, `dispatch.test.ts`, `discovery.test.ts`, `notify-dispatch.test.ts`, and `state-handler.test.ts`.

### Established Patterns
- Runtime modules use local `.js` imports and TypeScript source modules compiled by package tooling.
- Runtime handlers preserve fallbacks when an optional service is absent.
- Tests exercise behavior through `createRuntime(hooks).handleMessage(...)` rather than private handler exports.

### Integration Points
- `createRuntime` remains exported from `packages/runtime/src/runtime.ts` and re-exported by `packages/runtime/src/index.ts`.
- Extracted handler modules must consume existing runtime state through explicit context objects rather than new globals.
- `npx --no-install aislop scan -d` is the source of truth for the warning baseline.

</code_context>

<specifics>
## Specific Ideas

- Starting scanner baseline: `64 / 100 Needs Work`, 0 errors, 16 warnings, 0 fixable.
- Runtime findings in scope: `runtime.ts` file too large, `createRuntime` too long/deep, and `handleRelayMessage` too long/deep.

</specifics>

<deferred>
## Deferred Ideas

- Playground shell decomposition remains Phase 74.
- Service and adapter decomposition remains Phase 75.
- Final all-gate proof remains Phase 76.

</deferred>
