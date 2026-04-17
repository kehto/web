# Phase 14: Dispatch Refactor - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace @kehto/runtime's hand-rolled NUB dispatch switch with napplet/core's formal `createDispatch()` / `registerNub()` / `dispatch()` infrastructure. All 8 domain handlers (relay, identity, keys, media, notify, storage, ifc, theme) are registered through the formal API; the domain-specific switch is deleted.

Out of scope:
- Removing `packages/runtime/src/core-compat.ts` — that shim (DRIFT-CORE-06) covers `Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`, `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `TOPICS.STATE_*` — NOT dispatch-related. Stays until napplet/core re-exports those symbols (upstream concern).
- Changing ACL enforcement semantics — the existing pre-dispatch ACL gate stays in place; it runs before `dispatch(envelope)` is called.
- Rewriting handler internals — Phase 14 is a structural swap, not a behavioral change.

</domain>

<decisions>
## Implementation Decisions

### Dispatch Instance Scope
- Each `createRuntime()` call creates its own `createDispatch()` instance.
- Do NOT use the module-level `registerNub` / `dispatch` singleton from @napplet/core. Per-runtime isolation avoids cross-test pollution and matches the existing kehto pattern (each runtime has its own serviceRegistry, session registry, etc.).
- Store the dispatch instance on the Runtime object (e.g., `runtime._nubDispatch` or equivalent internal field).

### Handler Signature Bridging
- @napplet/core NubHandler: `(message: NappletMessage) => void`.
- Kehto current handlers: `(windowId: string, envelope: NappletMessage) => void | Promise<void>`.
- Bridge: thin one-line adapter per handler at registration time:
  ```ts
  registerNub('relay', (msg) => handleRelayMessage((msg as any).windowId, msg));
  ```
  or, if envelope type carries `windowId`, use a typed helper. `windowId` is already present on every envelope kehto dispatches internally, so no data loss.
- Do NOT rewrite the 8 `handleXxxMessage` function signatures. Keeping the existing signatures preserves all other call sites (tests, direct invocations, enforce-gate interplay).

### ACL Gate Stays Outside Dispatch
- The pre-dispatch ACL check — `resolveCapabilitiesNub` + enforce gate — runs BEFORE `nubDispatch.dispatch(envelope)` is called.
- If ACL denies, runtime emits `.error` envelope and `dispatch()` is never invoked.
- If ACL allows, runtime calls `nubDispatch.dispatch(envelope)`; if that returns `false` (no handler registered), runtime falls through to its existing no-handler path (silent drop per NIP-5D spec) — unchanged.

### Switch Removal Invariant
- After Phase 14, `grep -nE "case '(relay|identity|keys|media|notify|storage|ifc|theme)':" packages/runtime/src/runtime.ts` returns 0.
- `grep -nE "import.*createDispatch|registerNub.*from '@napplet/core'" packages/runtime/src/runtime.ts` returns ≥1.

### Test Coverage
- Existing dispatch.test.ts tests cover per-domain request→result round-trips. They should continue to pass unchanged after the refactor (dispatch is a pure structural swap; behavior identical).
- Add ONE new test asserting the structural change: registering a handler via `registerNub()` and dispatching a matching message invokes the handler. This is a smoke test for the createDispatch integration, not a replacement for domain-level tests.
- Add ONE test asserting `dispatch()` returns `false` for unknown domains (malformed `type`, no handler registered), matching spec behavior.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/home/sandwich/Develop/napplet/packages/core/src/dispatch.ts` — `createDispatch()`, `registerNub`, `dispatch`, `getRegisteredDomains`, `NubHandler` type.
- `packages/runtime/src/runtime.ts` — current switch at lines 1079-1086 (8 cases). Surrounded by ACL check logic.
- `packages/runtime/src/dispatch.test.ts` — existing test suite; should continue to pass.
- `packages/runtime/src/core-compat.ts` — untouched.

### Established Patterns
- Runtime uses closed-over state (session registry, service registry, acl-state). Dispatch instance slots in alongside these.
- Handler functions are all internal to runtime.ts.

### Integration Points
- Runtime init: where existing `createRuntime()` function assembles its internals — add `const nubDispatch = createDispatch();` + 8 `nubDispatch.registerNub(...)` calls.
- Dispatch call site (where the switch currently lives): replace with `const handled = nubDispatch.dispatch(envelope); if (!handled) return;` (the existing default branch in the switch is equivalent to silent drop).

</code_context>

<specifics>
## Specific Ideas

- Registration order mirrors the ROADMAP domain order: `relay, identity, keys, media, notify, storage, ifc, theme` — mostly cosmetic but aids readability and matches the audit doc.
- Type-only import of `NubHandler` from @napplet/core if the adapter function's type annotation benefits from it.
- Wrap each adapter in a small named function (e.g., `const relayAdapter = (msg) => handleRelayMessage(...)`) so stack traces remain readable during error scenarios.

</specifics>

<deferred>
## Deferred Ideas

- Removing core-compat.ts shim (DRIFT-CORE-06) — deferred until napplet/core restores removed v0.1 symbols or a separate milestone addresses it.
- Migrating other internal dispatches (e.g., service message routing, handshake messages) to createDispatch() — out of scope; Phase 14 is specifically the NUB domain switch.
- Module-level singleton vs per-runtime — decided per-runtime; revisit if a single-instance app emerges.

</deferred>
