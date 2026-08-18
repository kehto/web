# Stack Research

**Domain:** Experimental NIP-5D projection over POSIX Unix-domain sockets
**Researched:** 2026-08-18
**Confidence:** HIGH for Node/Unix socket mechanics; MEDIUM for the projection contract because no IPC specification exists yet

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=20 | Host and reference napplet processes | Kehto already targets modern ESM TypeScript; `node:net` provides stable stream-based Unix-domain-socket servers and clients without another runtime dependency. |
| TypeScript | ^5.9.3 | Package implementation and public contracts | Matches the monorepo and preserves strict, ESM-only package conventions. |
| `@kehto/runtime` | workspace current (`0.22.0`) | NIP-5D dispatch, ACL, firewall, subscriptions, and lifecycle | Its `RuntimeAdapter.sendToNapplet`, `Runtime.handleMessage`, `sessionRegistry`, and `destroyWindow` already form the transport-neutral seam. |
| `@napplet/core` | >=0.31.0 <0.32.0 | Canonical `NappletMessage` envelopes | Keeps IPC payload semantics identical to the web projection. |
| RFC 7464 JSON text sequences | RFC 7464 | Stream framing | Unix stream sockets do not preserve message boundaries. UTF-8 JSON texts prefixed by RS (`0x1e`) and terminated by LF provide an established incremental framing format with resynchronization rules. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:net` | Node built-in | Create/listen/connect to Unix-domain sockets | Always; no third-party socket wrapper is needed. |
| `node:fs/promises` | Node built-in | Private runtime directory, permissions, stale-path inspection, cleanup | Always on the host side. |
| `node:os` / `node:path` | Node built-in | Short temporary socket paths | Always; socket path limits are typically 107 bytes on Linux and 103 bytes on macOS. |
| `node:child_process` | Node built-in | Runnable host/napplet proof | Reference fixture only; the package should not require the host to launch napplets itself. |
| Vitest | ^4.1.2 | Framing, lifecycle, security, and process integration tests | Match existing repository test tooling. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsup | ESM package build | Follow existing package output conventions. |
| Turborepo | Workspace build ordering | Add `@kehto/ipc#build` after `@kehto/runtime#build`. |
| Node child processes | Real transport verification | Spawn a raw `node:net` napplet fixture and assert process-visible outcomes. |
| Existing docs/quality gates | Package completeness | Add README, docs package page, typed exports, changeset, and AI-slop coverage. |

## Installation

No new production library is recommended. The package should use Node built-ins and existing workspace packages.

```bash
pnpm --filter @kehto/ipc build
pnpm --filter @kehto/ipc test:unit
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Pathname Unix-domain sockets | Linux abstract sockets | Only for a Linux-only projection; abstract sockets are not portable to macOS and do not provide filesystem permission controls. |
| One socket per endpoint | Shared multiplexed socket | After the projection defines a separate authenticated connection handshake and needs high endpoint counts. |
| RFC 7464 framing | Newline-delimited JSON | For an intentionally informal prototype where a standards-track framing reference is not valuable. |
| RFC 7464 framing | Fixed-width length prefix | If later profiling shows JSON-sequence scanning is a bottleneck or binary payload transport becomes normative. |
| Raw `node:net` client in the fixture | `@kehto/ipc` client helper | Only if a later milestone adds a napplet-side API; the user explicitly excluded it here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Tauri or Electron IPC | Adds a host framework and does not validate a carrier-neutral local IPC projection. | POSIX Unix-domain sockets through `node:net`. |
| Browser `postMessage` or `MessagePort` | Re-tests the existing web projection rather than IPC between processes. | Unix stream sockets. |
| Unframed JSON writes | A stream read can split or combine writes; one `data` event is not one envelope. | Incremental RFC 7464 decoder. |
| Linux peer credentials as the only identity anchor | Node core does not expose a portable macOS/Linux credential API, and Linux mechanisms do not define the cross-platform projection. | Host-assigned endpoint identity plus a private per-endpoint socket path. |
| New runtime dispatcher | Would duplicate ACL, firewall, session, and service semantics. | Adapt the existing `@kehto/runtime` public surface. |

## Stack Patterns by Variant

**For the v1.30 experiment:**
- Use a host-created private directory and a dedicated pathname socket for each endpoint.
- Bind `{ windowId, dTag, aggregateHash }` before accepting traffic.
- Use RFC 7464 frames containing unchanged NIP-5D envelope objects.

**For a future standardized shared socket:**
- Add a projection-defined authentication and multiplexing handshake first.
- Do not infer identity from `windowId`, `dTag`, or other fields sent by an untrusted peer.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@kehto/ipc` experimental line | `@kehto/runtime` workspace current | Keep runtime semantics unchanged; depend on public runtime types and methods. |
| `@kehto/ipc` | `@napplet/core >=0.31.0 <0.32.0` | Match current runtime envelope range. |
| `node:net` Unix IPC | Node >=20 on POSIX | Pathname sockets work on Linux and macOS; Windows named pipes are out of scope. |

## Sources

- https://nodejs.org/download/release/latest-v20.x/docs/api/net.html — IPC path support, path limits, crash-stale paths, lifecycle, and write backpressure.
- https://nodejs.org/docs/latest-v20.x/api/fs.html — temporary directory and filesystem operations.
- https://www.rfc-editor.org/info/rfc7464/ — standard UTF-8 JSON text sequence framing.
- https://man7.org/linux/man-pages/man7/unix.7.html — pathname socket permissions, portability limits, and peer credentials.
- `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` — NAP-SHELL and NAP-INC carrier-neutral identity constraints; no IPC projection document exists.
- Kehto knowledge graph — `createShellBridge`, `adaptHooks`, `createMessageHandler`, `handleShellReady`, and `Runtime.destroyWindow` integration seams.

---
*Stack research for: Experimental NIP-5D Unix IPC projection*
*Researched: 2026-08-18*
