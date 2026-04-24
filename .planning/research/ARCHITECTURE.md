# Architecture Research

**Domain:** kehto v1.7 — NIP-5D spec revision adoption & new NUB domains
**Researched:** 2026-04-24
**Confidence:** HIGH (all integration points derived from reading actual source code)

---

## v1.7 Feature Integration Analysis

The six sections below answer the six questions in the research scope, in order.
Each section cites file:line references for insertion points.

---

## 1. NUB-CLASS Integration Points

### 1a. When is `class.assigned` emitted?

NUB-CLASS emits `class.assigned` **after the shell.ready / shell.init round-trip completes** — not at iframe-load time and not after the first AclStateContainer resolve.

The existing handshake sequence:
```
iframe loads → shim sends shell.ready
  → shell-bridge.ts:214 receives shell.ready → sends shell.init (with capabilities)
  → shim receives shell.init → sets window.napplet.shell.supports() surface → shim "ready"
```

`class.assigned` must follow shell.init receipt because:
- The shim is not fully initialized before shell.init arrives (it can't process NUB envelopes before that point).
- Class posture depends on identity being registered, which happens at iframe-create time via `originRegistry.register()` in `hooks-adapter.ts` (called from `ShellAdapter.onNip5dIframeCreate`).

**Insertion point:** `shell-bridge.ts:214-224` — after the `win.postMessage(initMsg, '*')` call, queue a `class.assigned` envelope to the same window. The message shape (from NIP-5D spec) is `{ type: 'class.assigned', class: <posture> }`.

Class posture is assigned per-identity at iframe-create time (from the NIP-5A manifest or host-app policy) and stored alongside the session in `sessionRegistry`. The shell emits it as a push immediately after `shell.init` so the shim can record it before any NUB messages are sent.

### 1b. How does the ACL change decisions based on class?

Class posture is a **modifier on capability resolution**, not a new key dimension. The `AclStateContainer` key remains `(dTag, aggregateHash)` — no new axis is added.

Current decision chain in `acl-state.ts:124`:
```
check(pubkey, dTag, aggregateHash, capability) → toKey → state.entries[key] → caps & bit
```

NUB-CLASS adds a class-posture layer **before** the bit-check. The recommended approach:

1. Extend `AclEntry` in `packages/acl/src/types.ts` with an optional `class?: string` field (zero-dep, WASM-safe).
2. Add a class-to-default-caps mapping in `capabilities.ts`: e.g. `'trusted'` class starts with `CAP_ALL`, `'sandboxed'` class starts with a restricted subset, `'untrusted'` class starts with `CAP_NONE`.
3. `createAclState()` / `createState()` initialises new entries with `entry.caps = classDefaultCaps(classPosture)` instead of always using policy-wide `CAP_ALL` or `0`.
4. The shell sets a napplet's class at registration time: when `originRegistry.register()` is called (inside `hooks-adapter.ts`), it passes the class into `aclState.grant(...)` as the seed.

Existing NUBs (identity/ifc/keys/media/notify/relay/storage/theme) remain class-agnostic: class only affects the *initial* capability grant. Once granted, all existing check/revoke paths work unchanged.

**Existing NUBs need NO changes.** Class enforcement is in the capability-seeding path, not in the per-NUB handlers.

### 1c. How does `createDispatch()` pick up class-gated routing?

It doesn't need to. `createDispatch()` and `registerNub()` are unaware of class. The entire class gating happens before dispatch, in the ACL enforcement gate at `runtime.ts:1118-1126`:

```typescript
// runtime.ts:1118
const caps = resolveCapabilitiesNub(envelope);
if (caps.senderCap) {
  const result = enforceNub(windowId, caps.senderCap as Capability, envelope);
  if (!result.allowed) { ... return; }
}
currentWindowId = windowId;
nubDispatch.dispatch(envelope);  // class-restricted napplets never reach this
```

`registerNub` does not need a `class` parameter. Class enforcement is inline in the ACL check that runs before dispatch. No new NUB handler registration pattern is needed.

### 1d. What does `AclStateContainer.snapshot()` return before class is assigned?

There is no `snapshot()` method on `AclStateContainer`. The read surface is `getEntry()` / `getAllEntries()`. Before class is assigned (i.e., before the host calls `originRegistry.register()` for the new napplet), there is no entry for that identity. The current policy applies: `defaultPolicy === 'permissive'` → `check()` returns `true`; `'restrictive'` → `false`.

**Implication for NUB-CLASS:** The shell must assign class *synchronously at iframe registration time* (before any messages can arrive) to avoid the permissive-default window. The correct place is in `hooks-adapter.ts` where `originRegistry.register()` is called. Class must be recorded alongside identity in the session entry so `aclState` seeds the right capability set immediately.

### 1e. Do existing 8 NUBs need class-aware updates?

No. All 8 existing NUB handlers (identity/ifc/keys/media/notify/relay/storage/theme) are class-agnostic. Class restricts the capability bitset of new sessions — it does not change handler logic. The per-domain `resolveCapabilitiesNub` mappings in `packages/acl/src/resolve.ts` remain untouched. The `AclStateContainer.check()` call in the enforcement gate already handles "no entry → policy default", which becomes "no entry → class-seeded entry" after the change.

---

## 2. NUB-CONNECT Integration Points

### 2a. Where does the grants registry live?

The grants registry should mirror the `aclStore` pattern: a **new module `connect-store.ts`** in `packages/shell/src/`, exposed as a singleton `connectStore` imported into `hooks-adapter.ts` alongside `aclStore`, `originRegistry`, etc.

Structure:
- Key: `connectStore` (singleton, analogous to `aclStore`)
- Storage key: `'napplet:connect'` in localStorage (analogous to `'napplet:acl'`)
- Entry key: `dTag:aggregateHash` (same composite as `aclStore`)
- Per-entry content: `{ allowedOrigins: string[], grantedAt: number, revokedAt?: number }`

`ShellBridge` exposes it via `bridge.runtime.aclState` precedent: either add `bridge.connectStore` directly to `ShellBridge`, or expose it through `bridge.runtime` (which already exposes `aclState`, `sessionRegistry`, `manifestCache`).

The `RuntimeAdapter` in `packages/runtime/src/types.ts` does not need to know about the grants store. NUB-CONNECT grant checks happen at the **shell** layer (HTTP header authority), not inside the runtime's NUB dispatch. The connect store is shell-only.

### 2b. Where does `connect-src` CSP get applied — dev vs prod?

**Development:** Extend `vite.config.ts`'s `configureServer` middleware. The existing `serveDemoNapplets` plugin (`vite.config.ts:43-53`) shows the pattern: add a second plugin that intercepts napplet requests and injects per-napplet CSP headers.

```typescript
// vite.config.ts — new plugin alongside serveDemoNapplets()
function injectNappletCsp(): Plugin {
  return {
    name: 'inject-napplet-csp',
    configureServer(server) {
      server.middlewares.use('/napplets', (req, res, next) => {
        // per-napplet connect-src from connectStore (loaded from localStorage at server start)
        res.setHeader('Content-Security-Policy', buildConnectSrc(req.url));
        next();
      });
    },
  };
}
```

The dev story requires the Vite dev server to read grants at startup or refresh them on each request. Grants are persisted in localStorage, but the dev server runs in Node — they need to be written to a file (`connect-grants.json`) that the server reads. Alternatively, the demo shell bootstraps the grants into a file on first load via a `bridge.connectStore.exportToFile()` hook.

**Production:** The shell host serves napplets from its own HTTP server (or a CDN with configurable response headers). The production story for a browser-only shell (like the demo) is an HTML `<meta http-equiv="Content-Security-Policy">` tag injected into each napplet's `index.html` at build time. For a server-side shell (e.g., hyprgate serving napplets via its own HTTP layer), response headers are set server-side.

The residual-meta-CSP audit is a **CI build-time check**: scan all napplet `index.html` files for `<meta http-equiv="Content-Security-Policy" content="...connect-src...">` and fail if any contain wildcards or unapproved origins. This is a `scripts/` or `packages/shell/src/csp-audit.ts` utility, not a runtime check.

### 2c. Where does the consent UI render?

The consent UI renders in the **shell DOM**, above the iframe sandbox layer — the same layer where the ACL modal renders in the demo today (`apps/demo/src/acl-modal.ts`). It is NOT inside any napplet iframe.

The runtime already has a `ConsentHandler` pattern (`runtime.ts:88-90`, `registerConsentHandler`). NUB-CONNECT extends this: when a napplet sends `connect.request`, the shell-bridge raises a consent request via the existing `_consentHandler` callback or via a new dedicated `_connectConsentHandler`. The consent UI resolves the promise with allow/deny; on allow, the `connectStore` is updated and a `connect.result` envelope is sent to the napplet.

The existing consent flow for undeclared services (`runtime.ts:265-311`) demonstrates the async grant pattern. NUB-CONNECT follows the same shape.

### 2d. How does the residual-meta-CSP audit gate run?

CI, as a separate build step after `pnpm build`. A script scans `apps/demo/napplets/*/dist/index.html` (and any other napplet dist dirs) for:
1. Any `<meta http-equiv="Content-Security-Policy">` with `connect-src *`
2. Any `<meta>` CSP that overrides the HTTP-level CSP the shell sets

If found, the CI step fails with an explicit "refuse to serve" message. This is a one-time scan utility in `packages/shell/src/csp-audit.ts` exported as a CLI-usable function.

### 2e. Does NUB-RESOURCE depend on NUB-CONNECT grants?

Yes. The dispatch chain:

```
napplet → connect.request (NUB-CONNECT) → shell consent UI → connectStore.grant(origin)
         ↓
napplet → resource.fetch { url } (NUB-RESOURCE)
         ↓
createResourceService.handleMessage
  → resourceHandler checks connectStore.isGranted(windowId, url.origin)
  → if not granted: reply resource.fetch.error { error: 'origin not permitted' }
  → if granted: fetch(url) → resource.fetch.result { body, status }
```

`createResourceService` receives a `connectStore` reference (or a `isOriginGranted(windowId, origin): boolean` callback) via its options. This is the HostXxxBridge pattern: the service is environment-agnostic; the shell wires the concrete grant-check at registration time.

---

## 3. NUB-CONFIG and NUB-RESOURCE Service Architecture

### 3a. Options/bridge shape

Both services follow the established pattern (Decision 18 in PROJECT.md: options object IS the bridge). Proposed shapes:

**`createConfigService(options): ServiceHandler`**

```typescript
// packages/services/src/config-service.ts
export interface ConfigServiceOptions {
  /** Get a config value by key. Shell provides from its own store. */
  get(windowId: string, key: string): Promise<unknown>;
  /** Set a config value. Shell applies persistence + validation. */
  set(windowId: string, key: string, value: unknown): Promise<void>;
  /** List config keys visible to this napplet. */
  keys(windowId: string): Promise<string[]>;
  /** Optional: called when a napplet's config changes (for shell UI refresh). */
  onChange?: (windowId: string, key: string, value: unknown) => void;
}
```

No `HostConfigBridge` type alias is needed — `ConfigServiceOptions` IS the bridge (same as `CacheServiceOptions` for cache, `NotifyServiceOptions` for notify).

**`createResourceService(options): ServiceHandler`**

```typescript
// packages/services/src/resource-service.ts
export interface ResourceServiceOptions {
  /** Check if an origin is permitted for a napplet. Delegates to connectStore. */
  isOriginGranted(windowId: string, origin: string): boolean;
  /**
   * Perform the actual fetch. Shell provides this so it can:
   * - Apply a same-origin proxy in prod
   * - Mock in tests
   * - Add auth headers for specific origins
   * Default: globalThis.fetch
   */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Optional: max response body size in bytes. Default: 1 MB. */
  maxResponseBytes?: number;
}
```

The `isOriginGranted` callback is the bridge to `connectStore` — it keeps the service environment-agnostic (no direct localStorage dependency).

### 3b. Wiring into `runtime.registerService()`

Same pattern as all existing services. In demo `shell-host.ts`:

```typescript
import { createConfigService, createResourceService } from '@kehto/services';

// After bridge creation:
bridge.runtime.registerService('config', createConfigService({
  get: (windowId, key) => configStore.get(windowId, key),
  set: (windowId, key, value) => configStore.set(windowId, key, value),
  keys: (windowId) => configStore.keys(windowId),
}));

bridge.runtime.registerService('resource', createResourceService({
  isOriginGranted: (windowId, origin) => connectStore.isGranted(windowId, origin),
}));
```

Both services register under their NUB domain name (`'config'`, `'resource'`). The runtime's `serviceRegistry` dispatch in `service-dispatch.ts` routes by service name.

NUB dispatch registration: extend `runtime.ts:1099-1106` with two new `nubDispatch.registerNub()` calls:
```typescript
nubDispatch.registerNub('config',   configAdapter);
nubDispatch.registerNub('resource', resourceAdapter);
```

Each adapter follows the existing closed-over pattern (reads `currentWindowId`, delegates to `handleConfigMessage` / `handleResourceMessage`).

Extend `resolve.ts` with two new domain cases to cover cap resolution:
- `'config'` → `{ senderCap: 'config:read' | 'config:write', recipientCap: null }` depending on action
- `'resource'` → `{ senderCap: 'resource:fetch', recipientCap: null }`

Extend `capabilities.ts` `ALL_CAPABILITIES` with `'config:read'`, `'config:write'`, `'resource:fetch'`.

### 3c. Demo wiring — napplet count growth

Yes, each new NUB domain gets a demo napplet. `DEMO_NAPPLETS` grows 10 → 12:
- Add entry `{ name: 'config-demo', label: 'config-demo', ... }` 
- Add entry `{ name: 'resource-demo', label: 'resource-demo', ... }`

Each new napplet lives at `apps/demo/napplets/config-demo/` and `apps/demo/napplets/resource-demo/` — same structure as existing napplets (minimal HTML + `@napplet/shim` + a few NUB calls).

`DEMO_TOPOLOGY_SERVICE_NAMES` in `shell-host.ts:115` should be extended to 10 entries if topology rendering references it; otherwise topology's data-driven loop over `DEMO_NAPPLETS` handles it automatically (per Decision 16).

---

## 4. `@kehto/wm` Abstractions Integration

### 4a. Export structure

The current skeleton exports factory + all types from `packages/wm/src/index.ts` (single file, 88 lines). For v1.7, the recommendation is to **stay in the single `index.ts`** — no subpath (`@kehto/wm/abstractions`) needed at this stage.

What to add to the existing skeleton:
1. **Abstract base classes / interfaces consumers extend:** `WmLayout` abstract class (consumers implement `apply(windows: WindowSnapshot[]): void`) and `WmLayoutRegistry` (maps layout name strings to `WmLayout` instances).
2. **Primitive event types:** `WmEvent` discriminated union (`window-created`, `window-destroyed`, `window-moved`, `workspace-switched`) for the observer pattern.
3. Keep `createWmService` throwing — it remains a signature stub until a concrete implementation is contributed.

No new package subpath needed. The entire v1.7 WM scope is structural primitives only.

### 4b. Consumer wiring contract

The consumer (e.g., `hyprgate/apps/shell/src/lib/services/wm.ts`) implements `WmHostHooks` (already defined in `packages/wm/src/index.ts:34-43`) and provides it to `createWmService`. Since `createWmService` still throws, hyprgate continues using its local implementation. The v1.7 WM work extends the primitive vocabulary available for hyprgate to *import and implement against*, not a runnable service.

**What `@kehto/wm` provides (abstract):**
- `WmHostHooks` interface (already exists)
- `WmService` interface (already exists)
- `Layout` type union (already exists)
- NEW: `WmLayout` abstract class + `WmLayoutRegistry` interface
- NEW: `WmEvent` discriminated union for observer hooks

**What the consumer implements (concrete):**
- A `WmLayout` subclass per layout algorithm (dwindle, master-stack, floating)
- A `WmHostHooks` impl that delegates to the shell's internal state
- A bridge connecting `WmService.window.create()` to Hyprland IPC

### 4c. Does `@kehto/wm` need a peer dep on `@napplet/nub/wm`?

No. WM is **shell-internal** — it is not a NUB domain in the canonical 8-domain set, and v1.7 does not add a 9th WM NUB. Shell commands for WM operations already flow through the existing `shell:create-window` topic in `handleShellCommand` (`runtime.ts:424-430`). `@kehto/wm` has zero `@napplet/*` deps by design (it is a pure abstract layer for the shell's own window management, not a napplet-visible protocol surface).

---

## 5. Build Order / Dependency DAG

### Dependency graph

```
[Wave 0 — Gate condition]
  SPEC resync (NIP-5D.md update from dskvr/nips nip/5d branch)
    ↓ (unblocks)

[Wave 1 — Foundation, parallelizable after Wave 0]
  ├── NUB-CLASS adoption
  │     ↓ (class posture seeding required by)
  │
  └── CACHE polish (cosmetic, no blockers)

[Wave 2 — Depends on NUB-CLASS]
  ├── NUB-CONNECT adoption  (needs class posture to be in session)
  │     ↓ (grants registry required by)
  │
  └── @kehto/wm abstractions  (no dependencies, can run in parallel)

[Wave 3 — Depends on NUB-CONNECT grants]
  ├── NUB-RESOURCE reference service  (needs connectStore.isGranted)
  ├── NUB-CONFIG reference service  (no connectStore dep — parallel)
  └── @kehto/nip66 demo wiring  (ShellAdapter hook exists; no new deps)

[Wave 4 — Depends on NUB-CONFIG + NUB-RESOURCE]
  ├── Demo napplet: config-demo  (needs service registered)
  ├── Demo napplet: resource-demo  (needs service + connect grants in place)
  └── E2E coverage: NUB-CLASS invariant, NUB-CONNECT consent, NUB-CONFIG, NUB-RESOURCE

[Soft-gated — independent of all waves]
  NIP-44 decrypt (shell surface only)
    → BLOCKED on napplet/napplet#3 (upstream: relay.subscribeEncrypted vs identity.decrypt routing decision)
    → Slip to v1.8 if napplet/napplet#3 not resolved during milestone
```

### Parallelization summary

| Wave | Features | Can run in parallel? |
|------|----------|---------------------|
| 0 | SPEC resync | Single task, gate |
| 1 | NUB-CLASS, CACHE polish | Yes |
| 2 | NUB-CONNECT, @kehto/wm abstractions | Yes |
| 3 | NUB-RESOURCE, NUB-CONFIG, nip66 demo wiring | Yes (NUB-CONFIG and nip66 independent of each other; NUB-RESOURCE needs Wave 2 complete) |
| 4 | Demo napplets, E2E coverage | Sequential within napplet (build → test) |

### Upstream verification checkpoint

Before locking Wave 2 and beyond, verify that `@napplet/nub` exports NUB-CLASS and NUB-CONNECT subpaths (`@napplet/nub/class/types`, `@napplet/nub/connect/types`). If not yet published, Wave 2+ must use local type stubs (same approach used for any forward-referencing prior to upstream publish).

---

## 6. E2E Baseline Growth Estimate

v1.6 closed at 54/0/0.

| Feature | New Playwright Specs | Rationale |
|---------|---------------------|-----------|
| SPEC resync (NIP-5D.md) | 0 | File update only — no runtime behavior change |
| NUB-CLASS adoption | 1 | Cross-NUB invariant: napplet with `'sandboxed'` class cannot invoke a capability outside its class default; tested across ≥2 NUB domains |
| NUB-CONNECT adoption | 2 | (1) consent flow: napplet sends `connect.request`, UI appears, user approves, napplet receives `connect.result`; (2) CSP audit gate: napplet without grant attempts `resource.fetch`, receives error |
| NUB-CONFIG reference service | 1 | config-demo napplet Layer-B spec: `config.get` + `config.set` round-trip visible in demo |
| NUB-RESOURCE reference service | 1 | resource-demo napplet Layer-B spec: `resource.fetch` with granted origin returns body |
| @kehto/nip66 demo wiring | 1 | `shell:relay-nip66` roundtrip: `getNip66Suggestions()` returns non-null aggregator data in demo |
| @kehto/wm abstractions | 0 | Structural types only — no runtime behavior, no E2E surface |
| CACHE polish | 0 | Type alias rename — no behavior change |
| NIP-44 decrypt (soft-gated) | 1 if unblocked | Shell-side `identity.decrypt` or `relay.subscribeEncrypted` path |

**Total new specs: +6 (guaranteed) + 1 (soft-gated)**
**Projected close baseline: 60/0/0 (or 61/0/0 if NIP-44 unblocks)**

---

## Component Boundaries: New vs Modified

### New files (v1.7)

| File | Package | Type |
|------|---------|------|
| `packages/shell/src/connect-store.ts` | @kehto/shell | NEW — grants persistence singleton |
| `packages/services/src/config-service.ts` | @kehto/services | NEW — createConfigService factory |
| `packages/services/src/resource-service.ts` | @kehto/services | NEW — createResourceService factory |
| `packages/shell/src/csp-audit.ts` | @kehto/shell | NEW — CSP audit utility |
| `apps/demo/napplets/config-demo/` | apps/demo | NEW — demo napplet |
| `apps/demo/napplets/resource-demo/` | apps/demo | NEW — demo napplet |

### Modified files (v1.7)

| File | Change | Risk |
|------|--------|------|
| `specs/NIP-5D.md` | File replacement from dskvr/nips | Low |
| `packages/acl/src/types.ts` | Add optional `class?` field to AclEntry | Low |
| `packages/acl/src/capabilities.ts` | Add `'config:read'`, `'config:write'`, `'resource:fetch'` | Low |
| `packages/acl/src/resolve.ts` | Add `config` and `resource` domain cases | Low |
| `packages/runtime/src/runtime.ts` | Add `handleConfigMessage`, `handleResourceMessage`, 2x `registerNub` calls | Medium |
| `packages/shell/src/shell-bridge.ts` | Emit `class.assigned` after `shell.init`; wire `connectStore` into `BrowserDeps` | Medium |
| `packages/shell/src/hooks-adapter.ts` | Pass `connectStore` into adapter; pass class posture at registration | Medium |
| `packages/shell/src/shell-init.ts` | Extend `CANONICAL_NUB_DOMAINS` with `'class'`, `'connect'`, `'config'`, `'resource'` | Low |
| `packages/shell/src/types.ts` | No interface changes expected — NUB-CONNECT consent uses existing ConsentHandler pattern | Low |
| `packages/wm/src/index.ts` | Add `WmLayout` abstract class, `WmLayoutRegistry`, `WmEvent` union | Low |
| `apps/demo/src/shell-host.ts` | Extend `DEMO_NAPPLETS` 10→12; register config + resource services; `connectStore` wiring | Medium |
| `apps/demo/vite.config.ts` | Add CSP-injection middleware plugin | Low |

---

## Architecture Patterns (v1.7 inherited conventions)

### Pattern: Options-as-Bridge

All new services follow Decision 18: `createXxxService(options)` where `options` IS the host-bridge injection point. No separate `HostXxxBridge` interface needed unless consumers need to name the type explicitly for their own documentation.

### Pattern: Singleton shell modules

Shell modules (`acl-store.ts`, `origin-registry.ts`, `session-registry.ts`) are module-scoped singletons imported into `hooks-adapter.ts`. `connect-store.ts` follows the same pattern — a module-scoped `connectStore` const, not a factory. This keeps the shell adapter stateless (no instance construction path needed).

### Pattern: Capability-before-dispatch

ACL enforcement (`runtime.ts:1118-1126`) runs before `nubDispatch.dispatch()`. Any new NUB domain (class, connect, config, resource) gets its capabilities resolved by extending `resolveCapabilitiesNub()` in `packages/acl/src/resolve.ts` — no changes to the dispatch path.

### Pattern: Data-driven demo

Decision 16: `DEMO_NAPPLETS` is the single source of truth. Adding config-demo and resource-demo requires only appending two entries to that array; all UI loops (status, ACL rows, sequence-diagram lanes) render automatically.

---

## Key Insertion Points (Phase-Plan Reference)

| Feature | File | Insertion Point |
|---------|------|----------------|
| NUB-CLASS: class.assigned emit | `packages/shell/src/shell-bridge.ts` | Line 224 (after `win.postMessage(initMsg, '*')`) |
| NUB-CLASS: class posture seed | `packages/shell/src/hooks-adapter.ts` | Inside `originRegistry.register()` call site |
| NUB-CLASS: AclEntry.class field | `packages/acl/src/types.ts` | Line 70 (AclEntry interface) |
| NUB-CLASS: cap seeding | `packages/runtime/src/acl-state.ts` | `createAclState()` factory |
| NUB-CONNECT: grants store | `packages/shell/src/connect-store.ts` | New file, import in `hooks-adapter.ts` alongside `aclStore` |
| NUB-CONNECT: CSP middleware | `apps/demo/vite.config.ts` | New plugin alongside `serveDemoNapplets()` |
| NUB-CONNECT: consent handler | `packages/runtime/src/runtime.ts` | Extend `_consentHandler` or add `_connectConsentHandler` |
| NUB-CONFIG: service | `packages/services/src/config-service.ts` | New file, export from `packages/services/src/index.ts` |
| NUB-CONFIG: dispatch registration | `packages/runtime/src/runtime.ts` | Lines 1099-1106 (nubDispatch.registerNub block) |
| NUB-CONFIG: capability constants | `packages/acl/src/capabilities.ts` | After line 35 (extend ALL_CAPABILITIES) |
| NUB-CONFIG: cap resolution | `packages/acl/src/resolve.ts` | After line 247 (extend switch default) |
| NUB-RESOURCE: service | `packages/services/src/resource-service.ts` | New file |
| NUB-RESOURCE: dispatch registration | `packages/runtime/src/runtime.ts` | Lines 1099-1106 |
| @kehto/nip66 demo wiring | `apps/demo/src/shell-host.ts` | `getNip66Suggestions` in `relayConfig` hooks (currently `() => null` stub) |
| @kehto/wm abstractions | `packages/wm/src/index.ts` | Extend after line 88 |
| CACHE polish | `packages/services/src/cache-service.ts` | Add `HostCacheBridge` type alias = `CacheServiceOptions` |
| DEMO_NAPPLETS growth | `apps/demo/src/shell-host.ts` | After line 218 (append config-demo, resource-demo entries) |
| shell.init NUB list | `packages/shell/src/shell-init.ts` | Line 18 (`CANONICAL_NUB_DOMAINS` array) |

---

## Sources

- Code read directly from repository (HIGH confidence, all claims grounded in source)
- `packages/acl/src/` — types, capabilities, resolve, mutations, check
- `packages/runtime/src/runtime.ts` — full dispatch + service routing
- `packages/runtime/src/acl-state.ts` — AclStateContainer
- `packages/shell/src/shell-bridge.ts` — handshake + bridge entry
- `packages/shell/src/acl-store.ts` — singleton store pattern
- `packages/shell/src/types.ts` — ShellAdapter, ShellCapabilities
- `packages/shell/src/shell-init.ts` — CANONICAL_NUB_DOMAINS
- `packages/services/src/` — existing service factory patterns
- `packages/wm/src/index.ts` — current skeleton state
- `apps/demo/src/shell-host.ts` — DEMO_NAPPLETS, service registration
- `apps/demo/vite.config.ts` — CSP middleware extension point
- `.planning/PROJECT.md` — Key Decisions table (decisions 16, 18, 19)

---
*Architecture research for: kehto v1.7 NIP-5D spec adoption & new NUB domains*
*Researched: 2026-04-24*
