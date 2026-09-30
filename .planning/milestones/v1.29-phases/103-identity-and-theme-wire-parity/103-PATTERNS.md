# Phase 103: Identity and Theme Wire Parity - Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 17 anticipated modifications/tests  
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/services/src/identity-service.ts` | service | request-response | itself, optional-provider result branches | exact |
| `packages/services/src/identity-service.test.ts` | test | request-response | existing service fixture tests | exact |
| `packages/services/src/theme-service.ts` | service | request-response + event-driven | itself, `publishTheme` state/callback | exact |
| `packages/services/src/theme-service.test.ts` | test | event-driven | existing state/broadcast tests | exact |
| `packages/runtime/src/identity-handler.ts` | controller/handler | request-response | `handleThemeMessage` fallback | role-match |
| `packages/runtime/src/domain-handlers.ts` | controller/handler | request-response | existing `handleThemeMessage` | exact |
| `packages/runtime/src/runtime.ts` | middleware/utility | request-response | `denialResponseType` used by ACL and firewall gates | exact |
| `packages/runtime/src/dispatch.test.ts` | test | request-response | existing ACL/firewall envelope tests | exact |
| `packages/shell/src/shell-bridge.ts` | bridge/controller | event-driven | `handleMessage` + `shellReadyState` composition | role-match |
| `packages/shell/src/shell-ready.ts` | session middleware | event-driven | frozen per-window environment/session registration | exact |
| `packages/shell/src/shell-bridge.test.ts` | test fixture | event-driven | fake iframe + shell.ready registration tests | exact |
| `packages/shell/src/napplet-namespace.ts` | browser binding | request-response + event-driven | identity/theme factories and namespace proxy | exact |
| `packages/shell/src/napplet-namespace.test.ts` | test fixture | event-driven | parent-message prelude harness | exact |
| `packages/paja/src/browser-adapter.ts` | host wiring | event-driven | `createDevServices` theme-bundle capture | exact |
| `packages/paja/src/browser-host.ts` | host controller | event-driven | `setThemeMode` → captured service update | exact |
| `apps/playground/src/demo-hooks.ts` | host wiring | event-driven | theme service registration in `createDemoHooks` | exact |
| `apps/playground/src/main-preferences.ts` and `apps/playground/src/shell-host.ts` | host controller | event-driven | existing preference update / identity lifecycle paths | role-match |

## Pattern Assignments

### `packages/services/src/identity-service.ts` (service, request-response)

**Analog:** the existing optional-provider result pattern in this file.

**Safe typed-result pattern** ([`identity-service.ts:77-93`](../../../packages/services/src/identity-service.ts#L77-L93)):

```ts
if (!buildResult) {
  send(fallbackResult);
  return;
}

Promise.resolve(getCurrentPubkey(options))
  .then((pubkey) => buildResult(pubkey))
  .then((result) => send(result))
  .catch((err: unknown) => sendProviderError(send, fallbackResult, errorFallback, err));
```

Retain the one-response asynchronous structure, but make the `getPublicKey` catch send its already-typed `identity.getPublicKey.result` fallback (`pubkey: ''`) rather than a derived error envelope. The existing no-signer branch is the exact public-key sentinel pattern ([223-245](../../../packages/services/src/identity-service.ts#L223-L245)). For each other supported read, retain its explicit field fallback (`{}`, `null`, `[]`) illustrated by [273-371](../../../packages/services/src/identity-service.ts#L273-L371). Unknown identity actions should return without sending, replacing the current default error at [416-419](../../../packages/services/src/identity-service.ts#L416-L419).

### `packages/services/src/theme-service.ts` (service, request-response + event-driven)

**Analog:** existing single state owner and callback in the same file.

**Get-result and state-before-push pattern** ([`theme-service.ts:152-186`](../../../packages/services/src/theme-service.ts#L152-L186)):

```ts
if (message.type === 'theme.get') {
  const result: ThemeGetResultMessage = {
    type: 'theme.get.result',
    id,
    theme: currentTheme,
  };
  send(result as NappletMessage);
  return;
}

function publishTheme(theme: Theme): ThemeChangedMessage {
  currentTheme = theme;
  const envelope: ThemeChangedMessage = { type: 'theme.changed', theme };
  options.onBroadcast?.(envelope);
  return envelope;
}
```

Keep `publishTheme` as the only mutation: assignment precedes the sole synchronous callback, so a subsequent `theme.get` observes the byte-equivalent theme. Replace the current unknown-message error branch ([169-173](../../../packages/services/src/theme-service.ts#L169-L173)) with a no-op; do not add subscribe/unsubscribe behavior.

### `packages/runtime/src/identity-handler.ts` and `packages/runtime/src/domain-handlers.ts` (handlers, request-response)

**Analog:** service-first fallback routing in [`identity-handler.ts:14-18`](../../../packages/runtime/src/identity-handler.ts#L14-L18) and [`domain-handlers.ts:162-176`](../../../packages/runtime/src/domain-handlers.ts#L162-L176).

```ts
const identityService = serviceRegistry['identity'];
if (identityService) {
  identityService.handleMessage(windowId, msg, (resp) => hooks.sendToNapplet(windowId, resp));
  return;
}
```

```ts
if (msg.type === 'theme.get') {
  hooks.sendToNapplet(windowId, {
    type: 'theme.get.result', id: m.id ?? '', theme: THEME_FALLBACK_DEFAULT,
  } as NappletMessage);
}
```

Preserve service-first dispatch and only produce results for known actions. The concrete fallback constant in `domain-handlers.ts` is the source for a complete theme payload when a service is unavailable. Replace the local `sendError` / derived `${msg.type}.error` helper in [`identity-handler.ts:24-29`](../../../packages/runtime/src/identity-handler.ts#L24-L29) with a narrow supported-action result factory, shared where practical with runtime denial shaping.

### `packages/runtime/src/runtime.ts` and `packages/runtime/src/dispatch.test.ts` (middleware + test, request-response)

**Analog:** one response-shaping seam consumed by both gates.

**Shared ACL/firewall structure** ([`runtime.ts:270-283`](../../../packages/runtime/src/runtime.ts#L270-L283), [`runtime.ts:324-341`](../../../packages/runtime/src/runtime.ts#L324-L341)):

```ts
const id = (envelope as NappletMessage & { id?: string }).id ?? '';
const type = denialResponseType(envelope);
if (type) {
  hooks.sendToNapplet(windowId, { type, id, error } as NappletMessage);
}
return 'drop';
```

Use a typed canonical-result factory at this existing common seam so ACL and firewall denial share exactly one identity/theme response policy. It must recognize only known `identity.*` actions and `theme.get`, return a complete query's result value, and return `null` for unknown actions; leave unrelated domains on the current behavior. This avoids fixing service dispatch while retaining synthesized `identity.*.error` or `theme.*.error` at ingress. Test both gates and exact single-envelope cardinality in `dispatch.test.ts`.

### `packages/shell/src/shell-ready.ts` and `packages/shell/src/shell-bridge.ts` (session middleware/bridge, event-driven)

**Analog:** frozen environment domain grant and source-bound session registration.

**Eligibility foundations** ([`shell-ready.ts:34-40`](../../../packages/shell/src/shell-ready.ts#L34-L40), [`shell-ready.ts:78-104`](../../../packages/shell/src/shell-ready.ts#L78-L104)):

```ts
isDomainAllowed(windowId, domain): boolean {
  return environments.get(windowId)?.capabilities.domains.includes(domain) ?? false;
}

const entry: SessionEntry = { windowId, dTag: identity.dTag, aggregateHash: identity.aggregateHash,
  /* source-bound metadata */ provenance: 'nip-5d' };
runtime.sessionRegistry.register(windowId, entry);
state.sessionRegistration.set(windowId, sourceRegistrationId);
```

Build a single bridge-owned eligible-session push helper adjacent to `broadcastToNapplets`. Iterate live session entries/windows, require the frozen environment to include the pushed domain, and resolve the same registered iframe window before posting. Then route both public `publishTheme` and `publishIdentityChanged` through it. The old raw pattern ([`shell-bridge.ts:205-216`](../../../packages/shell/src/shell-bridge.ts#L205-L216)) is explicitly not reusable because it enumerates registrations before `shell.ready` and ignores domain grants.

Do not move source authentication out of `handleMessage`: its `event.source` → `originRegistry` → `shell.ready` ordering at [220-251](../../../packages/shell/src/shell-bridge.ts#L220-L251) is the established trust boundary.

### `packages/shell/src/napplet-namespace.ts` (browser binding, request-response + event-driven)

**Analog:** identity/theme request correlation plus parent-only change delivery.

**Protected listener and result-correlation pattern** ([`napplet-namespace.ts:661-705`](../../../packages/shell/src/napplet-namespace.ts#L661-L705)):

```ts
const read = <T>(type: string, field: string, fallback: T) => request(
  { type }, `${type}.result`,
  (msg) => (Object.prototype.hasOwnProperty.call(msg, field) ? msg[field] : fallback) as T,
  { rejectOnError: type !== 'identity.getPublicKey' },
);

const off = listen((event) => {
  if (!isParentMessage(event)) return;
  const msg = event.data as RuntimeMessage;
  if (typeof msg !== 'object' || msg === null || msg.type !== 'identity.changed') return;
  if (typeof msg.pubkey === 'string') handler(msg.pubkey);
});
```

Keep parent-source filtering and the request-correlator; do not create a child-to-parent identity/theme change path. If Phase 103 protects later reassignment, follow the namespace's existing controlled construction seam (`makeDomain` and `guardNappletNamespace`, [1427-1462](../../../packages/shell/src/napplet-namespace.ts#L1427-L1462)) rather than ad-hoc host globals. Scope that decision narrowly: current behavior deliberately rebuilds a permitted domain on assignment.

### `packages/paja/src/browser-adapter.ts` and `packages/paja/src/browser-host.ts` (host wiring/controller, event-driven)

**Analog:** capture the service bundle at construction, then update it from the host state transition.

```ts
const theme = createThemeService({
  initialTheme: createDevTheme(getSimulation().theme.mode, getSimulation().theme.values),
  onBroadcast: () => {},
});
onThemeService(theme);
```

([`browser-adapter.ts:321-334`](../../../packages/paja/src/browser-adapter.ts#L321-L334))

```ts
runtime.themeService?.publishTheme(
  createDevTheme(runtime.currentSimulation.theme.mode, runtime.currentSimulation.theme.values),
);
```

([`browser-host.ts:571-581`](../../../packages/paja/src/browser-host.ts#L571-L581))

Preserve this separation: the adapter owns service construction, host controller owns one simulation update. Replace only the no-op callback with the shared bridge eligibility delivery; never add a second direct post in `setThemeMode`.

### `apps/playground/src/demo-hooks.ts`, `apps/playground/src/main-preferences.ts`, and `apps/playground/src/shell-host.ts` (host wiring/controller, event-driven)

**Analog:** a single registered ThemeService bundle in `createDemoHooks` ([`demo-hooks.ts:115-154`](../../../apps/playground/src/demo-hooks.ts#L115-L154)).

```ts
const themeBundle = createThemeService({ onBroadcast: () => {} });
// register themeBundle.handler with the ShellAdapter services and retain the bundle
```

Make the service callback call the bridge helper exactly once. Have preferences call the host/service update route only. The current `relay.publishTheme` plus raw iframe loop ([`main-preferences.ts:72-78`](../../../apps/playground/src/main-preferences.ts#L72-L78)) is an anti-pattern: it duplicates protocol deliveries and bypasses eligibility. Delete identity bootstrap/poll/request-tap sends rather than adapting them: [`shell-host.ts:225-242`](../../../apps/playground/src/shell-host.ts#L225-L242) and [`shell-host.ts:391-428`](../../../apps/playground/src/shell-host.ts#L391-L428) show the duplicate-producing paths.

## Test Patterns

### Service and runtime fixtures

Extend `packages/services/src/identity-service.test.ts`, `packages/services/src/theme-service.test.ts`, and `packages/runtime/src/dispatch.test.ts` using their existing captured `send` / adapter message arrays. Assert the whole sequence, not merely the final message: supported failure/denial cases have exactly one `.result`; unknown actions produce none; no forbidden `*.error` type is present. Keep signer/provider failure asynchronous assertions aligned with the current `Promise.resolve(...).catch(...)` service implementation.

### Shell bridge eligibility fixture

Use [`packages/shell/src/shell-bridge.test.ts:103-235`](../../../packages/shell/src/shell-bridge.test.ts#L103-L235) as the fixture style: `originRegistry.clear()` in hooks, fake `Window` objects with `postMessage: vi.fn()`, and minimal `ShellAdapter` hooks. Combine it with its source-bound ready registration examples beginning at [443](../../../packages/shell/src/shell-bridge.test.ts#L443): test pre-ready, no-domain, granted, and revoked/replaced-session frames. Assert normal identity, sign-out identity, and theme pushes each arrive once only at eligible recipients.

### Binding and browser tests

Use the parent-message harness in [`packages/shell/src/napplet-namespace.test.ts:38-118`](../../../packages/shell/src/napplet-namespace.test.ts#L38-L118) to prove forged child events are ignored and exposed identity/theme API ownership remains read-only under the chosen reassignment policy. For host proof, extend `packages/paja/src/browser-host.test.ts` static wiring checks and the existing Playwright fixtures:

- [`tests/e2e/paja-single-window.spec.ts:174-216`](../../../tests/e2e/paja-single-window.spec.ts#L174-L216) for one Paja theme control transition and later `theme.get` state.
- [`tests/e2e/nap-identity.spec.ts`](../../../tests/e2e/nap-identity.spec.ts), [`tests/e2e/nap-theme.spec.ts`](../../../tests/e2e/nap-theme.spec.ts), and [`tests/e2e/theme-broadcast.spec.ts`](../../../tests/e2e/theme-broadcast.spec.ts) for playground wire delivery/cardinality.

Remove the old synthetic public-key-error visibility fixture at [`paja-single-window.spec.ts:270-279`](../../../tests/e2e/paja-single-window.spec.ts#L270-L279)); it asserts the envelope class Phase 103 forbids.

## Shared Patterns

### Canonical known-domain results before generic denial

**Sources:** `packages/runtime/src/runtime.ts:270-302,324-341`; `packages/runtime/src/identity-handler.ts:21-53`; `packages/runtime/src/domain-handlers.ts:162-176`.

Create one narrow typed factory that is called by both ingress gates before generic type derivation. It handles only the sanctioned identity reads and `theme.get`; unknown actions are silent. This is essential because ACL/firewall run before service/domain dispatch.

### Authenticated and eligible recipient delivery

**Sources:** `packages/shell/src/shell-ready.ts:34-104`; `packages/shell/src/shell-bridge.ts:220-251`.

Pushes are shell-originated and only target live source-bound sessions whose frozen `shell.init` environment grants the domain. `originRegistry` alone is not session eligibility.

### State owner, then one broadcast

**Source:** `packages/services/src/theme-service.ts:182-193`.

All hosts mutate theme through `ThemeService.publishTheme`; only its callback publishes. This guarantees stored state is assigned before delivery and avoids Paja/playground cache drift.

### Parent-only readonly browser surface

**Source:** `packages/shell/src/napplet-namespace.ts:661-705,1427-1462`.

Expose request methods and subscriptions via the shared prelude. Filter change pushes by `event.source === parent`; keep replacement behavior at the guarded namespace construction seam, not per-domain raw assignments.

## No Analog Found

None. Phase 103 changes existing domain, bridge, host, and fixture seams; it does not require a new architectural component or dependency.

## Metadata

**Analog search scope:** `packages/{services,runtime,shell,paja}/src`, `apps/playground/src`, `tests/{unit,e2e}`  
**Files scanned:** 20 focused source/test files  
**Pattern extraction date:** 2026-07-23
