# @kehto/shell-ipc

Experimental Node.js/POSIX Unix-socket carrier for canonical napplet envelopes.

> **Experimental status:** This package is a host-only carrier projection, not a
> NAP capability or a standardized IPC protocol. Its API and operational model
> may change before a native projection is specified.

## Install

```bash
pnpm add @kehto/shell-ipc @napplet/core
```

## What this package is

`@kehto/shell-ipc` lets a Node.js host register private Unix-socket endpoints
for canonical `@napplet/core` envelopes. The host supplies immutable endpoint
metadata before listening, receives validated envelopes through `onEnvelope`,
and owns endpoint teardown. Frames use JSON Text Sequences (RFC 7464) with
bounded input and outbound queues.

The NAP registry at
[`napplet/naps` `c0f7dd14460622fc3a9870ea57a538474cf776fa`](https://github.com/napplet/naps/tree/c0f7dd14460622fc3a9870ea57a538474cf776fa)
defines capability seams as transport-agnostic and lists native OS-process IPC
only as a possible projection. No NAP currently defines this carrier. This is a
documented spec gap, not an alternate NAP wire contract.

## Security and scope boundaries

- The package is Node.js >=20 and POSIX Unix-socket only; it is not a browser,
  Windows named-pipe, TCP, or napplet-facing client API.
- Endpoint registration metadata (`windowId`, `dTag`, aggregate hash, and
  environment) is cloned and frozen by the host before the listener exists.
  Peer frames that claim any of that host-bound metadata are rejected.
- Private directories, pathname ownership checks, and host-held pathname
  distribution reduce accidental sharing and pathname substitution risks. They
  are **not** peer authentication, authorization, or cryptographic identity.
- The bounded threat model excludes hostile processes running under the same
  operating-system UID. Such a process can access paths available to that UID;
  do not use this carrier where protection from hostile same-UID peers is a
  requirement.
- The carrier validates framing and canonical envelope shape, but capability
  policy and protocol handling remain the host runtime's responsibility.

## Quick start

```ts
import { createIpcTransport } from '@kehto/shell-ipc';

const transport = await createIpcTransport();
const endpoint = await transport.registerEndpoint(
  {
    windowId: 'window-1',
    dTag: 'example',
    aggregateHash: '…',
    environment: {},
  },
  {
    onEnvelope(envelope, registration) {
      // Deliver the carrier-validated envelope to the host runtime.
    },
  },
);

await endpoint.close();
```

## Public API

- `createIpcTransport(options?)` creates the host-owned transport.
- `DEFAULT_IPC_LIMITS` provides the default frame, buffer, queue, and path
  bounds.
- `IpcTransport`, `IpcEndpoint`, `IpcEndpointRegistration`,
  `IpcEndpointHooks`, and `IpcTransportOptions` describe host integration.
- `IpcTransportError` and `IpcDiagnostic` expose typed terminal failures and
  redacted host diagnostics.

## API Reference

Full package docs: [`docs/packages/shell-ipc.md`](../../docs/packages/shell-ipc.md).
Generated API module: `docs/api/modules/_kehto_shell-ipc.html` (run
`pnpm docs:api`).

## License

MIT
