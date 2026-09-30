# Tutorial: Minimal Host Shell

This tutorial shows the smallest shape of a browser host that embeds one sandboxed napplet through Kehto.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
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
import { createThemeService } from '@kehto/services';

bridge.runtime.registerService('theme', createThemeService({
  getTheme: () => ({ colors: {}, title: 'Default' }),
}));
```

Register optional domains only when their real host backends are available. In
particular, a backendless `createNotifyService()` fails closed and must not be
used to advertise notification delivery.

## 4. Load one sandboxed napplet

First resolve the manifest with `@kehto/nip/5d`: verify its signature, each blob
hash and the aggregate. Derive `identity`, `verifiedHtml`, and `requiredDomains`
from that verified result. Reject missing required domains before creating the
iframe. Gateway output is an untrusted accelerator, never identity authority.

```ts
import { originRegistry, prepareNappletSrcdoc, resolveShellEnvironment } from '@kehto/shell';

// These values come from completed artifact verification, not host assertions.
const environment = resolveShellEnvironment(adapter, identity);
if (requiredDomains.some((domain) => !environment.capabilities.domains.includes(domain))) {
  throw new Error('Napplet requires unavailable domains');
}
const srcdoc = prepareNappletSrcdoc(verifiedHtml, {
  domains: environment.capabilities.domains,
  csp: { directives: { 'media-src': ['blob:'] } },
});
const iframe = document.createElement('iframe');
iframe.sandbox.value = 'allow-scripts';
const windowId = crypto.randomUUID();
document.body.append(iframe);
if (!iframe.contentWindow) throw new Error('Iframe window unavailable');
originRegistry.register(iframe.contentWindow, windowId, identity);
originRegistry.setEnvironment(iframe.contentWindow, environment);
iframe.srcdoc = srcdoc;
```

The shell places validated CSP first in `head`, followed by the mandatory
namespace bootstrap. `shell.ready` establishes the runtime session. Keep the
original verified bytes for identity and caching; the prepared document is a
rendered copy. Follow the same registration procedure for replacement frames.
See [CSP enforcement](../policies/NIP-5D-CONFORMANCE.md#shell-csp-enforcement)
for host overrides and constraints.

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
