# @kehto/shell-ipc

Experimental Node.js/POSIX Unix-socket projection for canonical napplet envelopes.

> **Experimental, host-only, and unauthenticated:** This package requires Node.js
> >=20 and POSIX pathname sockets, is ESM-only, and may change before an IPC
> projection is specified. It is not a browser API, a napplet-side SDK, or peer
> authentication. Do not use it where a hostile process under the same operating
> system UID must be resisted.

The checked authority is
[`napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`](https://github.com/napplet/naps/tree/c0f7dd14460622fc3a9870ea57a538474cf776fa).
Its [NAP-SHELL](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md)
and [NAP-INC](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md)
documents define no IPC carrier. This package is experimental drafting evidence,
not an alternate or normative NAP wire contract. See the [web/IPC parity and
drafting record](/reference/experimental-ipc-projection).

## Install

```bash
pnpm add @kehto/shell-ipc @napplet/core
```

`@napplet/core >=0.31.0 <0.32.0` is a peer dependency. The package's
first-party `@kehto/runtime` dependency supplies the runtime composition API.

## What this package provides

There are two host-facing layers:

- `createIpcTransport(options?)` owns a bounded RFC 7464 (JSON Text Sequences)
  carrier and dedicated private POSIX socket endpoints.
- `createIpcShellProjection({ runtimeAdapter, ...transportOptions })` composes
  that carrier with one Runtime, its sessions, ACL, capability checks, and
  endpoint lifecycle. It can register several host-bound endpoints.

Endpoint registration is validated, cloned, and frozen before listening. The
host chooses `windowId`, `dTag`, aggregate hash, and environment; a peer cannot
claim or replace those values. The transport has finite pathname, frame,
buffered-input, and outbound-queue limits, and malformed or over-limit input is
terminal for that peer.

## Runtime-shell composition

Register immutable identity and environment before a listener exists, then own
the returned endpoint and composition lifecycle:

```ts
import { createIpcShellProjection } from '@kehto/shell-ipc';

const composition = await createIpcShellProjection({ runtimeAdapter });
const endpoint = await composition.registerEndpoint({
  windowId: 'host-window-1',
  dTag: 'example',
  aggregateHash: 'verified-artifact-hash',
  environment: {
    capabilities: { domains: ['intent'] },
    services: ['intent'],
  },
});

// Distribute endpoint.path only through the host's chosen local mechanism.
await endpoint.close();
await composition.close();
```

Only the exact bare `{ type: 'shell.ready' }` establishes that host-bound
session. The first accepted ready causes one `shell.init`; pre-ready capability
traffic is inert and duplicate ready is idempotent. Runtime egress is targeted
to the current ready peer. Service-originated pushes still pass recipient
mapping, environment-domain, and ACL/capability eligibility checks before they
can be sent. Graceful close, abrupt peer loss, unregister, and shutdown use
generation-matched cleanup so an old endpoint cannot tear down a replacement.

## Run the reference proof

The repository includes a [standalone reference host](./examples/ipc-projection-reference-host.mjs)
and a [raw Node `node:net` napplet](./tests/fixtures/raw-ipc-napplet.mjs).
The host imports the public package build, launches that separate raw process,
and proves one bare ready/init exchange, a correlated `intent.available`
request/result, a policy-checked runtime push, and cleanup in graceful and
forced-child modes.

```bash
pnpm --filter @kehto/shell-ipc build
node packages/shell-ipc/examples/ipc-projection-reference-host.mjs --mode graceful
node packages/shell-ipc/examples/ipc-projection-reference-host.mjs --mode forced
```

The raw child uses only Node built-ins and local RFC 7464 framing. It has no
`@kehto/*` import, browser `postMessage`, injected `window.napplet.*` interface,
or reusable napplet helper. It is process evidence, not a shipped napplet SDK.

## Security and topology boundaries

- Private directories, mode-0700 permissions, pathname ownership checks, and
  host-held pathname distribution are operational containment only. They do
  **not** authenticate a peer, authorize it, or create cryptographic identity.
- A hostile process under the same operating-system UID is outside this threat
  model and can access paths available to that UID.
- This is POSIX pathname-socket host integration only: no Windows named pipes,
  TCP/WebSocket or remote IPC, shared listener/broker, browser path, Tauri, or
  Electron integration is implemented.
- The package does not inject an interface or expose any napplet-side import.
  Standard carrier identification, authenticated local peer binding, remote
  transports, multiplexing, Windows parity, and negotiated errors/limits remain
  upstream questions, not implicit behavior.

## Public API

- `createIpcTransport(options?)` creates the host-owned transport.
- `createIpcShellProjection(options)` creates either a multi-endpoint
  `IpcShellComposition` or the one-registration `IpcShellProjection`
  convenience projection.
- `IpcShellComposition` and `IpcShellCompositionOptions` describe the shared
  Runtime and its `registerEndpoint`, `unregisterEndpoint`, and `close` APIs.
- `IpcShellEndpoint` exposes host-only `path`, frozen `registration`, and
  `close`; `IpcShellProjection` and `IpcShellProjectionOptions` describe the
  one-registration overload.
- `DEFAULT_IPC_LIMITS`, `IpcTransport`, `IpcEndpoint`,
  `IpcEndpointRegistration`, `IpcEndpointHooks`, `IpcTransportOptions`, and
  `IpcTransportLimits` describe transport ownership and bounds.
- `IpcTransportError`, `IpcTransportErrorCode`, and `IpcDiagnostic` expose
  typed terminal failures and redacted host diagnostics.

## API Reference

Full package docs: [`docs/packages/shell-ipc.md`](../../docs/packages/shell-ipc.md).
Generated API module: `docs/api/modules/_kehto_shell-ipc.html` (run
`pnpm docs:api`).

## License

MIT
