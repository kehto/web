# Tutorial: Minimal Host Shell

This tutorial shows the smallest shape of a browser host that embeds one sandboxed napplet through Kehto.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. Use this tutorial as current implementation guidance; NAP contracts,
> capability names, and helper APIs may change.

## 1. Install the runtime packages

```bash
pnpm add @kehto/runtime @kehto/shell @kehto/services @kehto/nip @napplet/core @napplet/nap nostr-tools
```

Use `@kehto/runtime` for the protocol engine, `@kehto/shell` for browser iframe/message integration, and `@kehto/services` for reference service handlers.

## 2. Build host adapters

The shell bridge needs host-owned hooks. A minimal host can begin with no-op or in-memory implementations, then replace them with real relay, signer, cache, and persistence backends.

```ts
import { createShellBridge, type ShellAdapter } from '@kehto/shell';

const adapter: ShellAdapter = {
  relayPool: {
    getRelayPool: () => null,
    trackSubscription: () => {},
    untrackSubscription: () => {},
    openScopedRelay: () => {},
    closeScopedRelay: () => {},
    publishToScopedRelay: () => false,
    selectRelayTier: () => [],
  },
  relayConfig: {
    addRelay: () => {},
    removeRelay: () => {},
    getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
    getNip66Suggestions: () => [],
  },
  windowManager: {
    createWindow: () => null,
  },
  auth: {
    getUserPubkey: () => null,
    getSigner: () => null,
  },
  config: {
    getNappUpdateBehavior: () => 'banner',
  },
  hotkey: {
    executeHotkeyFromForward: () => {},
  },
  workerRelay: {
    getWorkerRelay: () => null,
  },
  crypto: {
    verifyEvent: async () => false,
  },
  dm: {
    sendDm: async () => ({ success: false, error: 'not configured' }),
  },
};

const bridge = createShellBridge(adapter);
window.addEventListener('message', bridge.handleMessage);
```

## 3. Register reference services

The bridge exposes the underlying runtime. Register service handlers before loading napplet iframes.

```ts
import { createThemeService } from '@kehto/services';

bridge.runtime.registerService('theme', createThemeService({
  getTheme: () => ({ colors: {}, title: 'Default' }),
}));
```

Register optional domains only when their real host backends are available. In
particular, a backendless `createNotifyService()` fails closed and must not be
used to advertise notification delivery.

## 4. Load one sandboxed napplet

Use the same security posture as the playground: opaque-origin iframe, scripts only, no same-origin.

```ts
import { resolveNapplet } from '@kehto/nip/5d';
import { originRegistry, resolveShellEnvironment, injectNappletNamespacePrelude } from '@kehto/shell';

// event comes from relays; fetchBlob returns untrusted bytes by SHA-256.
const resolved = await resolveNapplet({ event, fetchBlob });
const identity = { dTag: resolved.dTag, aggregateHash: resolved.aggregateHash };
const environment = resolveShellEnvironment(adapter, identity);
const missing = resolved.manifest.requires.filter(
  (domain) => domain !== 'shell' && !environment.capabilities.domains.includes(domain),
);
if (missing.length) throw new Error(`Unavailable required domains: ${missing.join(', ')}`);
const iframe = document.createElement('iframe');
iframe.sandbox.add('allow-scripts');
document.body.append(iframe);
originRegistry.register(iframe.contentWindow!, 'example', identity);
originRegistry.setEnvironment(iframe.contentWindow!, environment);
iframe.srcdoc = injectNappletNamespacePrelude(resolved.indexHtml, environment.capabilities);
```

The resolver verifies both current artifact events and legacy aggregate events.
`aggregateHash` is the existing API name for the verified content identity. Host
namespace and recommended CSP injection happen after verification, outside signed
bytes. Optional manifest domains do not grant authority or prevent loading.
Gateways may provide bytes, but their metadata cannot establish identity.

For repeated loads, pass the optional cache to `resolveNapplet`; cached bytes
are reverified. See [artifact caching](../how-tos/implement-napplet-artifact-cache.md)
and [event migration](../migrations/NIP-5D-EVENT-SCHEMA.md).

## 5. Tear down cleanly

```ts
window.removeEventListener('message', bridge.handleMessage);
bridge.destroy();
```

Destroying the bridge clears runtime subscriptions, buffers, and registries. Host-owned relay pools, timers, and native bridges should also be torn down in the same lifecycle.
