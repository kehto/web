# @kehto/shell-ipc

Experimental Node.js/POSIX Unix-socket projection for canonical napplet envelopes.

> **Experimental and unauthenticated:** ESM-only, Node.js >=20, and POSIX
> pathname sockets only. This is a host integration, not a browser surface or
> napplet-side helper. It does not authenticate peers or resist hostile processes
> running under the same operating-system UID.

The checked authority is
[`napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`](https://github.com/napplet/naps/tree/c0f7dd14460622fc3a9870ea57a538474cf776fa).
Its [NAP-SHELL](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md)
and [NAP-INC](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md)
documents define no IPC carrier. Read the [experimental IPC parity and drafting
record](/reference/experimental-ipc-projection) before treating any local
carrier choice as a protocol direction.

## Install

```bash
pnpm add @kehto/shell-ipc @napplet/core
```

## Manifest Facts

| Field | Value |
|-------|-------|
| Source | `packages/shell-ipc/package.json`, `packages/shell-ipc/src/index.ts` |
| Version | `0.1.0` |
| Runtime entry | `./dist/index.js` |
| Types entry | `./dist/index.d.ts` |
| Executable | `kehto-ipc-shell` -> `./dist/cli.js` |
| Peer dependency | `@napplet/core >=0.31.0 <0.32.0` |
| First-party dependency | `@kehto/runtime workspace:^` |
| Node engine | `>=20` |
| Module format | ESM-only |
| Side effects | `false` |

## Primary APIs

| Area | Exports |
|------|---------|
| Transport factory | `createIpcTransport`, `DEFAULT_IPC_LIMITS`, `IpcTransport` |
| Runtime composition | `createIpcShellProjection`, `IpcShellComposition`, `IpcShellCompositionOptions` |
| Process host | `launchIpcShellHost`, `IpcShellHost`, `IpcShellHostCommand`, `IpcShellHostConfig`, `IpcShellHostOptions`, `IpcShellHostExit` |
| Host endpoint lifecycle | `IpcShellEndpoint`, `IpcShellEndpointRegistration`, `IpcShellProjection`, `IpcShellProjectionOptions` |
| Transport endpoint lifecycle | `IpcEndpoint`, `IpcEndpointRegistration`, `IpcEndpointHooks`, `IpcEnvironmentValue` |
| Configuration | `IpcTransportOptions`, `IpcTransportLimits`, `IpcShellCapabilities`, `IpcShellEnvironment` |
| Diagnostics | `IpcTransportError`, `IpcTransportErrorCode`, `IpcDiagnostic` |

`createIpcTransport()` owns bounded RFC 7464 framing and private listener
resources. `createIpcShellProjection()` composes that carrier with one Runtime
and lets a host register several immutable endpoints. `IpcShellComposition`
exposes `runtime`, `registerEndpoint`, `unregisterEndpoint`, and `close`;
`IpcShellEndpoint` is host-only and exposes `path`, frozen `registration`, and
`close`.

## Production runnable shell

Run arbitrary raw-process argv through the installed executable:

```bash
kehto-ipc-shell --host ./host-config.mjs -- node ./raw-napplet.mjs --mode graceful
```

`host-config.mjs` exports `createIpcShellHostConfig()`, synchronously or
asynchronously. It supplies frozen registration and the deployment-owned
runtime adapter without `sendToNapplet`; the IPC projection supplies targeted
egress. The child receives only `KEHTO_IPC_SOCKET_PATH` and no registration
identity/environment. Spawning is direct (`shell:false`), stdin/stdout/stderr
are inherited without filtering, numeric exits are preserved, and signal exits are conventional
`128 + signal number` statuses. Explicit close, forwarded host signals, timeout
escalation, and terminal current-ready-peer disconnect all converge on one
cleanup result. Shell-owned CLI usage/error text redacts registration values and
private endpoint paths; inherited child application output is intentionally not
filtered and may report its own socket environment.

## Runnable evidence

Build and run the actual [reference host](https://github.com/kehto/web/blob/main/packages/shell-ipc/examples/ipc-projection-reference-host.mjs):

```bash
pnpm --filter @kehto/shell-ipc build
node packages/shell-ipc/dist/cli.js --host packages/shell-ipc/examples/ipc-projection-reference-host.mjs -- node packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs --mode graceful
```

The reference host is a proof-only ESM configuration module consumed by the
production executable; it has no duplicate child process lifecycle.

The host launches a separate [raw `node:net` napplet](https://github.com/kehto/web/blob/main/packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs)
that has no Kehto import, helper SDK, interface injection, or browser path. The
focused [process proof](https://github.com/kehto/web/blob/main/packages/shell-ipc/src/ipc-projection-process.test.ts)
checks bare ready/one init, correlated request/result, eligibility-checked host
push, and graceful/forced cleanup. This is executable drafting evidence, not a
new client contract.

## Scope Boundaries

- Registration metadata is cloned and frozen before listening. The host, not
  the peer, assigns identity/environment. Only exact bare `shell.ready`
  establishes the session; init is idempotent and pre-ready capability traffic
  is not serviced.
- Runtime egress is targeted to the current ready peer. A runtime-originated
  message still requires recipient mapping plus environment-domain and
  ACL/capability eligibility. Lifecycle cleanup is generation-matched across
  disconnect, endpoint close, unregister, and composition shutdown.
- Frames use JSON Text Sequences (RFC 7464); pathname, frame, buffered-input,
  and outbound-queue resources have finite bounds and terminal failures expose
  only redacted diagnostics.
- Private permissions and host-held pathname distribution reduce accidental
  sharing and pathname substitution. They are not peer authentication,
  authorization, or cryptographic identity; hostile same-UID peers are out of
  scope.
- No browser `postMessage`, browser interface injection, napplet-side helper,
  Windows pipe, remote/TCP/WebSocket transport, shared listener, or broker is
  implemented or implied. Authentication, standard carrier identification,
  multiplexing, Windows, remote parity, and negotiated errors/limits remain
  unresolved upstream questions.

## API Reference

- Generated module: <a href="../api/modules/_kehto_shell-ipc.html" target="_self"><code>docs/api/modules/_kehto_shell-ipc.html</code></a>
