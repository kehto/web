# Tutorial: Minimal Host Shell

This tutorial shows the smallest shape of a browser host that embeds one sandboxed napplet through Kehto.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. Use this tutorial as current implementation guidance; NAP contracts,
> capability names, and helper APIs may change.

## 1. Install the runtime packages

```bash
pnpm add @kehto/runtime @kehto/shell @kehto/services @napplet/core @napplet/nap nostr-tools
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
import { createNotifyService, createThemeService } from '@kehto/services';

bridge.runtime.registerService('notify', createNotifyService());
bridge.runtime.registerService('theme', createThemeService({
  getTheme: () => ({ colors: {}, title: 'Default' }),
}));
```

Use real host callbacks as you move beyond the minimal shell.

## 4. Load one sandboxed napplet

Use the same security posture as the playground: opaque-origin iframe, scripts only, no same-origin.

```ts
const iframe = document.createElement('iframe');
iframe.sandbox.add('allow-scripts');
iframe.src = '/napplet-gateway/example-dtag/example-hash/index.html';
document.body.append(iframe);
```

Before marking the napplet usable, register the session identity from the gateway metadata and manifest. In the playground this is handled by the shell-host gateway path; host apps should keep the same ordering:

1. Fetch manifest metadata.
2. Resolve `(dTag, aggregateHash)`.
3. Register session identity.
4. Navigate the iframe to the gateway artifact.

For repeated loads, add the optional NIP-5D artifact cache during the resolve
step. The cache reuses verified bytes only; it does not replace manifest,
aggregate, or blob-hash verification. See
[Implement a napplet artifact cache](../how-tos/implement-napplet-artifact-cache.md).

## 5. Tear down cleanly

```ts
window.removeEventListener('message', bridge.handleMessage);
bridge.destroy();
```

Destroying the bridge clears runtime subscriptions, buffers, and registries. Host-owned relay pools, timers, and native bridges should also be torn down in the same lifecycle.
