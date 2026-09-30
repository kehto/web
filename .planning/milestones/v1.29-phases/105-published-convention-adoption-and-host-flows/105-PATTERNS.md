# Phase 105: Published Convention Adoption and Host Flows - Pattern Map

**Mapped:** 2026-07-26  
**Scope source:** phase brief (no `105-CONTEXT.md` or `105-RESEARCH.md` exists yet)  
**Files classified:** 21 anticipated modified files  
**Analogs found:** 20 / 21

## File Classification

| New/Modified File | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| root `package.json`, `pnpm-lock.yaml` | config / lockfile | dependency resolution | existing workspace package ranges in `packages/{runtime,services,paja,shell}/package.json` | role-match |
| `packages/{acl,cli,firewall,paja,runtime,services,shell}/package.json` | config | dependency resolution | same manifests, current shared `@napplet/core` / `@napplet/nap` peer ranges | exact |
| local convention mirror files, if present | removal | file I/O | current direct imports from published `@napplet/nap/*/types` | partial |
| `packages/paja/src/browser-adapter.ts` | service composition / controller | request-response, event-driven | current dev-only intent wiring in same file | exact |
| `packages/paja/src/browser-host.ts` | host controller | request-response, event-driven | `loadRuntimePointer()` and `installPajaHost()` | exact |
| `packages/paja/src/browser-runtime-tabs.ts` | retained target controller | event-driven | `addRuntimeTab()`, `activateRuntimeTab()`, `startRuntimeTabNavigation()` | exact |
| `packages/paja/src/theme-broadcast.ts` | bridge utility | pub-sub | `createPajaThemeBroadcastLink()` | exact |
| `apps/playground/src/playground-intent-catalog.ts` | catalog utility | transform | `buildPlaygroundIntentCatalog()` | exact |
| `apps/playground/src/shell-host.ts` | host controller | request-response, file I/O | `loadNapplet()` verified-frame lifecycle | exact |
| `apps/playground/src/napplet-resolver.ts` | resolver | file I/O, request-response | `resolvePlaygroundNapplet()` output consumed by `loadNapplet()` | role-match |
| `apps/playground/src/main.ts` / demo hooks | host composition | event-driven | current `DEMO_NAPPLETS` boot + shell-hook installation | role-match |
| `apps/playground/napplets/feed/src/main.ts` | component / demo client | event-driven | `feed-identity-events.ts` controller integration | exact |
| `apps/playground/napplets/feed/src/feed-identity-events.ts` | lifecycle utility | pub-sub | `createFeedIdentityEventController()` | exact |
| `apps/playground/napplets/profile-viewer/src/main.ts` | component / demo client | event-driven | existing profile-open handling, covered by `profile-open.spec.ts` | role-match |
| `apps/playground/napplets/resource-demo/src/main.ts` | component / demo client | file I/O | `setRemoteImageFromBytes()` / `setRemoteImageFromBlob()` | exact |
| `apps/playground/src/theme.ts` | theme bridge | pub-sub | `installNapTheme()` / `applyNapTheme()` | exact |
| Paja/browser and playground tests | test | request-response, event-driven | `browser-host.test.ts`, `browser-runtime-tabs.test.ts`, intent catalog tests | role-match |
| `tests/e2e/paja-runtime-pointer.spec.ts` | E2E test | request-response, file I/O | local relay + Blossom server fixture | exact |
| `tests/e2e/profile-open.spec.ts` | E2E test | event-driven | opaque `srcdoc` frame lookup and emitted request | exact |
| `tests/e2e/nap-resource.spec.ts` | E2E test | file I/O | resource demo visual outcome assertions | exact |
| `tests/e2e/theme-broadcast.spec.ts` and `tests/unit/nip5d-conformance-guard.test.ts` | E2E/static guard test | pub-sub / transform | full theme broadcast and literal protocol-surface guards | exact |

## Pattern Assignments

### Published packages and local-mirror removal

**Primary files:** root `package.json`, `pnpm-lock.yaml`, and every package manifest currently declaring the shared convention ranges: `packages/acl/package.json`, `packages/cli/package.json`, `packages/firewall/package.json`, `packages/paja/package.json`, `packages/runtime/package.json`, `packages/services/package.json`, and `packages/shell/package.json`.

**Analog:** the current homogeneous dependency policy, e.g. `packages/paja/package.json` lines 37-43 and `packages/runtime/package.json` lines 29-34.

```json
"peerDependencies": {
  "@napplet/core": ">=0.23.0 <=0.28.x",
  "@napplet/nap": ">=0.23.0 <=0.28.x"
}
```

**Reuse guidance:** make one atomic range decision across all package manifests that import the conventions. Regenerate the lockfile with pnpm; do not hand-edit its importer/snapshot graph. Replace imports only after the published package names and exported paths are verified from the installed package. Remove a local mirror only after `rg` proves every production and test import has moved to the published package.

**Collision risk:** ranges occur in both peer and dev dependencies. Updating only one produces a workspace that compiles locally through a hoisted package yet publishes an incompatible peer contract. `@napplet/shim` in `packages/shell/package.json` is deliberately a distinct pinned dependency and should not be swept into a broad convention-range edit.

### Installed verified-manifest catalog and retained intent target policy

**Modify:** `packages/paja/src/browser-adapter.ts`; likely add a focused catalog/target helper under `packages/paja/src/` rather than expanding the host file further.  
**Analog:** `packages/services/src/catalog-intent-resolver.ts` lines 165-285 and `apps/playground/src/playground-intent-catalog.ts` lines 43-53.

```ts
export function buildPlaygroundIntentCatalog(
  napplets: ReadonlyArray<IntentCatalogSource>,
): IntentCatalogEntry[] {
  return napplets.map((napplet) =>
    manifestToIntentCatalogEntry({
      dTag: napplet.dTag,
      ...(napplet.title === undefined ? {} : { title: napplet.title }),
      archetypes: [...napplet.archetypes],
    }),
  );
}
```

```ts
const catalog = await loadCatalog();
const candidates = candidatesFor(catalog, archetype, getDefaultHandler?.(archetype));
if (candidates.length === 0) return fail(archetype, action, 'no handler');
const pickedDTag = await pickHandler(archetype, candidates, request.handler, context.windowId);
```

**Replace, do not extend, the temporary simulator:** `packages/paja/src/browser-adapter.ts` lines 428-461 explicitly labels its `DEV_INTENT_*` resolver as Phase 105 temporary wiring. The new resolver should load only installed, verified targets and return a retained delivery whose `start()` owns target creation/reuse; it must not derive a catalog from arbitrary live sessions.

**Collision risk:** `createCatalogIntentResolver()` is a useful selection algorithm but its default `windows.open()` contract creates a fresh window. Paja needs target-key reuse and iframe lifecycle ownership, so adapt its catalog-selection boundary rather than calling it in a way that bypasses retained tab policy.

### Paja retained targets, readiness, persistence, and reuse

**Modify:** `packages/paja/src/browser-host.ts`, `packages/paja/src/browser-runtime-tabs.ts`, and their tests.  
**Analogs:** `loadRuntimePointer()` (`browser-host.ts` lines 477-536), `installPajaHost()` (lines 648-753), `addRuntimeTab()` (`browser-runtime-tabs.ts` lines 213-237), `activateRuntimeTab()` (lines 169-190), and navigation (lines 421-459).

```ts
const duplicate = options.skipDuplicatePrompt ? undefined : state.tabs.find((tab) => tab.key === resolvedTargetKey(resolvedTarget));
if (duplicate) {
  const choice = await showDuplicatePointerDialog();
  if (choice === 'open-tab') {
    activateRuntimeTab(state, context, duplicate.id);
    if (options.persist !== false) persistRuntimeTabs(state);
    return;
  }
}
addRuntimeTab(state, context, pointer, resolvedTarget);
if (options.persist !== false) persistRuntimeTabs(state);
```

```ts
state.activeTabId = tab.id;
state.resolvedTarget = tab.resolvedTarget;
context.runtime.currentWindowId = tab.windowId;
for (const entry of state.tabs) entry.frame.hidden = entry.id !== tab.id;
renderRuntimeTabs(state);
```

```ts
if (data && typeof data === 'object' && data.type === 'shell.ready') {
  if (sourceWindowId) runtime.readyWindowIds.add(sourceWindowId);
  if (sourceTab) {
    sourceTab.status = 'ready';
    if (state.activeTabId === sourceTab.id) setStatus(state, 'ready');
    renderRuntimeTabs(state);
  }
}
```

**Reuse guidance:** centralize all create/reuse/replace/destroy decisions in the runtime-tab controller. Persist pointer descriptors, not frame, session, `Window`, or object identity. On restore, send descriptors back through the existing resolution path, then make the tab active only once its freshly generated source reaches source-bound `shell.ready`.

**Teardown pattern:** `destroyRuntimeTab()` lines 389-397 destroys runtime state, unregisters session + origin, removes readiness, then removes the DOM frame. Keep this exact ownership order for replacement/close to avoid a stale source receiving a session or theme event.

### Playground resolver and shell-host lifecycle

**Modify:** `apps/playground/src/shell-host.ts`, `apps/playground/src/napplet-resolver.ts`, `apps/playground/src/main.ts`, and focused host tests.  
**Analog:** `loadNapplet()` at `shell-host.ts` lines 440-535.

```ts
const resolved = await resolvePlaygroundNapplet({ dTag: name, /* relay + Blossom */ });
const identity = Object.freeze({ dTag, aggregateHash });
const environment = getPlaygroundShellEnvironment(identity);
// register creation-time identity before authored bytes execute
originRegistry.register(iframe.contentWindow, windowId, identity);
originRegistry.setEnvironment(iframe.contentWindow, environment);
iframe.srcdoc = injectNappletNamespacePrelude(
  injectCspMeta(resolved.indexHtml, origins),
  environment.capabilities,
);
```

**Reuse guidance:** make catalog installation a separate collection from the `napplets` live-session map. The resolver remains the sole verifier; `shell-host` owns DOM frame + origin-registration lifetime. Re-register a swapped `contentWindow` in the existing `load` listener before accepting readiness or bridge traffic.

**Collision risk:** never add an alternate host path that puts resolver bytes directly in `iframe.srcdoc`; this would bypass the injected prelude/CSP and source-bound identity contract. This is an ARCH-03 boundary, not cosmetic host plumbing.

### Feed/profile intent delivery

**Modify:** feed and profile-viewer napplet `main.ts` files; retain or extend `feed-identity-events.ts` only if the published identity package changes its subscription shape.  
**Analogs:** `createFeedIdentityEventController()` at `feed-identity-events.ts` lines 19-73 and the end-to-end source/target flow in `tests/e2e/profile-open.spec.ts` lines 9-46.

```ts
function start(): Promise<void> {
  if (!stopped) return Promise.resolve();
  stopped = false;
  changeSubscription = options.subscribeToChanges?.(applyPubkey) ?? null;
  return refreshNow();
}

function stop(): void {
  stopped = true;
  changeSubscription?.close();
  changeSubscription = null;
}
```

**Reuse guidance:** keep idempotent start/stop and `inFlight` suppression; bind the published identity/profile conventions through this controller, then emit the profile request only after APIs are usable. E2E must locate the opaque `srcdoc` feed frame by container, as the existing test does, rather than URL.

### Resource bytes and object-URL cleanup

**Modify:** `apps/playground/napplets/resource-demo/src/main.ts`; add/update resource convention tests.  
**Analog:** `setRemoteImageFromBytes()` and `setRemoteImageFromBlob()` at lines 117-146; shell-side multiple-resource cleanup is also in `packages/shell/src/napplet-namespace.ts` lines 1050-1064.

```ts
if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
const objectUrl = URL.createObjectURL(blob);
currentObjectUrl = objectUrl;
imageEl.src = objectUrl;
imageEl.addEventListener('load', () => {
  URL.revokeObjectURL(objectUrl);
  if (currentObjectUrl === objectUrl) currentObjectUrl = null;
}, { once: true });
```

**Reuse guidance:** retain exactly one active preview URL; revoke the preceding one before replacement and revoke the selected URL after `load` only if it is still current. Also revoke during terminal unload/teardown. Keep bytes decoding/content type close to the rendering sink; do not promote browser URLs into the resource-service contract.

### Theme service and bridge synchronization

**Modify:** `packages/paja/src/theme-broadcast.ts`, `packages/paja/src/browser-host.ts`, Paja adapter composition, `apps/playground/src/theme.ts`, and theme tests.  
**Analogs:** `createPajaThemeBroadcastLink()` in `theme-broadcast.ts` lines 9-30; `installNapTheme()` at `apps/playground/src/theme.ts` lines 253-259; `theme-broadcast.spec.ts` lines 31-122.

```ts
attach(bridge): void {
  if (attachedBridge) throw new Error('Paja theme broadcast link is already attached.');
  attachedBridge = bridge;
},
onBroadcast(envelope): void {
  if (!attachedBridge) throw new Error('Paja theme broadcast occurred before a ShellBridge is attached.');
  attachedBridge.publishTheme(envelope.theme);
}
```

```ts
const hostTheme = readHostThemeSnapshot();
applyNapTheme(hostTheme ?? DEFAULT_NAP_THEME);
ensureThemeMessageListener();
```

**Reuse guidance:** retain a single ThemeService owner and a single explicit bridge attachment seam. Initialize a late-joining napplet from the host snapshot, then deliver source-bound change events. Do not buffer/replay on an unattached bridge; the current link intentionally fails that lifecycle error.

## Shared Patterns

### Source-bound iframe trust and readiness

**Sources:** `packages/paja/src/browser-host.ts` lines 685-718; `apps/playground/src/shell-host.ts` lines 479-523.  
**Apply to:** every Paja/playground target lifecycle change.

Map `MessageEvent.source` to the registered iframe/session first, proxy only that source into `ShellBridge`, and treat `shell.ready` as a signal for the registered generation. The theme E2E’s forged sibling-ready check (lines 69-83) is the regression template.

### Error containment and visible state

**Sources:** `browser-host.ts` lines 493-536 and `browser-runtime-tabs.ts` lines 443-459.  
**Apply to:** resolver and target-start paths.

Use status transitions plus `appendPajaMessageLog()`; catch async resolution/navigation errors, replace failed target content with `renderTargetErrorHtml()`, and preserve the active tab’s coherent status. Never leave a failed Promise only in the console.

### Tests: browser proof plus static conformance

**Sources:** `tests/e2e/paja-runtime-pointer.spec.ts` lines 29-100; `tests/e2e/profile-open.spec.ts` lines 9-46; `tests/e2e/nap-resource.spec.ts` lines 9-32; `tests/e2e/theme-broadcast.spec.ts` lines 31-122; `tests/unit/nip5d-conformance-guard.test.ts` lines 39-147.

For each convention migration, pair a focused unit/static import/shape guard with an E2E path that verifies the live host, opaque iframe, source-bound lifecycle, and visible napplet outcome. The Paja pointer test’s local HTTP/WebSocket/Blossom fixture is the model for deterministic resolver coverage; avoid making normal CI depend on live relays.

## Dependency Order

1. Verify published package exports and update all manifest ranges/lockfile; remove mirror imports only after the installed contract is confirmed.
2. Migrate convention type imports/services behind their existing composition seams, keeping the build green before host behavior changes.
3. Introduce the verified installed-manifest catalog as persistent state separate from live sessions.
4. Replace Paja’s development intent simulator with catalog selection plus retained target create/reuse/replacement policy.
5. Wire retained Paja targets into tab persistence, fresh resolution, source-bound readiness, teardown, and theme attachment.
6. Connect playground’s verified resolver/catalog to shell-host frame lifecycle without changing the `srcdoc` trust boundary.
7. Update feed/profile/resource/theme demo clients to the published interfaces and cleanup semantics.
8. Add unit/static guards, then deterministic Paja + playground E2E coverage for each completed live flow.

## Collision Risks

| Risk | Why it matters | Guardrail |
|---|---|---|
| Catalog conflated with sessions | Closed/reloaded targets disappear from intent availability or unverified frames become candidates. | Catalog stores verified installed manifests; session registry stays runtime-only. |
| Retained `start()` starts before result | Breaks the established intent acceptance ordering. | Reuse `IntentRetainedDelivery`; result is accepted before target `start()` executes. |
| Frame/source replacement race | `srcdoc` can swap `contentWindow`, making a stale source trusted. | Re-register in load callback and key readiness by window generation. |
| Paja duplication path bypasses persistence | Reused target appears active but restoration or readiness state is wrong. | Route both initial load and restore through runtime-tab helpers. |
| Object URL premature revoke | Image load fails or a newer preview’s URL is cleared by an older handler. | Revoke conditionally against `currentObjectUrl`; use `{ once: true }`. |
| Broad package upgrade | Peer/dev range skew and stale transitive lock entries mask incompatibility. | Update all importers together; regenerate and inspect lockfile. |
| Theme fan-out duplication | Multiple listeners cause duplicate `theme.changed` or untrusted readiness delivery. | One ThemeService owner; use `createPajaThemeBroadcastLink()` and forged-source E2E assertion. |

## No Analog Found

| File/concern | Role | Data Flow | Reason |
|---|---|---|---|
| Exact published package names/exports and exact local mirror paths | config/removal | dependency resolution | Phase brief names the outcome but the phase context/research artifacts are absent; inspect the installed package after range selection before planning exact paths. |

## Metadata

**Analog search scope:** `packages/paja`, `packages/services`, `packages/shell`, `apps/playground`, `tests/e2e`, `tests/unit`, package manifests, and lockfile.  
**Discovery method:** codebase graph first (`Users-sandwich-Develop-kehto`), then source/config string search where graph coverage does not include manifests or literal protocol imports.  
**Pattern extraction date:** 2026-07-26
