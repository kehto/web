# Phase 109: Runnable Proof and Drafting Evidence - Pattern Map

**Mapped:** 2026-08-20  
**Files analyzed:** 10 planned additions/modifications  
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/shell-ipc/test/fixtures/reference-host.mjs` (new; exact name at planner discretion) | reference host / fixture | request-response, pub-sub, process I/O | `packages/shell-ipc/src/runtime-shell.test.ts` + `packages/runtime/src/runtime.ts` | role-match |
| `packages/shell-ipc/test/fixtures/raw-napplet.mjs` (new) | raw child napplet fixture | streaming, request-response | `packages/shell-ipc/src/json-sequence.ts` + `runtime-shell.test.ts` | role-match |
| `packages/shell-ipc/src/runnable-proof.test.ts` (new) | process integration test | process I/O, event-driven | `packages/shell-ipc/src/socket-directory.test.ts` | role-match |
| `packages/shell-ipc/README.md` | package documentation | transform | `packages/shell-ipc/README.md` + `packages/shell-ipc/src/ipc-shell.ts` JSDoc | exact |
| `docs/packages/shell-ipc.md` | package reference documentation | transform | `docs/packages/paja.md`, current shell-ipc page | exact |
| `docs/reference/ipc-shell-projection.md` (new) | design/proof record | transform | `docs/policies/NIP-5D-CONFORMANCE.md` + `docs/packages/index.md` | role-match |
| `docs/.vitepress/config.ts` | documentation navigation config | transform | current `Package Reference` / `Reference` sidebar entries | exact |
| `.changeset/quiet-rice-queue.md` | release metadata | transform | current pending changeset | exact |
| `tests/unit/napplet-dependency-direction-guard.test.ts` or a new IPC static guard (conditional) | static conformance test | transform | `tests/unit/nip5d-conformance-guard.test.ts` | role-match |
| existing E2E selection only (no new browser spec) | verification gate | browser E2E | `tests/e2e/nip5d-contract-conformance.spec.ts` | verification-only |

The proof owns only `packages/shell-ipc` fixture/test/documentation and release evidence. It must not edit `packages/runtime/src/**`, `packages/shell/src/**`, browser E2E specs, `@napplet/*`, or the carrier topology. The reference host consumes the already-public IPC composition; it is not a new runtime/shell API.

## Pattern Assignments

### Reference host fixture (host process, request-response + pub-sub)

**Recommended location:** `packages/shell-ipc/test/fixtures/reference-host.mjs`. Keep the host a plain Node ESM executable whose only package imports are public built exports: `@kehto/shell-ipc` and, where necessary, public `@kehto/runtime` types/runtime APIs. Do not import shell-ipc private `src` modules.

**Analogs:** `packages/shell-ipc/src/runtime-shell.test.ts` lines 43-77 and 147-219; `packages/runtime/src/runtime.ts` lines 429-467.

**Host adapter and projection construction:** Copy the minimum complete `RuntimeAdapter` fixture shape from `runtime-shell.test.ts` lines 43-77. The process host should create a `createIpcShellProjection({ runtimeAdapter })` composition, register a frozen host-owned endpoint registration, and report only a redacted structured readiness record to stdout. The test-derived adapter is the established fixture convention; do not invent direct socket writes or modify runtime internals.

```ts
const composition = await createIpcShellProjection({
  baseDirectory,
  runtimeAdapter: createAdapter(),
});
const endpoint = await composition.registerEndpoint({
  windowId: 'host-chosen-window',
  dTag: 'host-chosen-napplet',
  aggregateHash: 'host-chosen-hash',
  environment: { capabilities: { domains: ['keys'] }, services: [] },
});
```

**Real request/result:** Follow `runtime-shell.test.ts` lines 274-291: after the child sends exactly `{ type: 'shell.ready' }`, a canonical `keys.registerAction` request with an `id` reaches `Runtime.handleMessage()` through IPC and emits the matching `.result`. Assert the original `id`, not merely the result type.

```ts
peer.write(encodeJsonSequence({
  type: 'keys.registerAction', id: 'bound-action', action: { id: 'action-1' },
}));
expect(peerFrames[1]).toEqual({
  type: 'keys.registerAction.result', id: 'bound-action', actionId: 'action-1',
});
```

**Policy-checked host push:** Copy the public service context seam from `packages/runtime/src/runtime.ts` lines 429-447. Register a tiny fixture `ServiceHandler` on the host, retain `ServiceRuntimeContext` in `onRegistered`, and call `context.sendToEligibleNapplet(windowId, canonicalMessage)`. This is the sole valid host-push route. It verifies current session, allowed domain, recipient capability, and canonical message before `sendToNapplet`; neither `endpoint.send()` nor `Runtime.injectEvent()` is a substitute.

```ts
onRegistered(context) { runtimeContext = context; }
const delivered = runtimeContext?.sendToEligibleNapplet(
  HOST_WINDOW_ID,
  { type: 'keys.bindings', bindings: [] } as NappletMessage,
);
```

The fixture should explicitly record `delivered === true` and the raw child’s observed canonical push. Choose a real message whose recipient capability and allowed domain are granted by the frozen environment/ACL fixture; do not bypass eligibility.

**Process lifecycle:** Copy the idempotent composition close and endpoint teardown model from `runtime-shell.test.ts` lines 80-132 and 208-219. The host owns `endpoint.close()`/`composition.close()` in `finally`, emits a terminal cleanup record only after completion, and never lets child exit/signal choose host identity or cleanup generation.

### Raw napplet fixture (child process, RFC 7464 streaming/request-response)

**Recommended location:** `packages/shell-ipc/test/fixtures/raw-napplet.mjs`. It must import only Node built-ins (`node:net`, optionally `node:events`/`node:process`); it must not import `@kehto/*`, a reusable helper, or receive injected interface state.

**Analogs:** `packages/shell-ipc/src/json-sequence.ts` lines 9-57 (framing rules) and `packages/shell-ipc/src/runtime-shell.test.ts` lines 10-40 (raw socket/test decoder).

**Local codec:** Reimplement the intentionally small RFC 7464 codec locally: serialize a JSON object with string `type` as `RS (0x1e) + UTF-8 JSON + LF (0x0a)`, buffer input until LF, require the leading RS, and parse each JSON object. Keep it local to the fixture—not exported and not package code.

```ts
function encode(message) {
  return Buffer.concat([Buffer.from([0x1e]), Buffer.from(JSON.stringify(message)), Buffer.from([0x0a])]);
}
socket.on('data', (chunk) => {
  // append; locate LF; decode frame.slice(1, newline); JSON.parse
});
```

**Transcript protocol:** Use stdout for line-delimited, deterministic JSON transcript events (for example `shell.init`, `request.result`, `host.push`, `closed`) and stderr only for diagnostics. Do not print private pathname or host-bound registration identity. The endpoint pathname is a process argument from the host and is not a claim the child can set.

**Readiness and request order:** Write one exact bare `{ type: 'shell.ready' }`, await one `shell.init`, write one real canonical request with a fixed id, await the matching result id, then await the service-originated push. No payload-bearing `shell.ready`, simulated result, direct output-to-socket host substitute, or `window.napplet` equivalent is permitted.

### `packages/shell-ipc/src/runnable-proof.test.ts` (process integration test)

**Analog:** `packages/shell-ipc/src/socket-directory.test.ts` lines 15-30; its `leaveRefusedSocket()` is the project’s closest Node child lifecycle pattern.

```ts
const child = spawn(process.execPath, [hostFixture, ...args], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
await once(child.stdout, 'data');
child.kill('SIGKILL');
await once(child, 'exit');
```

Use explicit helpers in the new test, not a globally shared child-process abstraction:

- Spawn with `stdio: ['ignore', 'pipe', 'pipe']`; attach `data` handlers immediately to drain both streams.
- Parse stdout line-by-line into structured records, with a bounded timeout and a rejected promise on unexpected exit.
- In `finally`, request graceful completion first; if it does not exit by a short bounded deadline, `kill('SIGKILL')`, then `await once(child, 'exit')` with the listener registered before signalling.
- Run two independent cases: normal raw-child completion and external/host-coordinated forced raw-child termination. In both, wait for the host’s cleanup transcript and independently assert `access(endpoint.path)` rejects and `readdir(baseDirectory)` is empty/removed as applicable.
- Preserve the established `mkdtemp('/tmp/k-ipc-…')` + `try/finally` + `rm(baseDirectory, { recursive: true, force: true })` test cleanup from `runtime-shell.test.ts` lines 80-132. The postcondition is asserted before the force cleanup so it is evidence, not a cleanup artifact.

The process test is focused package-unit coverage (`pnpm --filter @kehto/shell-ipc test:unit` / targeted Vitest), not a new Playwright test. Keep a relevant existing NIP-5D E2E command as a final gate only.

### Documentation and public API evidence

**Package README:** Follow current `packages/shell-ipc/README.md` headings and safety-first order: experimental warning, install, scope/security boundary, runnable host-oriented entry point, public API, generated API link. Expand the example from `createIpcTransport()` to the already exported `createIpcShellProjection()` composition. Cite Node >=20, POSIX only, no authentication, hostile same-UID exclusion, and that private pathname containment is not cryptographic identity.

**Package page:** Follow `docs/packages/shell-ipc.md` lines 9-56: retain Manifest Facts including the exact version row, add `createIpcShellProjection`, `IpcShellComposition`, `IpcShellEndpoint`, and `IpcShellProjection` to Primary APIs only if exported by existing `src/index.ts`, and link to the new drafting/parity page. Never document a nonexistent napplet-side client API.

**Typedoc constraint:** Public exports need JSDoc in `packages/shell-ipc/src/ipc-shell.ts`/`types.ts`, which Phase 108 already supplies. Phase 109 should not add a source export merely to make documentation look complete. Run `pnpm docs:check`, which invokes strict API generation/audit, to prove the existing public export surface is documented.

### `docs/reference/ipc-shell-projection.md` (new parity matrix and drafting record)

**Analogs:** `docs/packages/index.md` lines 1-38 for current/documented-vs-stability framing; `docs/policies/NIP-5D-CONFORMANCE.md` for named authority and policy language.

Use one self-contained reference page with:

1. status and direct link to the runnable proof;
2. a compact matrix with rows for envelope shape, NAP-SHELL ready/init lifecycle, host-bound identity, ACL/capability eligibility, NAP-INC semantics, browser source trust, browser injection, browser `postMessage`, RFC 7464/private socket naming, local authentication, platform/remote/multiplexing;
3. a responsibility classification of **shared**, **carrier-specific**, **intentionally absent**, or **unresolved** for every row;
4. drafting findings that pin `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` and explicitly state no IPC carrier exists there;
5. clearly separated carrier-neutral NAP-SHELL/NAP-INC invariants and experimental choices (framing, endpoint pathname, host identity, trust boundary, terminal errors, lifecycle, finite limits) plus unresolved upstream questions.

The page must say browser injection and `postMessage` are absent, not merely different. It must never present one-active-peer, private mode-0700 directories, or host-held pathname distribution as authentication.

### `docs/.vitepress/config.ts` and documentation discoverability

**Analog:** `docs/.vitepress/config.ts` lines 88-105. Add one sidebar item under **Reference**, e.g. `IPC Shell Projection`, pointing to `/reference/ipc-shell-projection`. Keep package overview’s existing `@kehto/shell-ipc` row as the package entry; add a cross-link from the package page/readme rather than another package list row.

### `.changeset/quiet-rice-queue.md` (release evidence)

**Analog:** the existing file itself. Retain its sole `"@kehto/shell-ipc": minor` frontmatter; rewrite the summary so it accurately describes the unreleased experimental RFC 7464 transport **and** host runtime-shell projection/proof. Do not create a second changeset and do not change the package version manually. A 0.x externally visible new composition/proof package surface remains a minor bump under project policy.

### Static and E2E guards (conditional, verification-only unless a gap is found)

**Static analog:** `tests/unit/nip5d-conformance-guard.test.ts`; **E2E analog:** `tests/e2e/nip5d-contract-conformance.spec.ts`.

First extend the focused package process test. Only add a static guard if inspection shows the existing guards cannot prove the explicit no-touch/non-helper boundary. A suitable narrow guard can assert the raw child fixture has no `@kehto/` import, no `window.napplet`, and only `node:` imports; it should not attempt brittle source-text policing of runtime/browser packages. Do not add or expand browser Playwright specs for the POSIX-only carrier; run a relevant existing contract selection as a verification gate.

## Shared Patterns

### Runtime-service push eligibility

**Source:** `packages/runtime/src/runtime.ts` lines 429-447.

```ts
sendToEligibleNapplet(windowId: string, message: NappletMessage): boolean {
  const entry = sessionRegistry.getEntryByWindowId(windowId);
  if (!entry || typeof message.type !== 'string') return false;
  const domain = message.type.slice(0, message.type.indexOf('.'));
  if (isDomainAllowed && !isDomainAllowed(windowId, domain)) return false;
  const { recipientCap } = resolveCapabilitiesNap(message);
  if (!recipientCap || !aclState.check('', entry.dTag, entry.aggregateHash, recipientCap as Capability)) return false;
  sendToNapplet(windowId, message);
  return true;
}
```

Apply to the proof host only. This preserves capability/ACL policy and targeted current-peer egress.

### Service context retention

**Source:** `packages/services/src/outbox-service.ts` lines 362, 472-478.

```ts
let runtimeContext: ServiceRuntimeContext | undefined;
onRegistered(context: ServiceRuntimeContext): void { runtimeContext = context; }
onUnregistered(): void { runtimeContext = undefined; }
```

The fixture service must follow this lifecycle; it may not capture a private projection peer or endpoint writer.

### Bounded child cleanup

**Source:** `packages/shell-ipc/src/socket-directory.test.ts` lines 19-30.

Register output/exit listeners before killing, drain pipes, await exit, and use `try/finally`. Unlike its narrow stale-socket helper, the Phase 109 process test must also wait for the host’s own lifecycle-cleanup proof before removing the test directory.

### Protocol authority and spec-gap wording

**Sources:** `packages/shell-ipc/README.md` lines 15-24 and `docs/packages/shell-ipc.md` lines 31-43.

All docs must use the exact pinned NAP source and distinguish its carrier-neutral NAP-SHELL/NAP-INC requirements from IPC-specific experimental choices. A draft/absent carrier is not permission to silently define normative wire behavior.

## Ownership, Dependencies, and Waves

| Wave | Owned files | Depends on | Why sequential |
|---|---|---|---|
| 1 | raw child fixture, reference host fixture, focused process test (and narrow fixture guard only if needed) | completed Phase 108 public projection | The test requires the host/child transcript and lifecycle behavior together; it proves, not changes, the composition. |
| 2 | README, package page, reference parity/findings page, VitePress sidebar, existing changeset | wave 1 transcript/commands | Docs must cite the actual runnable entry point and observed proof behavior; changeset describes the combined public release. |
| 3 | verification only: focused package test, build/type-check, relevant existing E2E selection, docs check, slop gate | waves 1-2 | Avoid browser code changes; this confirms the Node/POSIX proof and public evidence integrate without scope creep. |

No two plans should concurrently edit `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`, or `.changeset/quiet-rice-queue.md`.

## Explicit No-Touch Files

- `packages/runtime/src/**` — public runtime/service seams are evidence dependencies, not Phase 109 implementation targets.
- `packages/shell/src/**` and browser shell/playground sources — no `postMessage`, injection, or interface changes.
- `packages/shell-ipc/src/ipc-shell.ts`, `json-sequence.ts`, and `types.ts` — prove existing carrier/composition behavior; do not establish new IPC wire semantics.
- `tests/e2e/**/*.spec.ts` — use relevant existing selection as a gate only.
- Any `@napplet/*` source and all Windows/TCP/WebSocket/Tauri/Electron code.
- Unrelated current worktree changes: `package.json` and `.planning/debug/jsr-release-scope-auth.md`.

## Metadata

**Analog search scope:** `packages/shell-ipc/src`, `packages/runtime/src`, `packages/services/src`, `packages/paja/src`, `tests/unit`, `tests/e2e`, `docs`, `.changeset`.  
**Files scanned:** 17 focused source/test/documentation/planning files.  
**Pattern extraction date:** 2026-08-20.
