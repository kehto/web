# Experimental Runnable IPC Shell — Research

**Researched:** 2026-08-20  
**Domain:** Node >=20/POSIX process host over the existing `@kehto/shell-ipc` projection  
**Confidence:** MEDIUM

## Summary

The current package already contains the production carrier/runtime composition: `createIpcShellProjection()` allocates one host-bound endpoint, installs the runtime egress/domain gates, accepts only bare `shell.ready`, sends one `shell.init`, and retires the matching session on peer or endpoint close. [CITED: `packages/shell-ipc/src/ipc-shell.ts`] The missing production boundary is above it: the sole runnable program is `examples/ipc-projection-reference-host.mjs`, which hard-codes proof-only identity, a test-style adapter, test transcript protocol, and its own raw child fixture. [CITED: `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`]

**Primary recommendation:** add a public process-host API plus a `kehto-ipc-shell` package binary; require a host-owned ESM configuration module to supply the real runtime adapter/services and immutable registration, then launch an arbitrary raw command with the one private socket path injected as `KEHTO_IPC_SOCKET_PATH`.

## User Constraints

- Node >=20, POSIX Unix-domain sockets, ESM, experimental; no Tauri, Electron, browser `postMessage`, interface injection, or napplet-side helper. [CITED: `107-CONTEXT.md`, `108-CONTEXT.md`, `109-CONTEXT.md`]
- Preserve canonical envelopes and host-bound identity; the child must not claim window ID, d-tag, hash, or environment. [CITED: `108-CONTEXT.md`; `packages/shell-ipc/src/ipc-shell.ts`]
- Keep carrier-neutral NAP-SHELL lifecycle: bare ready, one init, pre-ready gate, targeted egress, and matching cleanup. Authority: `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; no IPC carrier is specified there. [CITED: task authority; `109-CONTEXT.md`]

## Concrete Gap and Recommended Boundary

| Concern | Current state | Production addition |
|---|---|---|
| Runnable artifact | Proof-only `.mjs` example | `src/cli.ts` built to `dist/cli.js`, package `bin: { "kehto-ipc-shell": "./dist/cli.js" }` |
| Host ownership | Example hand-wires endpoint + child | `launchIpcShellHost(options)` owns composition, endpoint, child, signals, cleanup, and outcome |
| Runtime/services | Example-local adapter/intent service | Required host configuration module exports a real adapter/services mapping; host API accepts `Omit<RuntimeAdapter, 'sendToNapplet'>` because the projection owns egress |
| Child contract | Proof-specific `--path` | Host injects only `KEHTO_IPC_SOCKET_PATH=<private path>` into child environment; child command/argv remain raw Node/process input |
| Outcome | Transcript milestones | Structured `IpcShellHostResult` with child exit, termination reason, and idempotent `close()` |

### Public API

```ts
export interface IpcShellHostOptions {
  readonly registration: IpcShellEndpointRegistration;
  readonly runtimeAdapter: Omit<RuntimeAdapter, 'sendToNapplet'>;
  readonly command: { readonly file: string; readonly args?: readonly string[]; readonly cwd?: string; readonly env?: NodeJS.ProcessEnv };
  readonly baseDirectory?: string;
  readonly shutdownGraceMs?: number;
}

export async function launchIpcShellHost(options: IpcShellHostOptions): Promise<IpcShellHost>;
```

`IpcShellHost` should expose the frozen registration, child PID, `runtime`, `endpointPath` (host API only), `waitForExit()`, and idempotent `close(reason?)`. Do not expose the socket through a napplet API, and do not put registration identity in the environment. The existing projection already rejects peer identity claims, so this retains the current trust boundary. [CITED: `packages/shell-ipc/src/types.ts`; `packages/shell-ipc/src/ipc-shell.ts`]

The executable should use an explicit module boundary rather than fabricate a generic production adapter:

```text
kehto-ipc-shell --host ./my-ipc-host.mjs -- node ./raw-napplet.mjs --flag
```

`--host` resolves an ESM module exporting `createIpcShellHostConfig(): { registration, runtimeAdapter, baseDirectory?, shutdownGraceMs? }`. The config owns service registration via the existing `RuntimeAdapter.services` seam; for example it can return `createCommonService()`/`createNotifyService()` instances from `@kehto/services` with its actual host callbacks. [CITED: `packages/runtime/src/types.ts`; `packages/services/src/index.ts`] This is intentionally not a JSON config: services, persistence, signer, relay, and consent facilities are executable host integrations and cannot safely be inferred from CLI flags.

## Lifecycle Pattern

```text
host config → create projection → register frozen endpoint → spawn(file,args,{shell:false})
     │                  │                         │                    │
     │                  └─ runtime + services      └─ KEHTO_IPC_SOCKET_PATH only
     │
SIGINT/SIGTERM/SIGHUP or child exit → one close gate → endpoint.close → composition.close → remove handlers → host exit code
```

- Spawn the command as executable plus argv with `shell: false`; do not accept one shell command string. The analogous Paja command runner distinguishes argv from shell mode, but this IPC host should support argv only. [CITED: `packages/paja/src/cli.ts`]
- Install one-shot `SIGINT`, `SIGTERM`, and `SIGHUP` handlers after the child exists. On a host signal, forward it to the child, wait the bounded grace period, then `SIGKILL` only if still running; all paths join the same close promise. [ASSUMED] This needs an explicit signal/exit-code policy decision: preserve normal numeric child exits; map a child signal or forced timeout deterministically and document it.
- On spawn error or child exit, close the endpoint and composition even if no peer connected. Close handlers must be removed before resolving `waitForExit()` to prevent a later signal from acting on a retired child. [ASSUMED] The existing endpoint/composition close operations are already idempotent and generation-safe. [CITED: `packages/shell-ipc/src/ipc-shell.ts`]

## Files and Validation

| Change | Files |
|---|---|
| Process host and CLI | `packages/shell-ipc/src/ipc-shell-host.ts`, `packages/shell-ipc/src/cli.ts`, `src/types.ts`, `src/index.ts`, `tsup.config.ts`, `package.json` |
| Proof boundary | Retire or clearly label `examples/ipc-projection-reference-host.mjs` as a thin consumer/example; move reusable lifecycle into the production host API |
| Tests | New `ipc-shell-host.test.ts` plus raw fixture: argv launch, socket env injection only, one init/pre-ready gate, real service request/result and runtime push, normal exit, signal grace/kill, spawn failure, child crash, endpoint/session/path cleanup, handler removal, exit code |
| Docs | `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`, generated API exports; document host-module and `--` command syntax, experimental/same-UID caveat, and no identity env vars |
| Packaging | Add `bin`, include `cli.ts` in tsup entry points, retain ESM output and Node >=20 engine; add a changeset because published package output changes |

Focused test command: `pnpm --filter @kehto/shell-ipc test:unit`; phase gate: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm docs:check`, and the AI-slop gate. [CITED: `AGENTS.md`; `packages/shell-ipc/package.json`]

## Project Constraints (from AGENTS.md)

- Use the codebase graph for code discovery, preserve unrelated dirty work, stage explicit paths, and work through GSD. [CITED: `AGENTS.md`]
- Keep code/tests/docs synchronized; re-export public types for TypeDoc; use conventional commits and a changeset for shipped package output. [CITED: `AGENTS.md`]
- Recheck the pinned NAP authority before any NAP-touching edit; report the IPC carrier as an explicit spec gap, not a normative contract. [CITED: `AGENTS.md`]
- Run build, type-check, unit tests, docs checks when docs change, AI-slop gate, push, and update/open the PR. [CITED: `AGENTS.md`]

## Security Domain

| Threat | Control |
|---|---|
| Child substitutes identity/environment | Registration comes exclusively from the host module; do not export identity variables; preserve carrier peer-claim rejection. |
| Command injection | Require executable + argv and use `spawn(..., { shell: false })`. |
| Orphaned socket/session/process | One idempotent lifecycle gate owns signal, exit, endpoint, composition, and listener cleanup. |
| Same-UID hostile peer | Remains explicitly unsupported; private socket pathname is operational containment, not authentication. |

## Open Decision

Choose the signal exit convention before implementation: either return the child's numeric exit when available and `128 + signalNumber` for signal exits/timeouts, or always return `1` for host-managed abnormal termination. This is observable CLI behavior and is not specified by the existing IPC projection. [ASSUMED]

## Sources

- [CITED: `packages/shell-ipc/src/ipc-shell.ts`] — runtime composition, lifecycle, and carrier gates.
- [CITED: `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`] — proof-only orchestration that must not become the production boundary.
- [CITED: `packages/runtime/src/types.ts`; `packages/services/src/index.ts`] — runtime adapter/service integration seams.
- [CITED: `packages/paja/src/cli.ts`] — existing executable/child-process style.
- [CITED: `AGENTS.md`; `107-CONTEXT.md`; `108-CONTEXT.md`; `109-CONTEXT.md`] — project and protocol constraints.

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|---|---|
| A1 | A host configuration ESM module is preferable to a bundled default adapter because persistence, signer, relay, consent, and service backends are deployment-specific. | The user may instead want a fixed minimal Node adapter, which requires a separate explicit policy/default-services decision. |
| A2 | Signal-exit semantics are not yet a locked user/protocol decision. | CLI tests/docs may assert a convention the user does not want. |
