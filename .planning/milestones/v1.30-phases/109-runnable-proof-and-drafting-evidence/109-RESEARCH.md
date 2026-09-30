# Phase 109: Runnable Proof and Drafting Evidence - Research

**Researched:** 2026-08-20
**Domain:** Node ESM process proof, package documentation, and IPC drafting evidence
**Confidence:** HIGH for the existing repository and pinned NAP authority; MEDIUM for example-file placement

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Deliver a repository-owned standalone Node ESM host and raw napplet process beside `@kehto/shell-ipc`. The host may use the public ESM build; the child uses only `node:net`, local RFC 7464 code, process arguments, and stdio.
- Prove one exact bare `shell.ready`, one `shell.init`, a real canonical request with an `id`, and the runtime result with the same `id`. Do not simulate results, directly write results, inject an interface, or import a Kehto helper in the napplet.
- Demonstrate host push only through `ServiceRuntimeContext.sendToEligibleNapplet()` with a real recipient-capability mapping; do not use a direct peer write or `Runtime.injectEvent()`.
- Cover clean completion and forced child termination. Await existing projection cleanup and prove no route/session, socket pathname, or owned directory remains. Do not add another process lifecycle implementation.
- Keep one publishable `@kehto/shell-ipc` package. Its README/package page must cover transport plus `createIpcShellProjection()`, have a runnable host entry, and conspicuously state Node >=20/POSIX-only, experimental, no authentication, and hostile-same-UID limits.
- Amend the existing pending shell-ipc minor Changeset; do not add a second bump. Keep the ESM boundary, `@napplet/core` peer contract, and `@kehto/runtime: workspace:^` dependency.
- Keep focused process coverage in shell-ipc. Run the existing relevant E2E gate but do not add browser Playwright IPC coverage.
- Publish one discoverable page containing a web/IPC parity matrix and drafting findings; classify every responsibility as shared, carrier-specific, intentionally absent, or unresolved.
- Cite `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, say it defines no IPC carrier, preserve carrier-neutral NAP-SHELL/NAP-INC rules, and label framing/path/lifecycle/errors/limits/trust choices as experimental.
- Preserve frozen registration, exact-ready/idempotent-init, one active peer, targeted egress, eligibility, and generation-matched cleanup. Never document peer-selected identity, shared listener, or unauthenticated IPC as a security feature.
- Do not add Windows, TCP/WebSocket/remote IPC, broker/multiplexing, Tauri/Electron, browser postMessage, interface injection, napplet SDK/helper, or changes under `packages/runtime/src` or `packages/shell/src`.

### the agent's Discretion

Choose the evidence artifact names, transcript format, minimal real service, documentation route, and test helpers that retain every locked proof/security boundary.

### Deferred Ideas (OUT OF SCOPE)

- Windows pipes, remote/brokered/multiplexed IPC, and an authentication layer await an IPC NAP.
- A napplet IPC SDK or `window.napplet.*` projection awaits an upstream contract.
- Browser-shell/runtime canonical contract changes are out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| PROOF-02 | Correlated process request/result. | Raw child sends `intent.available` with a fixed `id`; a host-local `intent` service returns a canonical `intent.available.result` carrying that id. [VERIFIED: runtime service dispatch and intent tests] |
| PROOF-03 | Runtime-originated push on same projection. | Service captures public `ServiceRuntimeContext` in `onRegistered()`, then calls `sendToEligibleNapplet(windowId, intent.changed)`; `intent.changed` maps to `intent:read`. [VERIFIED: runtime types, implementation, and intent-dispatch tests] |
| PROOF-05 | Raw Node napplet only. | A `.mjs` fixture importing only Node built-ins owns local RS/LF framing; static test guards its imports. [VERIFIED: Phase 109 CONTEXT] |
| SPEC-01 | Publishable experimental package documentation. | Extend existing README/package docs API tables with composition and host example. [VERIFIED: shell-ipc README, docs page, barrel] |
| SPEC-02 | Web/IPC parity matrix. | Add one VitePress reference page, linked from package docs/navigation. [VERIFIED: VitePress config and package index] |
| SPEC-03 | Drafting findings. | Use pinned NAP-SHELL/NAP-INC as authority and state no IPC carrier. [VERIFIED: pinned naps checkout] |
| SPEC-04 | Tests, release evidence, gates. | Focused Vitest + existing changeset + repository gates. [VERIFIED: manifests, root scripts, changeset] |
</phase_requirements>

## Summary

Implement a repository-owned Node ESM host that imports the built public `@kehto/shell-ipc` and `@kehto/runtime` surfaces, launches a separate raw Node child, and emits a deterministic structured transcript. The child uses `node:net` plus local RFC 7464 encoding/decoding, sends exactly `{ type: 'shell.ready' }`, then one canonical `intent.available` request with a fixed id. It records `shell.init`, the correlated result, and the push; it imports no Kehto package and never writes a synthetic result. [VERIFIED: Phase 109 CONTEXT; package public barrel and JSON-sequence source]

Use a tiny host-local `intent` `ServiceHandler` for the real path: service dispatch routes `intent.*` ingress through the normal runtime, its handler returns `intent.available.result` with the request id, and its retained `ServiceRuntimeContext` sends an `intent.changed` push. The runtime validates live session, recipient capability mapping, immutable domain environment, and ACL before the IPC composition targets its current ready peer. [VERIFIED: `packages/runtime/src/service-dispatch.ts`, `runtime.ts`, `types.ts`, `intent-dispatch.test.ts`]

The pinned authority requires bare ready, first-ready session creation, exactly one init, duplicate-ready idempotency, and no capability servicing before handshake. It defines no Unix socket/RFC 7464/path/authentication carrier. NAP-INC says that a projection defines binding of its authenticated endpoint. Therefore every IPC carrier detail must be presented as an experimental spec gap. [CITED: `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, `naps/NAP-SHELL.md`, `naps/NAP-INC.md`]

**Primary recommendation:** Put host, raw child, and process test in `packages/shell-ipc`; use the local `intent` service for both real result and policy-checked push; publish a single linked reference page for parity/drafting evidence. [VERIFIED: repository package/docs structure]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Host registration, runtime adapter/service, child lifecycle | API / Backend | — | Node host owns registration, process, socket, and runtime. [VERIFIED: public APIs] |
| RFC 7464 bytes and transcript in napplet | Process client | API / Backend | Child independently demonstrates raw carrier behavior. [VERIFIED: Context] |
| Request/result dispatch | Runtime | Host service | `Runtime.handleMessage()` and service dispatch preserve canonical behavior. [VERIFIED: service dispatch] |
| Push eligibility | Runtime service | IPC composition | Service context authorizes delivery; composition only targets ready peer. [VERIFIED: runtime public seam] |
| Teardown | IPC composition | Transport | Existing matching-generation cleanup owns path/directory/session release. [VERIFIED: Phase 108 verification] |
| Browser injection/postMessage | Browser / Client | — | Intentionally absent. [VERIFIED: Context] |

## Project Constraints (from AGENTS.md)

- Preserve unrelated dirty `package.json`, `.planning/config.json`, and debug note; later stage only owned paths. [VERIFIED: local status; AGENTS.md]
- Use GSD execution for later edits; retain strict ESM TypeScript, 2-space indentation, lowercase-hyphenated files, and public-export JSDoc. [VERIFIED: AGENTS.md]
- Run build, type-check, unit, relevant E2E, docs, and AI-slop gates; update docs/tests with code. [VERIFIED: AGENTS.md]
- Check the pinned NAP authority before NAP-facing changes and report IPC as explicit experimental gap. [VERIFIED: AGENTS.md]
- Do not edit runtime/browser shell or add excluded topology/client features. [VERIFIED: Context]

## Standard Stack

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| Node `node:net` | Node >=20 contract; v26.7.0 local | Raw child pathname socket. | Required raw primitive; existing IPC tests use it. [VERIFIED: manifest/environment] |
| Node `node:child_process` | Node built-in | Launch/kill child and collect stdio. | Existing tests use `spawn`, drain streams, await exit. [VERIFIED: shell-ipc and E2E tests] |
| `@kehto/shell-ipc` | workspace 0.1.0 | Public projection factory. | Host must prove public build, not transport internals. [VERIFIED: manifest/barrel] |
| `@kehto/runtime` | workspace dependency | RuntimeAdapter, ServiceHandler, ServiceRuntimeContext. | Exposes canonical dispatch and policy-aware push. [VERIFIED: runtime types] |
| Vitest | 4.1.2 | Process/static integration test. | Root config discovers package source tests in Node. [VERIFIED: manifest/config] |

**Installation:** None. Keep existing `@kehto/runtime: workspace:^` and `@napplet/core` peer dependency; do not add a third-party package. [VERIFIED: `packages/shell-ipc/package.json`]

## Package Legitimacy Audit

No external package is installed. Node built-ins and first-party workspace dependencies require no registry-legitimacy decision. [VERIFIED: package manifest]

## Architecture Patterns

### System Architecture Diagram

```text
Vitest
  │ spawn built reference host
  ▼
reference-host.mjs ── public createIpcShellProjection() ──► Runtime
  │ host registration + local intent service                    │
  │ socket pathname supplied only as child argument             │ ServiceRuntimeContext
  ▼                                                             ▼
raw-napplet.mjs ── node:net + local RFC 7464 codec ──► shell.ready
  │                                                      ◄── shell.init
  ├── intent.available { id } ──► runtime/service ──────► intent.available.result { same id }
  ├── ◄── intent.changed ◄── context.sendToEligibleNapplet()
  └── structured safe transcript ──► host stdout ──► test

clean exit / SIGKILL ──► host awaits projection.close()
                      └──► session/path/owned directory absent
```

Pass the socket pathname only in an explicit child argument. Do not print it in docs or user-facing diagnostics; tests can inspect a test-only cleanup report after host exit. [VERIFIED: Context specifics and Phase 107 threat model]

### Recommended Project Structure and Ownership

```text
packages/shell-ipc/
├── examples/ipc-projection-reference-host.mjs  # public-ESM host; owns child launch
├── tests/fixtures/raw-ipc-napplet.mjs          # raw node:net local framing only
├── src/ipc-projection-process.test.ts          # clean/abrupt/transcript/source guards
├── README.md                                   # transport + composition host entry
└── package.json                                # existing publish boundary

docs/reference/experimental-ipc-projection.md  # parity matrix + drafting findings
docs/packages/shell-ipc.md                      # link and API facts
docs/.vitepress/config.ts                       # navigation
.changeset/quiet-rice-queue.md                  # amend existing minor note
```

Keep example/fixture out of `src/index.ts`: they are runnable evidence, not a napplet SDK or public carrier API. The existing `files: ["dist"]` remains unchanged unless a separate release choice explicitly publishes examples. [VERIFIED: package manifest; Context D-05/D-11]

### Pattern 1: Minimal Real Service Through the Public Seam

```ts
// Host-only evidence service. The napplet never imports this.
let serviceContext: ServiceRuntimeContext | undefined;
const service: ServiceHandler = {
  descriptor: { name: 'intent', version: '1.0.0', description: 'IPC proof' },
  onRegistered(context) { serviceContext = context; },
  handleMessage(_windowId, message, send) {
    if (message.type !== 'intent.available') return;
    send({
      type: 'intent.available.result',
      id: (message as { id?: string }).id,
      availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
    } as NappletMessage);
  },
};

const delivered = serviceContext?.sendToEligibleNapplet(windowId, {
  type: 'intent.changed',
  availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
} as NappletMessage);
```

Assert `delivered === true` and assert child receipt. Add a source guard that the host contains neither `injectEvent(` nor direct endpoint/peer `.send(` calls. [VERIFIED: Context D-03; runtime recipient-map test]

### Pattern 2: Transcript and Cleanup

Use newline-delimited JSON only on stdout; RFC 7464 remains socket-only. Report named milestones such as `connected`, `shell.init`, `result`, `push`, and `cleanup`, without raw paths. Drain stdout/stderr, time-bound milestone waits, and surface stderr on failure. Existing spawned-process tests use this lifecycle pattern. [VERIFIED: `socket-directory.test.ts`, repository E2E tests]

On normal child completion, host awaits `projection.close()` before terminal cleanup output. On SIGKILL, host observes exit/socket closure then awaits the same projection cleanup. Assert no session entry/route, endpoint path, or owned directory before fixture `finally` removes the outer temp directory. Never mask leaks with a pre-assertion recursive delete. [VERIFIED: Phase 108 close lifecycle and Context D-04]

### Pattern 3: Documentation Is an Authority Boundary

One `docs/reference/experimental-ipc-projection.md` page must contain both required records and be linked from the README, package doc, and VitePress navigation. [VERIFIED: docs navigation conventions]

| Responsibility | Classification | Required wording |
|---|---|---|
| Canonical objects; bare-ready/one-init/session gate; runtime ACL/capability checks; NAP-INC endpoint cleanup semantics | Shared | Carrier-neutral NAP/runtime invariant. [CITED: pinned NAP-SHELL/NAP-INC] |
| Browser source trust vs host-held pathname; RFC 7464; dedicated POSIX listener; terminal transport errors/limits | Carrier-specific | Experimental IPC choice, not NAP authority. [VERIFIED: IPC source/pinned scan] |
| Browser injection, `window.napplet.*`, helper SDK, Windows, remote, broker/shared listener | Intentionally absent | Not supported or implied by IPC. [VERIFIED: Context] |
| Standard carrier/authentication, same-UID adversary resistance, multiplexing, Windows parity | Unresolved | Upstream drafting questions, never settled here. [VERIFIED: pinned scan/Context] |

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Push authorization | Host conditional or direct peer send | `ServiceRuntimeContext.sendToEligibleNapplet()` | Enforces session, recipient mapping, domain environment, and ACL. [VERIFIED: `runtime.ts`] |
| Request/result | Socket-side fake response | `Runtime.handleMessage()` plus ServiceHandler | Proves canonical runtime service flow and correlation. [VERIFIED: service dispatch] |
| Cleanup | Child-specific unlink/session cleanup | Existing projection close lifecycle | Existing code is token/generation safe and owns resources. [VERIFIED: Phase 108] |
| Raw client codec | Kehto codec/helper import | Child-local minimal RS/UTF-8 JSON/LF code | Proves interoperability without shipping an SDK. [VERIFIED: Context] |
| Docs validation | Ad hoc link checker | `pnpm docs:check` | Strict TypeDoc/VitePress/package audit already exists. [VERIFIED: root scripts] |

## Common Pitfalls

- **Policy-bypassing push:** A direct peer/endpoint write or `injectEvent()` does not satisfy PROOF-03. Require context egress, `intent.changed`, true return, and static source guards. [VERIFIED: Context/runtime]
- **Fabricated correlation:** An echo in the host/test is not a runtime result. Child request, service result, and child transcript must all assert the same id. [VERIFIED: Context/service dispatch]
- **Hidden helper:** Importing `encodeJsonSequence` in the child invalidates PROOF-05. Restrict child imports to `node:*` and test this. [VERIFIED: Context]
- **Masked leak:** Do not `rm -rf` the base before checking projection cleanup after clean and killed child paths. [VERIFIED: Context/Phase 108]
- **Accidental protocol claim:** Docs must say private paths are not authentication or cryptographic identity and hostile same-UID peers are out of scope. [VERIFIED: existing docs; pinned authority]

## Upstream Drafting Record: Local Policy and Intentional Questions

| Topic | Local recommendation | Status |
|---|---|---|
| Framing | RS + UTF-8 JSON object + LF RFC 7464; malformed/UTF-8/truncated/over-limit input is terminal. | Carrier-specific experimental proposal. [VERIFIED: `json-sequence.ts`] |
| Endpoint naming | One host-created short pathname in mode-0700 owned directory, distributed out-of-band. | Carrier-specific; naming/distribution not standardized. [VERIFIED: socket directory source/tests] |
| Identity | Host freezes windowId/dTag/hash/environment before listen; peer claims terminate. | NAP-SHELL identity invariant is shared; IPC binding method unresolved. [CITED: NAP-SHELL] |
| Ready | Exact bare ready, one init, duplicate no-op. | Carrier-neutral NAP-SHELL invariant. [CITED: NAP-SHELL] |
| Lifecycle | One ready peer, targeted canonical egress, generation-matched teardown. | Local carrier policy preserving runtime/INC cleanup behavior. [VERIFIED: Phase 108; CITED: NAP-INC] |
| Errors/limits | Redacted diagnostics and finite path/frame/buffer/queue limits. | Experimental operational policy; exact standard values/signal remain unresolved. [VERIFIED: types/source] |
| Local trust | Path secrecy/permissions do not authenticate; hostile same-UID peer excluded. | Upstream authentication/topology question. [VERIFIED: current docs] |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | host/child | ✓ | v26.7.0 | Package baseline is >=20. [VERIFIED: environment/manifest] |
| pnpm | workspace gates | ✓ | 10.8.0 | — [VERIFIED: environment] |
| Playwright | existing relevant E2E gate | ✓ | 1.59.1 | — [VERIFIED: environment] |
| POSIX Unix sockets | proof carrier | ✓ | existing Phase 107/108 tests use them | — [VERIFIED: repository/platform] |
| AI-slop executable | final gate | ✗ | — | Use configured repo invocation; do not alter its config to compensate. [VERIFIED: command unavailable; AGENTS.md] |

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest 4.1.2 in Node. [VERIFIED: manifest/config] |
| Config | `vitest.config.ts`, including `packages/*/src/**/*.test.ts`. [VERIFIED: config] |
| Quick | `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot` |
| Package | `pnpm --filter @kehto/shell-ipc test:unit` |
| Phase gates | `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm docs:check`, AI-slop. [VERIFIED: AGENTS.md/root scripts] |

| Req | Test | Status |
|---|---|---|
| PROOF-02 | Process transcript: exact ready/init + `intent.available.result` same id. | Wave 1 new test |
| PROOF-03 | Process transcript: context-originated `intent.changed`; host static guard. | Wave 1 new test |
| PROOF-05 | Child source import/framing guard plus process run. | Wave 1 new test |
| SPEC-01 | README/package API facts/docs audit. | Existing docs, Wave 2 expansion |
| SPEC-02/03 | Matrix/drafting page wording + docs audit. | Wave 2 new page |
| SPEC-04 | Existing changeset amended; final gates. | Wave 2/3 |

## Security Domain

| ASVS category | Applies | Control |
|---|---|---|
| V2 Authentication | Yes | Explicitly state no peer authentication and no same-UID protection. [VERIFIED: docs/Context] |
| V3 Session Management | Yes | First bare ready creates one bound session; matched close removes it. [CITED: NAP-SHELL; VERIFIED: Phase 108] |
| V4 Access Control | Yes | Context push seam applies recipient mapping/domain/ACL. [VERIFIED: runtime] |
| V5 Input Validation | Yes | Existing bounded codec + child argument validation. [VERIFIED: IPC source] |
| V6 Cryptography | Yes, limitation | Add no crypto; defer authenticated IPC standard upstream. [VERIFIED: docs/Context] |

## Likely Implementation Waves

1. **Runnable proof:** host/child/process test, real request/result and context push, clean + SIGKILL cleanup. No runtime/browser-shell changes.
2. **Public evidence:** README/package docs, parity/drafting page/navigation, amend existing Changeset, narrow wording/source guards.
3. **Integration:** Build public output then run package/full build/type/unit/docs/E2E/AI-slop gates.

Wave 2 depends on Wave 1’s actual proof artifacts; Wave 3 depends on both. [VERIFIED: Phase 109 requirements]

## Assumptions Log

| # | Claim | Risk |
|---|---|---|
| A1 | An example-only local service should not be exported from package source. | Low: consistent with current `files: ["dist"]` and no-helper boundary; planner validates execution layout. |
| A2 | Artifact internal checks may use Node `node:assert`; alternatively keep all assertions in Vitest. | Low. |

## Sources

- **Primary:** pinned local `napplet/naps@c0f7dd14460622fc3a9870ea57a538474cf776fa`; shell-ipc source/types/tests and Phase 107/108 artifacts; runtime types/implementation/service/intent tests; manifests, VitePress config, docs runbook, and pending changeset.
- **Secondary:** existing `socket-directory.test.ts`, DM test, and Playwright server-spawn tests for subprocess handling.

## Metadata

- Standard stack: HIGH — Node built-ins and existing workspace packages only.
- Architecture: HIGH — inspected public runtime/IPC seams and lifecycle evidence.
- Artifact placement: MEDIUM — repository conventions support it; planner selects final runnable layout.
- Valid until: public IPC/runtime service seam changes, otherwise 30 days.
