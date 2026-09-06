# Phase 101: NAP-SHELL Session Integrity - Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 19 expected modified files  
**Analogs found:** 19 / 19

This map uses `rg` and direct source reads because the repository-required
codebase-memory graph MCP tools are unavailable in this execution environment.
Authority is `napplet/naps@6461e4b37c29dc09a20dff35d9515889c4433874`,
`naps/NAP-SHELL.md`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/shell/src/types.ts` | model/public types | transform | same file `ShellCapabilities` | exact |
| `packages/shell/src/shell-init.ts` | utility/environment builder | transform | same file `buildShellCapabilities` | exact |
| `packages/shell/src/shell-ready.ts` | service/handshake | event-driven | same file `handleShellReady` | exact |
| `packages/shell/src/napplet-namespace.ts` | injected client component | event-driven | same file `makeShell` | exact |
| `packages/shell/src/shell-bridge.ts` | controller/bridge | request-response | same file `handleMessage` | exact |
| `packages/runtime/src/runtime.ts` | controller/dispatcher | request-response | same file dispatcher boundary | exact |
| `packages/paja/src/browser-target-frame.ts` | host adapter | file-I/O/event-driven | same file `getInjectedDomains` | exact |
| `packages/paja/src/parity.ts` | utility/config | transform | same file parity set comparison | exact |
| `apps/playground/src/demo-hooks.ts` | host service composition | event-driven | same file adapter/capability setup | exact |
| `apps/playground/src/shell-host.ts` | host controller | file-I/O/event-driven | same file iframe registration + prelude | exact |
| `packages/shell/src/*.{test.ts}` (four focused suites) | test | event-driven | existing focused suites | exact |
| `packages/runtime/src/dispatch.test.ts` | test | request-response | existing envelope guard tests | exact |
| `packages/paja/src/{parity,browser-host}.test.ts` | test | event-driven | existing host/parity tests | exact |
| `tests/unit/{nip5d-conformance-guard,playground-gateway-guard}.test.ts` | static guard test | batch | existing source-text assertions | exact |
| `packages/shell/README.md` | documentation | transform | existing package API sections | exact |

## Pattern Assignments

### `packages/shell/src/types.ts` and `packages/shell/src/shell-init.ts` (public model + transform)

**Analog:** existing `ShellCapabilities` and `buildShellCapabilities`.

Use the existing export/JSDoc convention, but reduce the public/wire type to the
domain-only environment. `types.ts:283-350` is the direct replacement target;
it currently documents and exposes `protocols`, `naps`, and `sandbox`. Preserve
the public JSDoc level and readonly intent, but do not retain compatibility
fields in the public type.

**Core builder pattern** (`shell-init.ts:80-138`):

```ts
const domains: string[] = hooks.relayPool
  ? ['relay', 'outbox', ...NAP_DOMAINS]
  : [...NAP_DOMAINS];
if (hooks.intent?.isAvailable()) domains.push('intent');
if (hooks.services?.count) domains.push('count');

return applyCapabilityOverrides(
  { domains, protocols, naps, sandbox },
  hooks.capabilities?.disabledDomains ?? [],
);
```

Copy the single ordered-domain construction and final disabled-domain filter,
but return only a copied/frozen `{ domains }` snapshot. Resolve grants through a
new explicit host seam that accepts the creation-time identity; do not derive
grant status from individual ACL request decisions.

**Anti-pattern:** `shell-init.ts:101-133` manufactures `NAP_INC_PROTOCOLS`,
`protocols`, and `naps`. Delete rather than retain a hidden compatibility path.
`shell-init.ts:141-158` is the correct filter shape, but it must filter only
the domain list.

### `packages/shell/src/shell-ready.ts` (event-driven handshake)

**Analog:** `handleShellReady` in the same file.

**Exactly-once/source-binding pattern** (`shell-ready.ts:54-63`):

```ts
if (initSent.get(sourceWindow) === sourceRegistrationId) {
  return;
}
initSent.set(sourceWindow, sourceRegistrationId);
```

Keep this registration-ID keyed lifecycle guard: it allows a re-registered iframe
lifecycle while suppressing a duplicate ready from one registration. Bind only
through `originRegistry`/the supplied source registration; ignore ready payload
identity. Before setting `initSent` or posting init, require a creation-time
dTag and aggregate hash. A registered but identity-less source must receive no
init and establish no session.

**Wire-shape pattern** (`shell-ready.ts:139-145`):

```ts
const init: NappletMessage & { capabilities: ShellCapabilities; services: string[] } = {
  type: 'shell.init',
  capabilities,
  services,
};
```

Keep the uncorrelated two-field environment exactly; snapshot/copy both values
per source before `postMessage`. Do not add `id`, identity, `naps`, or internal
storage to init.

### `packages/shell/src/napplet-namespace.ts` (injected client bootstrap)

**Analog:** `makeShell` at `napplet-namespace.ts:193-268`.

**Parent trust + first-init cache** (`napplet-namespace.ts:208-228`):

```ts
if (!isParentMessage(event) || environment) return;
if (message.type !== 'shell.init') return;
const services = Object.freeze(/* string-only copy */);
environment = Object.freeze({ capabilities: message.capabilities ?? {}, services });
off();
```

Retain parent-only acceptance, first-init-only behavior, copied frozen services,
one bare `shell.ready`, `ready()`, and one-shot `onReady()`. Make capabilities a
validated immutable `{ domains }` copy and expose unary `supports(domain)`:

```ts
return environment?.capabilities.domains.includes(domain) ?? false;
```

**Anti-pattern:** `napplet-namespace.ts:230-246` accepts a second protocol
argument and falls back to `protocols`/`naps`; remove all three. Do not broaden
the Phase 101 change into INC/channel API work (Phase 102).

### `packages/shell/src/shell-bridge.ts` and `packages/runtime/src/runtime.ts` (trusted ingress + dispatcher)

**Analog:** bridge source validation at `shell-bridge.ts:215-246`, then runtime
envelope dispatch construction at `runtime.ts:133-170`.

```ts
const windowId = originRegistry.getWindowId(sourceWindow);
if (!windowId) return;
if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return;
if (msg.type === 'shell.ready') {
  handleShellReady(/* source registration and creation-time identity */);
  return;
}
runtime.handleMessage(windowId, msg);
```

The bridge remains the sole `shell.ready` owner. Add the total session gate at
the earliest valid-envelope point in `Runtime.handleMessage`, before ACL,
firewall, registered-service, or domain dispatch work:

```ts
if (!sessionRegistry.getEntryByWindowId(windowId)) return;
```

Do not put the gate in selected handlers: `domain-handlers.ts:108` shows a
partial per-domain guard and is precisely the drift-prone pattern to avoid.

### Paja: `packages/paja/src/browser-target-frame.ts`, `parity.ts`, and tests

**Analog:** `getInjectedDomains` at `browser-target-frame.ts:106-126`.

```ts
const available = capabilities.domains.filter((domain) =>
  simulation.capabilities.domains[domain as PajaCapabilityDomain] !== false,
);
return ['shell', ...optionalDomains];
```

Keep mandatory `shell` separate from optional domains and source optional
injection from the exact shell capability snapshot, not manifest requirements.
The current `resolvedTarget?.manifest.requires` filter is an acceptable
intersection pattern only after live host availability has been computed.

`parity.ts:97-110` is the canonical small-set comparison pattern. Update its
`ShellCapabilities` fixtures in `parity.test.ts:59-73` to domain-only shape;
test disabled-domain removal and that services/actual adapter wiring agree.
`browser-host.ts:637-675` shows the host flow: compute capabilities once during
host construction and route every message through the bridge.

### Playground: `apps/playground/src/demo-hooks.ts` and `shell-host.ts`

**Analog:** creation-time registration and prelude injection in
`shell-host.ts:477-502`:

```ts
originRegistry.register(iframe.contentWindow, windowId, { dTag, aggregateHash });
iframe.srcdoc = injectNappletNamespacePrelude(
  injectCspMeta(resolved.indexHtml, origins),
  { domains: ['shell', ...resolved.requires] },
);
```

Keep registration before `srcdoc` and re-register a replaced `contentWindow` on
load. Replace the manifest-only injected-domain list with the same live,
identity-aware environment builder used by `shell.init`; intersect requirements
only after availability/grants are determined. `demo-hooks.ts:193-200` is the
current host adapter construction seam. Its copy helper at `demo-hooks.ts:547-557`
currently clones legacy `naps`, `sandbox`, and `protocols`; remove those fields.

Do not migrate playground INTENT/archetype convention behavior, identity-resource
flow, or theme delivery in this phase (Phases 104-105 and 103 respectively).

### Tests and documentation

**Focused behavioral test analogs:**

- `napplet-namespace.test.ts:257-323` proves receiver-before-ready, parent-only
  init, first-init wins, frozen services, and synchronous pre/post-init support.
  Replace protocol fixtures/assertions with unary API and add two-frame distinct
  environments.
- `shell-bridge.test.ts:464-746` proves source-created session registration and
  exactly-once init. Extend it with identity-less source = no init/session and
  pre-ready non-ready envelope = no effect.
- `dispatch.test.ts:32-75` provides the invalid-envelope table-driven placement;
  add a registered-source-but-no-session vector that spies on service/ACL/firewall
  outcomes and expects nothing.
- `shell-init.test.ts:44-243` is the domain availability matrix. Replace legacy
  protocols/naps sections (`245+`) with negative field assertions and disabled /
  unwired domain parity.
- `shell-supports-conformance.test.ts:27-150` is legacy-only and should be
  rewritten as unary live-domain coverage, not preserved as compatibility proof.
- `tests/unit/playground-gateway-guard.test.ts:138-140` is the existing source
  text guard for prelude derivation; update it to require the shared live domain
  source, rather than `resolved.requires` alone. Keep historical exclusions
  classified rather than doing a repository-wide string purge.

**Direct documentation touchpoint:** `packages/shell/README.md:24-28, 71-72,
101`. Update the package-local description to say synchronous `supports(domain)`
from cached, live domain-only environment and disabled domains removed from
`domains`. Defer `RUNTIME-SPEC.md`, policy sweep, global static cleanup,
changesets, and release gates to Phase 106 as locked by context.

## Shared Patterns

### Creation-time identity and source trust

**Sources:** `packages/paja/src/browser-target-frame.ts:25-40`,
`apps/playground/src/shell-host.ts:477-490`, `packages/shell/src/shell-bridge.ts:215-246`.

Register the actual iframe `Window` with dTag/aggregate hash before its script
can emit ready; always recover the recipient from that source mapping. Never
accept identity/grant/source changes from an envelope payload.

### Immutable per-frame environment

**Sources:** `packages/shell/src/napplet-namespace.ts:215-227`,
`packages/shell/src/shell-ready.ts:139-145`.

Build a fresh domain/services snapshot on first trusted ready, copy/freeze it,
send it once, and cache only first parent init in that frame. Shared mutable
`shellCapabilities` objects are prohibited.

### Total pre-session enforcement

**Sources:** `packages/runtime/src/runtime.ts:133-170`,
`packages/runtime/src/session-registry.ts:43,113`.

Use one dispatcher-level `getEntryByWindowId` guard after envelope validation;
all policy and handler branches must be downstream of it.

## No New Source File Required

The phase may introduce an internal environment/grant resolver if it clarifies
the explicit host seam, but there is no existing direct analog for the resolver
name or exact signature. Keep it private to `@kehto/shell`, pass creation-time
identity explicitly, and test it through `shell-ready`/host paths rather than
creating a public convention or ACL inference API.

## Explicitly Deferred

- INC exact-topic routing, channel API, dTag sender/peer repair: Phase 102.
- Identity and theme result/change contract work: Phase 103.
- Published package chase, intent `convention` fields, archetype metadata: Phase 104.
- Playground profile/resource/theme convention flows: Phase 105.
- Broad active docs/policy/static sweep, changesets, full gates, PR: Phase 106.

## Metadata

**Analog search scope:** `packages/shell/src`, `packages/runtime/src`,
`packages/paja/src`, `apps/playground/src`, focused unit/static tests, and
`packages/shell/README.md`.  
**Pattern extraction date:** 2026-07-23
