---
phase: 40-nub-resource-demo-policy
plan: "02"
subsystem: demo/shell-host/napplets
tags:
  - nub-resource
  - resource-demo
  - demo-napplet
  - auto-grant
  - csp
  - shell-host
dependency_graph:
  requires:
    - 40-01 (createResourceService factory + provisional-resource types)
    - 39-04 (__grantConnectOrigin__ test hook; connectStore grants store)
    - 39-03 (serveNappletCsp Vite plugin; /__connect-grants endpoint)
  provides:
    - resource-demo napplet (12th; exercises resource.bytes granted + denied paths)
    - DEMO_NAPPLETS = 12 entries; CLASS_BY_DTAG = 12 entries
    - createResourceService wired in createDemoHooks() (services.resource)
    - auto-grant fixture: resource-demo pre-granted http://localhost:5174 at boot (D3)
    - apps/demo/public/demo-data.json static fixture for E2E assertion
  affects:
    - 40-03 (nub-resource.spec.ts E2E asserts #resource-demo-granted + #resource-demo-denied)
tech_stack:
  added:
    - resource-demo napplet (5-file scaffold mirroring config-demo layout)
    - demo-data.json static fixture served by Vite public/ at /demo-data.json
    - createResourceService wiring in shell-host.ts with hostFetch (AbortController + 10s timeout)
  patterns:
    - deferred _sessionRegistryRef pattern (factory constructed before relay, ref assigned after)
    - provisional resource dispatch: window.parent.postMessage + focused message listener
    - hoist-before-nappletInfos for pre-load auto-grant ordering guarantee
key_files:
  created:
    - apps/demo/napplets/resource-demo/index.html (74 lines)
    - apps/demo/napplets/resource-demo/package.json (20 lines)
    - apps/demo/napplets/resource-demo/tsconfig.json (12 lines)
    - apps/demo/napplets/resource-demo/vite.config.ts (15 lines)
    - apps/demo/napplets/resource-demo/src/main.ts (211 lines)
    - apps/demo/public/demo-data.json (6 lines)
  modified:
    - apps/demo/src/shell-host.ts (+87 lines: imports, DEMO_NAPPLETS[12], CLASS_BY_DTAG[12], hostFetch, createResourceService, _sessionRegistryRef)
    - apps/demo/src/main.ts (+36 net lines: hoist connect hooks, add auto-grant block)
decisions:
  - "deferred _sessionRegistryRef pattern chosen over post-bootShell registerService (cleaner: keeps services.resource inside createDemoHooks services object, avoids invasive bootShell changes)"
  - "provisional resource.bytes dispatch via window.parent.postMessage + focused message listener (source===window.parent + resource. prefix) — @napplet/sdk has no resource namespace; consistent with provisional strategy for all 3 unpublished NUB domains"
  - "hoist syncGrantsToVite + grant/revoke hooks to before DEMO_NAPPLETS.map() so D3 auto-grant reaches serveNappletCsp before iframe first HTTP request (CSP connect-src must be in response headers on first load)"
metrics:
  duration: "~7 minutes (431s)"
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_modified: 2
  files_created: 6
---

# Phase 40 Plan 02: resource-demo Napplet + Demo Wiring + Auto-grant Fixture Summary

**One-liner:** resource-demo napplet (12th) scaffolded with two-panel layout + provisional resource.bytes dispatch; createResourceService registered in shell-host with deferred registry ref and 10s hostFetch; auto-grant fixture pre-seeds http://localhost:5174 before iframe load (D3).

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Scaffold resource-demo napplet (6 files: HTML, package.json, tsconfig, vite.config, src/main.ts, demo-data.json) | `4820c1f` | Done |
| 2 | Wire createResourceService + resource-demo in shell-host.ts (DEMO_NAPPLETS[12], CLASS_BY_DTAG, services.resource) | `b4b709e` | Done |
| 3 | Auto-grant fixture + iframe-load ordering in apps/demo/src/main.ts (D3) | `0f94cdd` | Done |

## New / Modified Files with Line Counts

| File | Lines | Notes |
|------|-------|-------|
| `apps/demo/napplets/resource-demo/src/main.ts` | 211 | NEW — provisional resource.bytes dispatch, two-panel sentinels, onResourceEnvelope listener |
| `apps/demo/napplets/resource-demo/index.html` | 74 | NEW — #resource-demo-granted + #resource-demo-denied sentinels; no meta-CSP |
| `apps/demo/napplets/resource-demo/package.json` | 20 | NEW — @napplet/shim + @napplet/sdk deps |
| `apps/demo/napplets/resource-demo/vite.config.ts` | 15 | NEW — nip5aManifest({ nappletType: 'demo-resource' }) |
| `apps/demo/napplets/resource-demo/tsconfig.json` | 12 | NEW — ES2022 + DOM + bundler moduleResolution |
| `apps/demo/public/demo-data.json` | 6 | NEW — { name, version, items, source } |
| `apps/demo/src/shell-host.ts` | 1457 | +87 lines: connectStore + createResourceService imports, DEMO_NAPPLETS 12th entry, CLASS_BY_DTAG 12th entry, hostFetch, createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity }), _sessionRegistryRef, bootShell assignment |
| `apps/demo/src/main.ts` | 1062 | +36 net lines: hoist connect hooks (syncGrantsToVite, __grantConnectOrigin__, __revokeConnect__, shell:connect-revoked listener); add resource-demo auto-grant block |

## resolveIdentity Approach Decision

**Chosen: deferred _sessionRegistryRef pattern**

`createResourceService()` is constructed inside `createDemoHooks()` before `relay = createShellBridge(hooks)` (the factory must be in the `services` object passed to `createShellBridge`). The `resolveIdentity` option requires `sessionRegistry.getEntryByWindowId`, which only exists after `createShellBridge`.

Solution: module-level `_sessionRegistryRef` variable (typed as `{ getEntryByWindowId(...): SessionEntry | undefined } | null`). Inside `createDemoHooks()`, the `resolveIdentity` closure reads from `_sessionRegistryRef?.getEntryByWindowId(windowId)`. In `bootShell()`, immediately after `relay = createShellBridge(hooks)`, the ref is assigned: `_sessionRegistryRef = relay.runtime.sessionRegistry`.

Timing safety: the first `resource.bytes` dispatch cannot arrive until after `bootShell()` returns AND the napplet iframe loads AND authenticates. The ref assignment window is therefore safe — no race condition.

Alternative rejected (post-bootShell `relay.runtime.registerService`): would require constructing the handler outside `createDemoHooks()` and registering it separately in `bootShell()` after bridge creation. More invasive, breaks the services-object pattern used by all other handlers.

## Provisional resource.bytes Dispatch Strategy

`@napplet/sdk@0.2.1` exports: `config, identity, ipc, keys, media, notify, relay, storage` — no `resource` namespace. `@napplet/shim@0.2.1` does not include `installResourceShim`. Resource is not yet published in `@napplet/nub`.

Provisional approach for resource-demo:
- **Outbound**: `window.parent.postMessage({ type: 'resource.bytes', requestId, url }, '*')` — same mechanism all NUB packages use internally
- **Inbound**: dedicated `window.addEventListener('message', ...)` that ONLY handles `resource.*` messages (checks `event.source === window.parent` + `msg.type.startsWith('resource.')`) — mirrors `@napplet/shim`'s `handleEnvelopeMessage` pattern exactly
- Wire types inlined in main.ts (mirrors provisional-resource.ts shapes) — avoids cross-package import in a standalone napplet context

When `@napplet/nub@^0.2.2` ships with the resource subpath: swap `window.parent.postMessage` to `sdk.resource.bytes(...)` and remove the raw listener.

## DEMO_NAPPLETS.length === 12 Confirmation

```
node -e "const src = require('fs').readFileSync('apps/demo/src/shell-host.ts','utf8'); const m = src.match(/export const DEMO_NAPPLETS[^=]+=\s*\[([\s\S]+?)\];/); const count = (m[1].match(/name:\s*'/g) || []).length; console.log('DEMO_NAPPLETS:', count);"
# → DEMO_NAPPLETS: 12
```

H-05 module-load assertion holds: `CLASS_BY_DTAG` has 12 entries matching all 12 `DEMO_NAPPLETS` names. Missing entries would throw at `pnpm build` time.

## CSP Header Verification

The auto-grant (`grantFn('resource-demo', '', 'http://localhost:5174')`) runs BEFORE `DEMO_NAPPLETS.map(loadNapplet)`. This calls `connectStore.grant('resource-demo', '', ['http://localhost:5174'])` + `syncGrantsToVite` which POSTs to `/__connect-grants`. The Phase 39 Plan 39-03 `serveNappletCsp` plugin reads from this map and emits `Content-Security-Policy: connect-src localhost:5174` on the `/napplets/resource-demo/index.html` HTTP response.

In `pnpm preview` mode, curl verification:
```
curl -sI http://localhost:4174/napplets/resource-demo/index.html | grep -i content-security-policy
# → Content-Security-Policy: ... connect-src 'self' http://localhost:5174 ...
```

(Preview mode uses built dist — auto-grant POST hits the preview server's `/__connect-grants` handler on page load. E2E-25 in Wave 3 will assert this in dev server mode where the grant fires synchronously before iframe load.)

## Workspace Verification

| Check | Result |
|-------|--------|
| `pnpm build` | 26/26 tasks successful |
| `pnpm type-check` | 10/10 tasks successful |
| `pnpm exec vitest run` | 517/517 tests pass |
| `pnpm audit:csp` | OK — 12 napplet dist/index.html files, no meta-CSP found |
| `pnpm --filter @kehto/demo-resource-demo build` | vite build success, 14 modules |
| `DEMO_NAPPLETS.length` | 12 |
| `CLASS_BY_DTAG` entries | 12 (resource-demo: null) |
| demo-data.json valid JSON | yes |
| no meta-CSP in resource-demo | confirmed |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Implementation Notes

**1. [Design choice] Hoist timing validation**
The plan noted that `__grantConnectOrigin__` was defined after `nappletInfos = DEMO_NAPPLETS.map(...)` in the original file. The hoist moved `syncGrantsToVite`, `__grantConnectOrigin__`, `__revokeConnect__`, and the `shell:connect-revoked` listener to BEFORE `nappletInfos`. The Phase 39 Plan 39-04 `shell:connect-revoked` listener's snapshot-before-mutate pattern (`[...napps.entries()].filter(...)`) was preserved verbatim — no mutation to revocation semantics.

**2. [Design choice] debuggerEl reference omitted**
The plan's example auto-grant block referenced `debuggerEl?.addSystemMessage(...)`. `debuggerEl` is not directly accessible in main.ts at that point (it's module-internal in debugger.js). Used `console.info` instead — functionally equivalent for boot diagnostics; Wave 3 E2E does not assert on debugger log content.

## Known Stubs

None — all panels are wired to real data sources:
- `#resource-demo-granted`: populated from actual `resource.bytes.result.bodyBase64` (decoded JSON from http://localhost:5174/demo-data.json)
- `#resource-demo-denied`: populated from actual `resource.bytes.error` (code=denied from https://untrusted.example)
- `demo-data.json`: deterministic fixture, not mock data

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `apps/demo/napplets/resource-demo/index.html` | FOUND |
| `apps/demo/napplets/resource-demo/src/main.ts` | FOUND |
| `apps/demo/napplets/resource-demo/package.json` | FOUND |
| `apps/demo/napplets/resource-demo/vite.config.ts` | FOUND |
| `apps/demo/napplets/resource-demo/tsconfig.json` | FOUND |
| `apps/demo/public/demo-data.json` | FOUND |
| Commit `4820c1f` (Task 1) | FOUND |
| Commit `b4b709e` (Task 2) | FOUND |
| Commit `0f94cdd` (Task 3) | FOUND |
| `pnpm exec vitest run` | 517/517 PASS |
| `pnpm type-check` | 10/10 PASS |
| `pnpm build` | 26/26 PASS |
| `pnpm audit:csp` | OK (12 napplets) |
