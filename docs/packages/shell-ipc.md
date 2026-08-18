# @kehto/shell-ipc

Experimental Node.js/POSIX Unix-socket carrier for canonical napplet envelopes.

> **Experimental status:** This host-only carrier is not a NAP capability or a
> standardized IPC protocol. Its API and operational model may change before a
> native projection is specified.

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
| Peer dependency | `@napplet/core >=0.31.0 <0.32.0` |
| Node engine | `>=20` |
| Side effects | `false` |

## Primary APIs

| Area | Exports |
|------|---------|
| Transport factory | `createIpcTransport`, `DEFAULT_IPC_LIMITS`, `IpcTransport` |
| Endpoint lifecycle | `IpcEndpoint`, `IpcEndpointRegistration`, `IpcEndpointHooks`, `IpcEnvironmentValue` |
| Configuration | `IpcTransportOptions`, `IpcTransportLimits` |
| Diagnostics | `IpcTransportError`, `IpcTransportErrorCode`, `IpcDiagnostic` |

## Scope Boundaries

- Provides an experimental Node.js >=20/POSIX Unix-socket carrier for canonical
  `@napplet/core` envelopes. It is host-only: the package exports no
  napplet-facing client or peer identity API.
- Frames use JSON Text Sequences (RFC 7464) and the transport bounds pathname,
  frame, buffered-input, and outbound-queue resources before allocating a
  listener.
- Host-owned endpoint registration metadata is cloned and recursively frozen
  before listening. A peer frame that claims `windowId`, `dTag`, aggregate hash,
  or environment metadata is rejected.
- The NAP registry at
  [`napplet/naps` `c0f7dd14460622fc3a9870ea57a538474cf776fa`](https://github.com/napplet/naps/tree/c0f7dd14460622fc3a9870ea57a538474cf776fa)
  defines NAPs as transport-agnostic and lists native OS-process IPC only as a
  possible projection. No NAP specifies this carrier, so it is an explicit
  experimental projection/spec gap rather than an alternate NAP wire contract.
- Private directories, pathname ownership checks, and host-held pathname
  distribution reduce accidental sharing and pathname substitution. They do
  **not** authenticate or authorize peers and are not cryptographic identity.
- The threat model is deliberately bounded: hostile processes under the same
  operating-system UID are out of scope. Do not use this carrier when hostile
  same-UID peer resistance is required.
- Capability policy, identity verification, and canonical protocol handling
  remain the host runtime's responsibility after carrier validation.

## API Reference

- Generated module: <a href="../api/modules/_kehto_shell-ipc.html" target="_self"><code>docs/api/modules/_kehto_shell-ipc.html</code></a>
