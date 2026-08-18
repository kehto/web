# Phase 107: IPC Transport Foundation - Pattern Map

**Mapped:** 2026-08-18  
**Files analyzed:** 16  
**Analogs found:** 13 / 16

> Package paths in this map use the approved directory, `packages/shell-ipc`, rather
> than the early research placeholder `packages/ipc`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/shell-ipc/package.json` | config | build | `packages/firewall/package.json` | exact |
| `packages/shell-ipc/tsconfig.json` | config | build | `packages/firewall/tsconfig.json` | exact |
| `packages/shell-ipc/tsup.config.ts` | config | build | `packages/firewall/tsup.config.ts` | exact |
| `packages/shell-ipc/README.md` | config | request-response | `packages/firewall/README.md` | role-match |
| `packages/shell-ipc/src/index.ts` | utility | transform | `packages/firewall/src/index.ts` | exact |
| `packages/shell-ipc/src/types.ts` | model | transform | `packages/runtime/src/session-registry.ts` | role-match |
| `packages/shell-ipc/src/json-sequence.ts` | utility | streaming | — | no analog |
| `packages/shell-ipc/src/outbound-queue.ts` | utility | streaming | — | no analog |
| `packages/shell-ipc/src/socket-directory.ts` | service | file-I/O | `packages/paja/src/server.ts` | partial |
| `packages/shell-ipc/src/endpoint-registry.ts` | store | event-driven | `packages/shell/src/origin-registry.ts` | role-match |
| `packages/shell-ipc/src/ipc-shell.ts` | service | request-response | `packages/paja/src/server.ts` | role-match |
| `packages/shell-ipc/src/json-sequence.test.ts` | test | streaming | `packages/firewall/src/config.test.ts` | role-match |
| `packages/shell-ipc/src/outbound-queue.test.ts` | test | streaming | `packages/paja/src/server.test.ts` | partial |
| `packages/shell-ipc/src/socket-directory.test.ts` | test | file-I/O | `packages/paja/src/server.test.ts` | partial |
| `packages/shell-ipc/src/endpoint-registry.test.ts` | test | event-driven | `packages/paja/src/server.test.ts` | partial |
| `vitest.config.ts` | config | build | `vitest.config.ts` | exact (modify only if root-import tests need it) |

## Pattern Assignments

### `packages/shell-ipc/package.json`, `tsconfig.json`, and `tsup.config.ts` (config, build)

**Analog:** `packages/firewall/package.json`, `packages/firewall/tsconfig.json`, and `packages/firewall/tsup.config.ts`

**Package convention** ([`packages/firewall/package.json`](../../../packages/firewall/package.json#L1-L34)):

```json
{
  "name": "@kehto/firewall",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "type-check": "tsc --noEmit",
    "test:unit": "vitest run --config ../../vitest.config.ts"
  }
}
```

Copy this ESM/dist/scripts structure; name it `@kehto/shell-ipc`, set the repository directory to `packages/shell-ipc`, and declare only the required Node/runtime/napplet dependencies after checking their actual imports. Do not add an IPC library.

**Compiler and bundler convention** ([`packages/firewall/tsconfig.json`](../../../packages/firewall/tsconfig.json#L1-L9), [`packages/firewall/tsup.config.ts`](../../../packages/firewall/tsup.config.ts#L1-L9)):

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

Use the matching `extends: "../../tsconfig.json"`, `dist` output, `src` root, and `include: ["src"]` compiler configuration.

### `packages/shell-ipc/src/index.ts` and `types.ts` (utility/model, transform)

**Analogs:** [`packages/firewall/src/index.ts`](../../../packages/firewall/src/index.ts#L44) and [`packages/runtime/src/session-registry.ts`](../../../packages/runtime/src/session-registry.ts#L75)

**Public-barrel pattern** (firewall lines 44-81):

```ts
export type { Observation, FirewallConfig, FirewallState, EvaluateResult } from './types.js';
export { evaluate, toKey } from './evaluate.js';
export { defaultConfig, createState } from './defaults.js';
```

Keep `index.ts` as documented public exports only, use explicit `.js` relative specifiers, and export types with `export type`. Place the immutable endpoint registration/options/diagnostics contracts in `types.ts`; public interfaces must have JSDoc.

**Private-state factory pattern** (runtime lines 75-96):

```ts
export function createSessionRegistry(notifier?: PendingUpdateNotifier): SessionRegistry {
  const byWindowId = new Map<string, string>();
  const byPubkey = new Map<string, SessionEntry>();

  return {
    register(windowId: string, entry: SessionEntry): void {
      byWindowId.set(windowId, entry.pubkey);
      byPubkey.set(entry.pubkey, entry);
    },
    unregister(windowId: string): void {
      // Delete every related index together.
    },
  };
}
```

Use closure-held maps/tokens rather than exposed mutable state. For endpoint identity, clone and freeze the host input before filesystem/listener work; never model peer-provided `windowId`, dTag, aggregate hash, or environment.

### `packages/shell-ipc/src/json-sequence.ts` (utility, streaming)

**Analog:** none — the repository has no incremental byte-framing implementation.

Implement from the Phase 107 research rather than adapting browser `postMessage` code. The public codec should use Node `Buffer` inputs/outputs, retain incomplete bytes between `push()` calls, enforce bounded frame and total buffered bytes before decoding, use fatal UTF-8 decoding, then admit only a non-null object with a string `type`. A malformed record, truncation at `end()`, invalid UTF-8, or a bound breach is terminal; never recover and continue.

The closest *validation style* is [`packages/firewall/src/config.ts`](../../../packages/firewall/src/config.ts#L180-L224): validate untrusted data structurally before returning a typed value.

```ts
function isValidRateLimit(v: unknown): v is RateLimit {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r['capacity'] === 'number' && isFinite(r['capacity'] as number);
}
```

For this codec, the equivalent final guard is object/non-null plus `typeof value.type === 'string'`; unlike firewall's persisted-config fallback, failure must surface a close reason and prevent dispatch.

### `packages/shell-ipc/src/outbound-queue.ts` (utility, streaming)

**Analog:** none — no existing component owns a `net.Socket` write queue.

Follow the research's Node `write(false)`/`drain` state machine: one queue instance per accepted socket, enqueue pre-encoded `Buffer`s in caller order, stop flushing immediately when `write()` returns `false`, resume only on that socket's `drain`, and destroy/report on either frame-count or byte-count overflow. Keep all queue counters and terminal state private; detach event listeners during close.

### `packages/shell-ipc/src/socket-directory.ts` (service, file-I/O)

**Analog:** [`packages/paja/src/server.ts`](../../../packages/paja/src/server.ts#L142)

**Promise lifecycle pattern** (lines 142-166):

```ts
function listen(server: HttpServer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) { reject(error); return; }
      resolve();
    });
  });
}
```

Use the same one-shot error/listen cleanup discipline for `node:net`, but own the additional filesystem lifecycle: `mkdtemp` a mode-`0700` private directory, generate a short socket basename, reject paths above the researched byte limit, and only unlink/rmdir after containment plus owned-socket checks. Never clean a caller/peer-derived path or unlink blindly after `EADDRINUSE`.

### `packages/shell-ipc/src/endpoint-registry.ts` (store, event-driven)

**Analog:** [`packages/shell/src/origin-registry.ts`](../../../packages/shell/src/origin-registry.ts#L55)

**Replacement-generation pattern** (lines 55-68):

```ts
register(win: Window, windowId: string, identity?: OriginIdentity): void {
  for (const [registeredWin, entry] of registry.entries()) {
    if (registeredWin === win || entry.windowId === windowId) {
      registry.delete(registeredWin);
    }
  }

  registry.set(win, {
    windowId,
    dTag: identity?.dTag,
    aggregateHash: identity?.aggregateHash,
    registrationId: ++nextRegistrationId,
  });
},
```

Copy the private registry plus monotonic registration/generation identifier, not browser source lookup. The IPC equivalent keys records by host registration/socket path and uses an opaque generation token so delayed close/error handlers cannot remove a newer endpoint. Clone/freeze identity/environment before `listen`; expose address and metadata only, never mutation of the stored identity.

### `packages/shell-ipc/src/ipc-shell.ts` (service, request-response)

**Analog:** [`packages/paja/src/server.ts`](../../../packages/paja/src/server.ts#L41)

**Factory/handle pattern** (lines 41-55 and 102-123):

```ts
export async function startPajaServer(input: PajaServerOptions): Promise<PajaServer> {
  const options = normalizePajaOptions(input.options);
  // Construct private state and listener.
  await listen(server, options.host, options.port);

  return {
    url: formatPajaUrl(servedOptions),
    get hostConfig() { return hostConfig; },
    close: () => close(server),
  };
}
```

Export one async host-facing factory returning a narrow endpoint/registrar handle with an explicit async `close()`. Have it compose `socket-directory`, `endpoint-registry`, codec, and queue without modifying `@kehto/runtime` or `@kehto/shell`. Runtime dispatch integration and NAP-SHELL session composition are Phase 108 concerns.

### Test files (test, streaming/file-I/O/event-driven)

**Analogs:** [`packages/firewall/src/config.test.ts`](../../../packages/firewall/src/config.test.ts#L1) and [`packages/paja/src/server.test.ts`](../../../packages/paja/src/server.test.ts#L11)

**Direct-source test/import convention** (firewall lines 1-16):

```ts
import { describe, it, expect } from 'vitest';
import { setPolicy, deserialize } from './config.js';
import type { FirewallConfig } from './types.js';

const baseConfig: FirewallConfig = defaultConfig();
```

Use focused unit files beside implementation (`*.test.ts`) and import source via `.js`. Use real, deterministic fixtures with independent decoder/queue instances per case.

**Resource cleanup convention** (Paja lines 11-47):

```ts
const server = await startPajaServer({ options: { targetUrl: 'http://127.0.0.1:5173', port: 0 } });
try {
  // Exercise actual observable behavior.
} finally {
  await server.close();
}
```

Apply `try/finally` to every filesystem/socket fixture. `json-sequence.test.ts` must cover every split point, coalesced records, multibyte UTF-8 splits, RS/LF violations, malformed JSON, fatal invalid UTF-8, EOF truncation, and both byte bounds. `outbound-queue.test.ts` should use a controlled socket-write surface to prove FIFO order, `false`/`drain` pause-resume, and count/byte overflow. Directory and registry tests must use actual temporary socket paths to prove containment, immutability, and cleanup.

### `vitest.config.ts` (config, build; conditional modification)

**Analog:** [`vitest.config.ts`](../../../vitest.config.ts#L4)

```ts
export default defineConfig({
  resolve: {
    alias: {
      '@kehto/runtime': resolve(__dirname, 'packages/runtime/src/index.ts'),
      '@kehto/shell': resolve(__dirname, 'packages/shell/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'packages/*/tests/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
```

The existing include glob already discovers `packages/shell-ipc/src/**/*.test.ts`. Add only the `@kehto/shell-ipc` alias if a test outside that package imports its package root; otherwise leave this file unchanged.

## Shared Patterns

### ESM package boundaries
**Sources:** `packages/firewall/package.json` lines 1-34; `packages/firewall/src/index.ts` lines 44-81.  
**Apply to:** every `packages/shell-ipc` source/config file.

Use ESM-only package metadata, source `.js` specifiers, `export type` for type-only public API, and `tsup` declarations from the barrel entry point.

### Host-bound identity and lifecycle ownership
**Sources:** `packages/shell/src/origin-registry.ts` lines 55-68; `packages/runtime/src/session-registry.ts` lines 75-159.  
**Apply to:** `types.ts`, `endpoint-registry.ts`, `ipc-shell.ts`.

Store identity in private maps/closures, bind it only from the host registration input, delete all related indexes as a unit, and guard delayed callbacks with a registration generation. Browser `Window` lookup is specifically not reusable for IPC.

### Fail-closed untrusted input
**Source:** `packages/firewall/src/config.ts` lines 180-224 and 270-337.  
**Apply to:** `json-sequence.ts`, endpoint ingress.

Validate structure before type assertion. For socket ingress, convert invalid input to a terminal peer close/diagnostic rather than firewall's safe default configuration fallback.

### Async resource cleanup in tests and services
**Source:** `packages/paja/src/server.ts` lines 142-166; `packages/paja/src/server.test.ts` lines 11-47.  
**Apply to:** socket-directory, endpoint registry, IPC factory, their tests.

Wrap listener start/close in Promises with error cleanup; use `try/finally` to release every temporary listener/directory even when an assertion fails.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/shell-ipc/src/json-sequence.ts` | utility | streaming | No incremental byte-framing or RFC 7464 implementation exists. Use the approved research design. |
| `packages/shell-ipc/src/outbound-queue.ts` | utility | streaming | No `net.Socket` write/drain queue exists. Use the researched finite backpressure state machine. |
| `packages/shell-ipc/src/socket-directory.ts` | service | file-I/O | Existing server lifecycle is analogous, but no owned Unix-socket directory/guarded cleanup code exists. |

## Metadata

**Analog search scope:** `packages/firewall`, `packages/runtime`, `packages/shell`, `packages/paja`, root `vitest.config.ts`  
**Files scanned:** 11  
**Pattern extraction date:** 2026-08-18
