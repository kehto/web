# Phase 108: Runtime Shell Composition - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 7 likely changed/new files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/shell-ipc/src/ipc-shell.ts` | service / transport composition | request-response, event-driven | `packages/shell/src/shell-bridge.ts` + current `ipc-shell.ts` | role-match |
| `packages/shell-ipc/src/types.ts` | model / public API contract | request-response | `packages/runtime/src/types.ts` | role-match |
| `packages/shell-ipc/src/index.ts` | config / public barrel | transform | `packages/shell-ipc/src/index.ts` | exact |
| `packages/shell-ipc/src/ipc-shell.test.ts` | test | event-driven, file-I/O | `packages/shell/src/shell-bridge.test.ts` + current `ipc-shell.test.ts` | role-match |
| `packages/shell-ipc/src/runtime-shell.test.ts` (new, recommended) | test | request-response, event-driven | `packages/shell/src/shell-bridge.test.ts` | role-match |
| `packages/shell-ipc/package.json` (conditional) | config | build | sibling package manifests | partial |
| `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`, changeset | documentation / release | transform | Phase 109 package-quality work | no Phase 108 analog/scope |

Phase 108 should not modify `packages/runtime/src/*` or `packages/shell/src/*`: the public runtime adapter seam and the browser NAP-SHELL implementation already supply the patterns to compose. Package documentation, changeset, raw-process fixture, parity matrix, and E2E/process proof are explicitly Phase 109 exclusions.

## Pattern Assignments

### `packages/shell-ipc/src/ipc-shell.ts` (service, request-response/event-driven)

**Analogs:** `packages/shell/src/shell-bridge.ts`, `packages/shell/src/shell-ready.ts`, and the current IPC transport implementation.

**Public runtime construction / bound egress** — copy the host-owned construction shape from `packages/shell/src/shell-bridge.ts` lines 185-199, but build `createRuntime()` from IPC-specific host options. The only runtime egress hook must lookup the current endpoint/peer by the host-bound `windowId`; it must never route using peer-supplied envelope fields.

```ts
const runtime: Runtime = createRuntime({
  ...runtimeHooks,
  isDomainAllowed: shellReadyState.isDomainAllowed,
});
```

The public contract to consume is `packages/runtime/src/types.ts` lines 552-591:

```ts
export interface RuntimeAdapter {
  sendToNapplet: SendToNapplet;
  isDomainAllowed?: (windowId: string, domain: string) => boolean;
  // host adapters follow
}
```

`sendToNapplet` should delegate only to the endpoint's single *currently bound* peer queue. Do not alter runtime dispatch or canonical envelope shape.

**Ingress and pre-ready guard** — retain the existing carrier callback boundary in `packages/shell-ipc/src/ipc-shell.ts` lines 74-95: RFC-7464 decoding and peer-identity-claim rejection happen before the composition callback. On accepted envelope, recognize only bare `{ type: 'shell.ready' }` as the local handshake; all other envelopes go to `runtime.handleMessage(registration.windowId, envelope)`. Runtime already makes pre-session traffic inert before capability, ACL, firewall, service, or domain dispatch (`packages/runtime/src/runtime.ts` lines 347-390):

```ts
if (!sessionRegistry.getEntryByWindowId(windowId)) return;
const domain = envelope.type.slice(0, dotIdx);
if (hooks.isDomainAllowed && !hooks.isDomainAllowed(windowId, domain)) return;
const caps = resolveCapabilitiesNap(envelope);
if (caps.senderCap) {
  const result = enforceNap(windowId, caps.senderCap as Capability, envelope);
  if (!result.allowed) { /* canonical denial / error */ }
}
```

**Exactly-once ready/init and source-bound session** — copy `packages/shell/src/shell-ready.ts` lines 44-105, translating browser source registration identity into the immutable IPC endpoint registration. A per-connection generation/token replaces `WeakMap<Window, number>`; a ready duplicate for that same current token returns before another init. Register a NIP-5D `SessionEntry` only from `registration.windowId`, `dTag`, and `aggregateHash`; never accept peer-selected identity/environment.

```ts
if (state.initSent.get(sourceWindow) === sourceRegistrationId) return;
registerNip5dSessionIfNeeded({ origin, runtime, state, sourceRegistrationId, windowId, identity });
state.environments.set(windowId, environment);
postShellInit(sourceWindow, environment);
state.initSent.set(sourceWindow, sourceRegistrationId);
```

IPC has no browser origin: use a fixed, documented host-controlled provenance/origin value and preserve `type: 'nip5d'`, `provenance: 'nip-5d'`, fresh `instanceId`, and host registration identity from `shell-ready.ts` lines 92-104.

**Single peer and stale callbacks** — Phase 107 currently stores `Map<Socket, OutboundQueue>` and broadcasts in `ipc-shell.ts` lines 60-69 and 113-128. Replace this only inside the IPC composition lifecycle with one active peer record `{ socket, queue, connectionGeneration }`; reject/destroy an additional connection without replacing the active peer. Every `close`, `end`, `error`, and decoder-terminal callback must first prove both endpoint registration generation and peer generation are current. Copy the endpoint generation checks from `packages/shell-ipc/src/endpoint-registry.ts` lines 45-93:

```ts
const isCurrent = (record, generation) =>
  record !== undefined && record.generation === generation;

if (!isCurrent(current, generation) || current.state === 'closing') return undefined;
records.set(windowId, { ...current, state: 'closing' });
```

**Cleanup ownership** — compose cleanup in one idempotent path: if the matching active peer closes (gracefully or abruptly), remove only that peer binding and unregister only its matching runtime session; explicit endpoint unregister/transport shutdown then close peer, listener, pathname, and directory using the current generation. Preserve the Phase 107 owned-resource sequence in `ipc-shell.ts` lines 97-110:

```ts
const current = endpoints.beginClosing(reservation.windowId, reservation.generation);
if (!current) return;
queue.close();
peer.destroy();
await closeServer(server);
await activeDirectory.close();
endpoints.removeIfCurrentGeneration(reservation.windowId, reservation.generation);
```

Do not call `runtime.destroy()` on per-endpoint disconnect if one runtime instance serves other endpoints; use `runtime.sessionRegistry.unregister(windowId)` and any per-window runtime cleanup API as appropriate. Reserve runtime-wide `destroy()` for the IPC shell/host shutdown after endpoint cleanup.

### `packages/shell-ipc/src/types.ts` (model/public API contract, request-response)

**Analog:** `packages/runtime/src/types.ts` lines 552-591 and current `packages/shell-ipc/src/types.ts` lines 69-142.

Extend the IPC host-facing options/handle types narrowly for runtime composition (runtime adapter/options, endpoint/connection diagnostics, and explicit async lifecycle methods) while retaining immutable registration and canonical `NappletMessage` transport. Current public API convention:

```ts
export interface IpcTransport {
  registerEndpoint(registration: IpcEndpointRegistration, hooks: IpcEndpointHooks): Promise<IpcEndpoint>;
  unregisterEndpoint(windowId: string): Promise<void>;
  close(): Promise<void>;
}
```

Avoid exposing mutable registry/peer/session maps. The public API may expose a narrow runtime-composed factory/handle, but must not leak an IPC client helper or browser-like interface injection.

### `packages/shell-ipc/src/index.ts` (public barrel, transform)

**Analog:** current `packages/shell-ipc/src/index.ts` lines 1-13.

Keep runtime-composition exports deliberate and type-only where applicable:

```ts
export { createIpcTransport, DEFAULT_IPC_LIMITS } from './ipc-shell.js';
export { IpcTransportError } from './types.js';
export type { IpcEndpoint, IpcEndpointRegistration, IpcTransport } from './types.js';
```

If an IPC runtime-shell factory is introduced, export only that host-facing factory and its documented types. Do not export registries, queues, connection records, or browser-shell symbols.

### `packages/shell-ipc/src/ipc-shell.test.ts` (test, event-driven/file-I/O)

**Analogs:** current `ipc-shell.test.ts` lines 11-49 and `packages/shell/src/shell-bridge.test.ts` lines 100-123.

Continue raw `node:net` helpers and `try/finally` cleanup. Add carrier-composition cases here when they use a real Unix socket: second peer denial, graceful `end`, abrupt `destroy`, explicit unregister, host close, endpoint re-registration, and delayed old-socket close after a replacement. Assert listener/path/directory cleanup only for the matching registration generation.

```ts
try {
  endpoint = await transport.registerEndpoint(registration, hooks);
  client = await connectPeer(endpoint.path);
  // assert observable framing/lifecycle behavior
} finally {
  client?.destroy();
  await endpoint?.close();
  await transport.close();
}
```

### `packages/shell-ipc/src/runtime-shell.test.ts` (new recommended test, request-response/event-driven)

**Analog:** `packages/shell/src/shell-bridge.test.ts` lines 584-1040 and `packages/runtime/src/dispatch.test.ts` lines 78-104.

Use a minimal real `RuntimeAdapter` test harness and raw framed socket peer. Keep browser tests untouched. Prove: pre-ready capability message is silent/inert; first bare ready registers the host-bound session and yields one init; duplicate ready produces neither a second init nor a replacement session; post-ready domain/capability traffic reaches existing runtime ACL enforcement; revoked/disabled capability traffic remains denied/dropped; runtime-originated egress goes only to the one bound current endpoint.

The precise browser readiness expectation to reproduce is `shell-ready.ts` lines 53-65:

```ts
if (state.initSent.get(sourceWindow) === sourceRegistrationId) return;
// resolve host-bound identity and register session
postShellInit(sourceWindow, environment);
state.initSent.set(sourceWindow, sourceRegistrationId);
```

## Shared Patterns

### Source-bound identity and frozen environment

**Sources:** `packages/shell-ipc/src/ipc-shell.ts` lines 150-264; `packages/shell/src/origin-registry.ts` lines 55-68 and 128-140.

Phase 107 already clones/freezes identity before listener allocation and rejects `windowId`, `dTag`, `aggregateHash`, and `environment` peer claims. Phase 108 must use that immutable registration directly for the session and `shell.init` environment. Browser source identity lookup is an analog only; do not import or reuse `originRegistry` in IPC.

### Runtime admission, ACL, and capability eligibility

**Source:** `packages/runtime/src/runtime.ts` lines 347-390, 425-446.

The composition must call `runtime.handleMessage` only under the registration's `windowId`, retain `isDomainAllowed`, and leave ACL/capability resolution in runtime. Runtime-originated egress must use the same recipient eligibility path, never direct-send around it.

### Session registry

**Source:** `packages/runtime/src/session-registry.ts` lines 75-159.

Use `register(windowId, entry)` once per ready lifecycle and `unregister(windowId)` only if the closing peer token/generation still owns that session. Its maps are runtime-owned; IPC owns the connection-token guard which prevents an old callback from unregistering a replacement session.

### Planning coupling / wave constraint

`ipc-shell.ts`, its public types/barrel, and its runtime-composition tests are tightly coupled: the single-peer binding, ready state, `sendToNapplet` routing, and cleanup must land as one vertical slice, because each needs the same private connection generation record. Do not split them into independently executable waves that edit `ipc-shell.ts` concurrently. Runtime and browser shell should be verification-only dependencies, not edit targets.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Raw child-process/reference napplet fixture | test / proof | streaming, request-response | Intentionally Phase 109 (`PROOF-02`, `PROOF-03`, `PROOF-05`); do not introduce it in Phase 108. |
| IPC/web parity matrix and upstream drafting findings | documentation | transform | Intentionally Phase 109 (`SPEC-02`, `SPEC-03`). |

## Metadata

**Analog search scope:** `packages/runtime/src`, `packages/shell/src`, `packages/shell-ipc/src`, `packages/paja/src`, `tests/unit`, and Phase 107 artifacts.
**Files scanned:** 16 focused source/test/planning files.
**Pattern extraction date:** 2026-08-18.
