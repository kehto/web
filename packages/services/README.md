# @kehto/services

`createLinkService` uses `ServiceRuntimeContext.authorizeOperation` when attached
to a runtime with approval adapters. It requires both interface and exact URL
scopes, preserves request IDs in canonical results, rejects forbidden local/code
schemes, and drops retired-source results. The temporary host-only opener path
warns once per service instance (`FW-LINK-LEGACY-001`). See
[scoped approvals](../../docs/firewall-approvals.md) and
[compatibility](/compatibility) for migration details.

Reference service handlers for the napplet protocol — identity, relay pool,
cache, keys, media, notify, theme, link, common, lists, serial, BLE, WebRTC,
and DM.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. NAP contracts and service envelopes are not final; treat these
> handlers as reference implementations for the current draft.

## Install

```bash
pnpm add @kehto/services
```

## Published Napplet Compatibility

`@kehto/services` publishes against `@napplet/core` and `@napplet/nap`
`>=0.32.0 <0.33.0`. The exact installed contracts are core 0.32.0 / nap 0.32.0
from NAP-INTENT authority `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`,
napplet/web#199 source `3037200c932488f14f7f369b8583c39c9c16510a` / merge
`b3f0007867eac109fa4917fac9c285d3b7cc6155`, and Version Packages #198 release
source `dc1d24153c759152b6ba31a6ec9bea967798f2df`.

## Overview

`@kehto/services` ships the reference implementations of the `ServiceHandler`
contract defined by `@kehto/runtime`. Each factory returns an object that the
runtime routes NIP-5D envelopes to by the exact `message.type` domain (for
example, `notify.create` goes to the handler registered under `notify`).

Host apps wire services into the runtime via `runtime.registerService(name, handler)`. The services are browser-agnostic — they have no DOM dependency. Browser-specific behaviors (audio element pool, OS notifications) are delivered through host-supplied callbacks.

Services are selected only by the exact `message.type` domain. INC topics are
opaque, queryless identities matched only by exact equality, so their text must
not select a service handler. The runtime attaches the sender to delivered INC
events from the authenticated endpoint; services do not create INC events.

Current draft posture:

- The v1.1 signer service is deleted outright. Its responsibilities split into two: read-only identity lookups go through `createIdentityService` (`getPublicKey`, `getRelays`, `getProfile`, `getFollows`, `getList`, `getZaps`, `getMutes`, `getBlocked`, `getBadges`); signing happens inside the shell as part of `relay.publish` / `relay.publishEncrypted` and is never exposed to napplets.
- `createKeysService` and `createMediaService` ship real reference backends as of v1.4 (see the dedicated sections below). `createKeysService` attaches a document-level `keydown` listener by default and delivers `keys.action` push envelopes to registered napplets; `createMediaService` mirrors session metadata and playback state to `navigator.mediaSession` and emits `media.command` push envelopes on OS transport events. Both accept a host-bridge option (`HostKeysBridge` / `HostMediaBridge`) so Electron / Tauri / native shells can swap in OS-level backends without re-implementing the wire-protocol bookkeeping.
- `createNotifyService` handles direct `notify.*` envelopes. It is not an INC
  topic handler. A permission-enabled runtime approves `notify.send` and
  channel/badge effects before the host callback runs. Dismiss remains
  owner-only cleanup. `createNotificationService` retains the older
  `notify.create/list/read` registry as a deprecated compatibility path.
- `createOutboxService` supports `outbox.getEvent` from draft NAP-OUTBOX. Single-event lookups run through shell-owned relay routing and only return events whose ID matches the request. Hosts can provide `getReadRouter` to scope all event-returning reads (`getEvent`, query, and subscription) to the authenticated source window, plus `getQueryRouter` when one-shot queries need an additional decorator. The draft wire contract keeps `outbox.query` one-shot and `outbox.subscribe` streaming; Kehto's concrete `createRelayPoolOutboxRouter` additionally exposes host-side `queryStream()` so verified query events can arrive before asynchronous NIP-65 discovery completes.
- `createResourceService` implements NAP-RESOURCE at draft PR #80 head `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` without choosing a runtime's resolver policy. Single requests carry `url`; bulk requests carry an ordered `urls` array, and results use canonical padded RFC 4648 base64 in `blob`. `resource.info.schemes` remains advisory. Runtime permission integration authorizes the exact resource URL and each resolver-reported HTTP(S) or WebSocket origin through `init.authorizeNetwork(destination, execute)`; the resolver remains responsible for scheme handling, redirects, and upstream byte classification. The service scopes cancellation to the requesting window, drops cancelled terminal envelopes, and preserves explicit `ResourceServiceError` codes.
- `createUploadService` supports `upload.info` from draft NAP-UPLOAD. Hosts may expose configured rails, return URL forms, maximum bytes, and MIME type policy without requiring napplets to start an upload.
- Upload teardown uses exact window ownership, including IDs containing colons.
  Destroying a window invalidates replies before backend cancellation and suppresses
  late progress, results, and errors even if cancellation throws or settles later.
  Reusing a window/upload ID starts a new callback lifetime. Service removal
  invalidates all windows and cancels their tracked uploads. This host lifecycle
  policy follows [NAP-UPLOAD draft #33 at
  `f5cc981e527e2cc1572793a7a6e5082e5271ac49`](https://github.com/napplet/naps/blob/f5cc981e527e2cc1572793a7a6e5082e5271ac49/naps/NAP-UPLOAD.md)
  without changing responses to live requesters.
- `createConfigService` implements draft NAP-CONFIG's shell-writer boundary: recursive bounded-subset schema validation, per-window schema/subscription state, deterministic defaults, invalid/orphan removal, version rollback rejection, scoped host persistence hooks, and settings-UI commits. Reads before schema registration fail closed with `no-schema`.
- `createDmService` keeps NAP-DM request correlation, per-window subscriptions, and packaged message shapes in runtime-owned code. Adapters cover concrete transports: verified NIP-17 gift wraps and relay history via `nostr-tools`, structural NDR runtimes with relay hooks, and Cordn/ContextVM coordinator clients.
- `createFsService` keeps NAP-FS result correlation and per-window watch identity in runtime-owned code. An injected `FsBackend` owns real persistence, virtual-path policy, picker mediation, byte validation, revisions, mutations, and watch observation.

## NAP-INTENT manifest resolver

Kehto follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2`. The shell binding normalizes URI calls into a
queryless convention and separate opaque payload before service dispatch.

- `manifestToIntentCatalogEntry()` converts verified `{ catalogId, title?, archetypes: [{ slug, convention, params }] }` facts into exact contracts.
- `createCatalogIntentResolver()` applies authorized explicit selection, an explicit chooser, or default → recommendation → compatible choice. Payload contents never select a handler.
- `createIntentService()` requires `resolveSender(windowId)`, derives the sender from the authenticated endpoint, validates requests, and returns one canonical result.

`ok: true` means the controller retained responsibility for delivery. It contains
`archetype`, `action`, `convention`, and the opaque handler ID. It does not expose
a window ID or promise target completion. The controller waits for the current
target's authenticated readiness and sends one `intent.deliver`; host observers
receive later completion or failure without a second source result. Source
teardown does not cancel accepted work. `intent.onDelivery` buffers arrivals;
INC is not required.

Paja and playground use verified persistent catalogs separately from live frames.
The installed `@napplet/nap@0.32.0` types predate this contract; the bounded local
canonical types and their removal condition are documented below.

## Quick Start

```ts
import {
  createIdentityService,
  createListsService,
  createNotifyService,
  createBleService,
  createDmService,
  createNip17DmAdapter,
  createSerialService,
  createWebrtcService,
} from '@kehto/services';

// Identity service — read-only lookups backed by a signer adapter.
runtime.registerService(
  'identity',
  createIdentityService({
    getSigner: () => signer,
    getProfile: (pk) => nostrClient.fetchProfile(pk),
    getFollows: (pk) => contactListCache.getFollows(pk),
  }),
);

// Notification service — direct NIP-5D notify.* envelopes.
runtime.registerService(
  'notify',
  createNotifyService({
    present: ({ notificationId, message, emit }) => notificationCenter.show({
      notificationId,
      title: message.title,
      body: message.body,
      onClick: () => emit({ type: 'notify.clicked', notificationId }),
    }),
    dismiss: (_windowId, notificationId) => notificationCenter.dismiss(notificationId),
    requestPermission: (_windowId, channel) => notificationPolicy.request(channel),
  }),
);

// Lists service — shell-owned NIP-51 metadata and mutations.
runtime.registerService(
  'lists',
  createListsService({
    supported: () => [{ kind: 10003, type: 'bookmarks', addressable: false }],
    add: (_list, items) => ({ ok: true, added: items.length }),
    remove: (_list, items) => ({ ok: true, removed: items.length }),
  }),
);

// Serial service — runtime-owned serial sessions and host-owned device access.
runtime.registerService(
  'dm',
  createDmService({
    adapter: createNip17DmAdapter({
      ownerSecretKey: shellOwnedSecretKey,
      relayPool: shellRelayPool,
      relays: ['wss://relay.example'],
    }),
  }),
);

runtime.registerService(
  'serial',
  createSerialService({
    open: () => ({ session: { id: 'host-session-1', state: 'open' } }),
    write: (_sessionId, _data) => {},
    close: (_sessionId) => {},
  }),
);

// BLE service — runtime-owned BLE/GATT sessions and host-owned device access.
runtime.registerService(
  'ble',
  createBleService({
    open: () => ({
      session: {
        id: 'host-ble-1',
        state: 'open',
        device: { id: 'host-device-1', name: 'Host BLE' },
      },
    }),
    services: () => [],
    read: () => [87],
    write: (_sessionId, _target, _data) => {},
    subscribe: (sessionId, target, ctx) => {
      ctx.emit({ type: 'notification', sessionId, target, data: [87] });
    },
    unsubscribe: (_sessionId, _target) => {},
    close: (_sessionId) => {},
  }),
);

// WebRTC service — runtime-owned sessions and host-owned signaling/transport.
runtime.registerService(
  'webrtc',
  createWebrtcService({
    open: (request, ctx) => {
      const id = 'host-webrtc-1';
      ctx.emit({ type: 'state', sessionId: id, state: 'open' });
      return {
        session: {
          id,
          scope: request.scope,
          channel: request.channel ?? 'default',
          protocol: request.protocol,
          state: 'open',
        },
      };
    },
    send: (sessionId, payload, ctx) => {
      ctx.emit({ type: 'message', sessionId, from: 'host', payload });
    },
    close: (_sessionId) => {},
  }),
);
```

When a service is attached to a runtime with Firewall approvals, browser-backed
`open` hooks must call `ctx.authorizeDevice(hostPrivateScope, connect)` after a
chooser returns and before opening the selected port or GATT connection. The
scope stays host-private; later serial writes and BLE GATT operations are bound
to the source-owned session and require their own operation approval. Revocation
closes active device sessions and suppresses late events.

## Outbox Streaming Queries

NAP-OUTBOX is still an open upstream draft ([`napplet/naps` PR #32](https://github.com/napplet/naps/pull/32)). Its wire `outbox.query.result` remains one aggregate response. Hosts using Kehto's concrete router can also consume the same bounded read incrementally without changing the napplet wire protocol:

```ts
const stream = router.queryStream(
  [{ authors: [author], kinds: [1] }],
  { timeoutMs: 3000 },
  { event: (result) => render(result.event) },
);

const aggregate = await stream.result;
```

When relay-list loading is asynchronous, the router opens validated relay hints or fallback relays immediately, attaches discovered author write relays to the same deduplicating collector, and applies one deadline to discovery and collection. `query()` remains the compatibility aggregate over this stream. `options.limit` applies to that aggregate; the stream receives every verified unique arrival before completion. `subscribe()` uses the same immediate seed fanout before adding discovered relays.

## Keys Service

Reference keyboard / chord backend for the `keys.*` NIP-5D NAP. By default attaches a single `document`-level `keydown` listener that matches incoming events against registered chord subscriptions and delivers a `keys.action` push envelope back to the owning napplet. Implement the [`HostKeysBridge`](#hostkeysbridge-interface) interface to swap in OS-level backends (Electron `globalShortcut`, Tauri `GlobalShortcut`).

### Factory

```ts
import { createKeysService } from '@kehto/services';

export function createKeysService(options?: KeysServiceOptions): ServiceHandler & { destroy(): void };
```

`destroy()` detaches the document listener (or the bridge's unsubscribe handles) and clears all subscription registries. Call on shell teardown.

### KeysServiceOptions

| Field | Type | Description |
|-------|------|-------------|
| `onForward` | `(event: { key, code, ctrlKey, altKey, shiftKey, metaKey }) => void` | Called on `keys.forward` envelopes and on document/host-bridge keydowns handled by the reference backend. DOM-shape payload (the service translates from the wire-format `{ ctrl, alt, shift, meta }` before invoking this callback). Forwarded keys do not dispatch `keys.action`; active napplets suppress bound keys locally from `keys.bindings` before forwarding. |
| `listenerTarget` | `EventTarget` | Defaults to `document`. Pass a fresh `new EventTarget()` in unit tests to isolate the listener. Ignored when `hostBridge` is provided. |
| `hostBridge` | `HostKeysBridge` | Pluggable OS-bridge. When provided, the service delegates `keys.registerAction` to `bridge.subscribe(chord, cb)` and the default document listener is NOT attached. |
| `reservedChords` | `ReadonlyArray<string>` | Optional set of shell-reserved chords (wire-format strings like `'Ctrl+Shift+K'`, `'Cmd+P'`). Reserved chords are not assigned as napplet action bindings. Document keydowns that match a reserved chord call `onForward` but do not dispatch `keys.action`. Precedence: **reserved > registered**. Normalized once at construction via the same parser used for `action.defaultKey`. See [Reserved Chords](#reserved-chords). |

### HostKeysBridge interface

Copy the contract verbatim for host-app implementers. OS-level bridges implement `subscribe` at minimum; the two optional fields enable global-hotkey registration (works even when the host window is unfocused).

```ts
export interface HostKeysBridge {
  /**
   * Subscribe a callback to a chord. Returns an unsubscribe handle.
   *
   * Implementations MUST:
   *   - invoke `callback` exactly once per matching chord event (implementations
   *     are responsible for any OS-autorepeat filtering)
   *   - invoke `callback` synchronously during the event delivery
   *   - remove only this subscription when its unsubscribe handle is called;
   *     other callbacks for the same chord must remain live
   *   - accept the string chord format documented by @napplet/nap/keys
   *     (e.g. `'Ctrl+Shift+K'`, `'Cmd+P'`)
   */
  subscribe(chord: string, callback: (event: KeyboardEvent | HostKeyEvent) => void): () => void;

  /**
   * Optional: register an OS-level global hotkey (works even when the host
   * window is not focused). Returns true on success, false if the chord
   * cannot be registered (e.g. already claimed by another app).
   *
   * Omitted by the browser reference implementation — browsers cannot
   * register OS-level global hotkeys without privileged APIs. Electron
   * (`globalShortcut`) and Tauri (`GlobalShortcut`) provide this.
   */
  registerGlobalHotkey?(chord: string): boolean;

  /**
   * Optional: subscribe to OS-level global hotkey events (regardless of
   * focus). Returns an unsubscribe handle.
   *
   * Omitted by the browser reference implementation. See
   * {@link HostKeysBridge.registerGlobalHotkey}.
   */
  onGlobalHotkey?(callback: (chord: string) => void): () => void;
}
```

### Usage

Default browser path — the reference document-level chord listener:

```ts
import { createKeysService } from '@kehto/services';

const keys = createKeysService({
  onForward: (event) => {
    // DOM-shape payload: { key, code, ctrlKey, altKey, shiftKey, metaKey }
    hotkeyDispatcher.dispatch(event);
  },
});

runtime.registerService('keys', keys);
// On shell teardown:
keys.destroy();
```

Custom bridge path — swap in Electron's `globalShortcut`:

```ts
import { createKeysService, type HostKeysBridge, type HostKeyEvent } from '@kehto/services';
import { globalShortcut } from 'electron';

const subscribers = new Map<string, Set<(event: HostKeyEvent) => void>>();
const electronBridge: HostKeysBridge = {
  subscribe(chord, cb) {
    let callbacks = subscribers.get(chord);
    if (!callbacks) {
      const group = new Set<(event: HostKeyEvent) => void>();
      const registered = globalShortcut.register(chord, () => {
        for (const callback of group) callback({
          key: '', code: '',
          ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
        });
      });
      if (!registered) throw new Error(`Cannot register ${chord}`);
      callbacks = group;
      subscribers.set(chord, callbacks);
    }
    callbacks.add(cb);
    return () => {
      if (!callbacks.delete(cb)) return;
      if (callbacks.size === 0) {
        globalShortcut.unregister(chord);
        subscribers.delete(chord);
      }
    };
  },
};

runtime.registerService('keys', createKeysService({ hostBridge: electronBridge }));
```

### When to plug a custom bridge

Plug a `HostKeysBridge` when the default document listener is insufficient: Electron or Tauri apps that need to register OS-level global hotkeys (chords delivered even when the host window is not focused), native shells that route chords through a platform-specific hotkey manager (macOS Carbon, Linux X11 grab, Windows RegisterHotKey), or test harnesses that inject synthetic events through a controlled `EventTarget`. The bridge owns subscription lifecycle; the service retains per-window bookkeeping (so `onWindowDestroyed` cleanup stays identical across paths).

A napplet drives this end to end via `@napplet/sdk` — `keys.registerAction` to claim a chord and `keys.onAction` to receive dispatches against the real backend. After a successful bound registration, the service pushes a complete `keys.bindings` list for that napplet/window, using entries shaped as `{ actionId, key }`. It pushes the complete list again after `keys.unregisterAction` removes a binding, including an empty list when no bindings remain. Injected shims use that list to suppress locally-bound keydowns before forwarding.

Action IDs are local to the trusted window passed by the runtime. Two windows may
each register `game.a`, including with the same suggested key, without replacing
one another's bindings. Unregistering or destroying one window removes only its
actions and bridge subscriptions. Binding lists and `keys.action` messages retain
the original app-local action ID; callers do not need to invent window-specific IDs.
Re-registering an action in the same window retains the existing rebind behavior:
a valid available chord replaces that window's binding, a reserved chord removes
its previous binding, and a malformed chord or failed bridge subscription leaves
the previous binding intact.

This ownership scope is an explicit Kehto policy for the scope left implicit by
[NAP-KEYS PR #9 at `cecb642`](https://github.com/napplet/naps/blob/cecb64257e0ac29926bb746832a477c553ab307c/naps/NAP-KEYS.md).
The draft describes duplicate-action errors but does not mandate service-global
IDs or forbid same-owner updates. Window-scoped ownership preserves its per-napplet
binding delivery and adds no wire fields. Chord conflicts retain the existing
behavior: matching registered actions receive their own `keys.action` push.

### Reserved Chords

Shell-reserved chords let a host application (window manager, launcher shell, tiling WM) claim specific chords for its own dispatch regardless of what napplets subscribe to. Declare the reserved set once at service construction via the `reservedChords` option on [`KeysServiceOptions`](#keysserviceoptions):

```ts
import { createKeysService } from '@kehto/services';

const keys = createKeysService({
  reservedChords: [
    'Ctrl+Alt+T',        // launcher
    'Super+Space',       // workspace switch
    'Ctrl+Shift+Y',      // shell palette
  ],
  onForward: (event) => {
    // The shell's WM dispatcher — fires for reserved chords regardless of
    // which napplet (if any) tried to register them.
    wmLauncher.dispatch(event);
  },
});

runtime.registerService('keys', keys);
```

**Precedence contract: reserved > binding.** When a napplet registers an action whose `defaultKey` matches `reservedChords`, the service acknowledges the action with `keys.registerAction.result` but leaves `binding` undefined and does not add the chord to `keys.bindings`. That prevents the active napplet from suppressing a shell-owned chord locally.

- If a document keydown matches a reserved chord: `onForward` fires exactly once and no `keys.action` envelope is dispatched.
- If a document keydown matches a non-reserved registered binding: `onForward` fires and every napplet whose registered action matches receives a `keys.action` envelope via its captured `send` handle.
- If a napplet sends `keys.forward`: `onForward` fires and the service does not dispatch `keys.action`. Active napplets are expected to suppress bound keys locally from `keys.bindings` before forwarding.

Reserved chords are normalized at service construction via the same parser used for `action.defaultKey`, so `'Ctrl+Shift+K'`, `'Control+shift+k'`, and `'ctrl+Shift+K'` all match the same chord. Modifier aliases (`Cmd` / `Command` / `Win` / `Super` → meta; `Control` → ctrl; `Option` → alt) are recognized case-insensitively.

**WM-launcher integration example:**

```ts
// Shell-side: declare every WM-absolute chord at boot.
const keys = createKeysService({
  reservedChords: Object.keys(wmChordMap),    // e.g. ['Super+1', 'Super+2', ..., 'Ctrl+Alt+T']
  onForward: (event) => {
    const chordStr = chordStringFromEvent(event);
    const action = wmChordMap[chordStr];
    if (action) action.execute();
  },
});
runtime.registerService('keys', keys);

// Napplet-side (hotkey-chord napplet, for example): free to request
// `Ctrl+Shift+K` via keys.registerAction. If Ctrl+Shift+K is NOT in the shell's
// reservedChords, the napplet receives a binding and can handle it locally while
// active. If the shell reserves that chord, the registration result is unbound
// and no suppress-list entry is pushed.
```

**Dynamic reservation is out of scope for v1.6.** If a downstream shell needs runtime updates to the reserved set (e.g. "reservation depends on which workspace is active"), open an issue referencing `HostKeysBridge.reserveAbsolute(chords)` — the deferred extension shape. Until then, `reservedChords` is static at service construction.

**OS-level global hotkeys remain a separate concern.** `reservedChords` operates at the service layer. For OS-level reservation (chord fires even when the host window is unfocused), implement [`HostKeysBridge.registerGlobalHotkey`](#hostkeysbridge-interface) in your bridge — reserved chords and global hotkeys compose orthogonally.

## Media Service

Reference media backend for the `media.*` NIP-5D NAP. By default mirrors session metadata + playback state to `navigator.mediaSession` via the DOM `MediaSession` API and installs `setActionHandler` callbacks that emit `media.command` push envelopes on OS transport events (play / pause / next / previous / seek). Implement the [`HostMediaBridge`](#hostmediabridge-interface) interface to swap in native backends (Electron bridge, MPRIS on Linux, MediaRemote on macOS).

### Factory

```ts
import { createMediaService } from '@kehto/services';

export function createMediaService(options?: MediaServiceOptions): ServiceHandler & { destroy(): void };
```

`destroy()` tears down the active bridge (removes `setActionHandler` listeners, removes the silent-audio prime element in the browser reference implementation) and clears the session registry.

### MediaServiceOptions

| Field | Type | Description |
|-------|------|-------------|
| `onSessionCreate` | `(windowId, sessionId, metadata?) => void` | Called when a napplet creates a session. |
| `onState` | `(windowId, sessionId, state) => void` | Called on `media.state` updates — high-frequency; keep handler work minimal. |
| `onSessionDestroy` | `(windowId, sessionId) => void` | Called when a napplet destroys a session. |
| `onSessionUpdate` | `(windowId, sessionId, metadata) => void` | Called when a napplet updates session metadata. |
| `onCapabilities` | `(windowId, sessionId, actions) => void` | Called when a napplet declares capabilities for a session. |
| `mediaSessionTarget` | `MediaSessionTarget` | Overrides `navigator.mediaSession` (used by the default bridge only). Pass a `MockMediaSession` in unit tests. Ignored when `hostBridge` is provided. |
| `documentTarget` | `Document \| null` | Overrides `document` (used by the default bridge only). Set to `null` to disable the silent-audio prime in unit tests. Ignored when `hostBridge` is provided. |
| `hostBridge` | `HostMediaBridge` | Pluggable backend. When provided, the service delegates setMetadata / setPlaybackState / onAction to the bridge and skips `navigator.mediaSession` entirely. |

### HostMediaBridge interface

Copy the contract verbatim for host-app implementers. Native bridges implement `setMetadata` + `setPlaybackState` + `onAction` at minimum; the two optional fields cover active-session switching and per-session teardown.

```ts
export interface HostMediaBridge {
  /**
   * Set the metadata displayed on the OS transport surface for a session.
   * Called on session.create (with initial metadata) and on session.update
   * (with merged metadata) whenever the session is the active session.
   * Implementations MUST be idempotent.
   */
  setMetadata(sessionId: string, metadata: MediaMetadata): void;

  /**
   * Set the playback state for a session. Called on media.state reports
   * whenever the session is the active session. State strings match
   * nap-media MediaState.status exactly. Implementations MUST be idempotent.
   */
  setPlaybackState(sessionId: string, state: 'playing' | 'paused' | 'stopped' | 'buffering'): void;

  /**
   * Subscribe to OS-level action events (user clicks play/pause/seek/next/prev
   * on the transport surface). Returns an unsubscribe handle.
   *
   * The callback receives `(sessionId, action, value?)`. `sessionId` is the
   * bridge's currently-active session (the browser impl tracks this internally
   * via setActionHandler-at-fire-time; native impls track via setActiveSession).
   * `value` is populated for `action === 'seek'` (seek target in seconds) and
   * for `action === 'volume'` (0.0-1.0). The service dispatches the resulting
   * `media.command` envelope to the owning napplet of that session.
   */
  onAction(callback: (sessionId: string, action: MediaAction, value?: number) => void): () => void;

  /**
   * Optional: notify the bridge that the active session has changed. The
   * browser reference impl uses this to switch which session's metadata/state
   * is mirrored to the singleton navigator.mediaSession and to install (or
   * clear) action handlers for the session's declared capabilities.
   *
   * The optional `actions` parameter carries the session's declared capability
   * set so the bridge can narrow which OS transport buttons are active. When
   * omitted, the bridge applies its default set. Native OS bridges that track
   * active-session state internally may omit this field entirely.
   */
  setActiveSession?(sessionId: string | null, actions?: readonly MediaAction[]): void;

  /**
   * Optional: tear down per-session resources. The browser reference impl
   * uses this to remove the silent-audio prime element when the last session
   * is destroyed. Bridges that need no per-session teardown may omit this field.
   */
  destroySession?(sessionId: string): void;
}
```

### Usage

Default browser path — the reference `navigator.mediaSession` mirror:

```ts
import { createMediaService } from '@kehto/services';

const media = createMediaService({
  onSessionCreate: (windowId, sessionId, metadata) => {
    console.log(`[${windowId}] created session ${sessionId}`, metadata);
  },
  onState: (windowId, sessionId, state) => {
    nowPlaying.update(windowId, state);
  },
});

runtime.registerService('media', media);
// On shell teardown:
media.destroy();
```

Custom bridge path — swap in an Electron host bridge:

```ts
import { createMediaService, type HostMediaBridge, type MediaAction } from '@kehto/services';
import { mediaBridge } from './electron-media-bridge';

const electronBridge: HostMediaBridge = {
  setMetadata(sessionId, md) {
    mediaBridge.sendMetadata({ sessionId, md });
  },
  setPlaybackState(sessionId, state) {
    mediaBridge.sendPlaybackState({ sessionId, state });
  },
  onAction(cb) {
    const handler = (_: unknown, msg: { sessionId: string; action: MediaAction; value?: number }) =>
      cb(msg.sessionId, msg.action, msg.value);
    mediaBridge.onAction(handler);
    return () => mediaBridge.offAction(handler);
  },
};

runtime.registerService('media', createMediaService({ hostBridge: electronBridge }));
```

### When to plug a custom bridge

Plug a `HostMediaBridge` when `navigator.mediaSession` is insufficient: Electron apps that need to route transport events through the main process (lock-screen integration on Windows, Now Playing integration on macOS), Linux shells that speak MPRIS over D-Bus, native mobile wrappers that forward to AVPlayer / ExoPlayer, or test harnesses that record action events without touching the DOM. The bridge owns metadata/state mirroring and OS action routing; the service retains per-session bookkeeping (sessionRegistry + per-window send handles) so `media.command` dispatch semantics stay identical across paths.

A napplet drives this end to end via `@napplet/nap/media` — `mediaCreateSession({ owner: 'napplet', ... })`, `mediaReportState`, and `mediaOnCommand` against the real backend.

## Public API

Each factory returns a `ServiceHandler` registrable via `runtime.registerService()`. The bullets below note the current NIP-5D domain the handler owns and the ACL capability napplets need in order to reach it.

### Identity NAP
- `createIdentityService` — `identity.*` reads (`identity:read`). No signing surface; shell mediates signing internally.

`createIdentityService` uses `getSigner()` for `identity.getPublicKey` and `identity.getRelays`. Hosts may also pass optional read-only provider hooks for `getProfile`, `getFollows`, `getList`, `getZaps`, `getMutes`, `getBlocked`, and `getBadges`. These hooks receive the current signer pubkey (or `""` when no signer is connected) and return the payload portion of the corresponding `.result` envelope. Kehto does not query relays itself; the hooks are for hosts that already maintain profile, contact-list, list, zap, moderation, or badge data.

### Notify NAP
- `createNotifyService` — canonical direct `notify.*` envelopes per
  [NAP-NOTIFY PR #11 at `67877ef6`](https://github.com/napplet/naps/blob/67877ef6c31ec8acee3125c1d8b4c781010e37dc/naps/NAP-NOTIFY.md).
  Runtime approval scopes presentation, permission requests, badges, and
  channels to the exact operation/channel. Payloads are copied before approval;
  revoked or destroyed sources cannot render or receive late callbacks. Remote
  icon URLs are rejected until a host supplies an approved NAP-RESOURCE fetch.
  `notify.dismiss` silently ignores unknown or foreign IDs and stays available
  after revocation. Paja also checks the current verified artifact before
  caching a browser notification permission.
- `createNotificationService` — deprecated Kehto `notify.create/list/read`
  registry with a once-per-instance `FW-NOTIFICATION-LEGACY-001` diagnostic.
  No upstream NAP defines this wire; new consumers should use `notify.send`.

### Relay NAP
- `createRelayPoolService` — `relay.publish`, `relay.publishEncrypted`,
  `relay.subscribe` fan-out (`relay:read` / `relay:write`). Publish handlers
  receive only runtime-signed events and settle with canonical
  `{ ok, event, eventId }` or `{ ok: false, error }` result envelopes. Subscribe
  adapters may pass observed relay URLs as the callback's second argument so
  `RelayEventResult.sidecar.relayHints` records provenance rather than the
  larger requested relay set.
- `createCacheService` — offline event cache (`cache:read` / `cache:write`).
- `createCoordinatedRelay` — composite service that bundles relay-pool + cache
  with read-through behavior and the same canonical publish result.

### Keys NAP
- `createKeysService` — `keys.registerAction` / `keys.unregisterAction` / `keys.forward` + `keys.bindings` / `keys.action` push envelopes (`keys:forward`). Document-level chord listener by default; implement the `HostKeysBridge` interface to swap in Electron / Tauri / OS-level backends. See [Keys Service](#keys-service) for the full contract.

### Media NAP
- `createMediaService` — owner-aware `media.session.create` / `update` / `destroy` / `media.state` / `media.capabilities` + `media.command` push envelopes (`media:control`). Napplet-owned sessions mirror to `navigator.mediaSession` by default; shell-owned creates are rejected until a host playback/fetch bridge is supplied. Implement the `HostMediaBridge` interface to swap in native backends. See [Media Service](#media-service) for the full contract.

### BLE NAP
- `createBleService` — `ble.open`, `ble.services`, `ble.read`, `ble.write`, `ble.subscribe`, `ble.unsubscribe`, `ble.close` + host-pushed `ble.event` envelopes. Hook contexts include `ctx.emit(event)`, so host Bluetooth notification listeners can forward `notification`, `state`, and `closed` events to the requesting napplet without replacing the reference handler. Under runtime approvals, `ctx.authorizeDevice(...)` binds a host-private selected device before connection; each GATT operation is separately authorized and source-owned.

### WebRTC NAP
- `createWebrtcService` — `webrtc.open`, `webrtc.send`, `webrtc.close` + host-pushed `webrtc.event` envelopes. The reference handler owns only the NAP request/result bookkeeping; host bridges own signaling, SDP, ICE, peer connection lifecycle, and policy.

### DM NAP
- `createDmService` — `dm.status`, `dm.conversations`, `dm.messages`, `dm.send`, `dm.subscribe`, `dm.unsubscribe` + `dm.message` push envelopes (`dm:read` / `dm:write`). Runtime owns correlation, subscriptions, cleanup, and normalized message shape; adapters own protocol transport.
- `createNip17DmAdapter` — concrete NIP-17 gift-wrap adapter backed by `nostr-tools/nip17` and an injected relay pool. The owner secret key stays shell/runtime-owned.
- `createNdrDmAdapter` / `createNdrRelayTransport` — structural adapter for Nostr Double Ratchet runtimes plus a relay transport bridge for app-owned `nostrSubscribe` / `nostrFetch` / `nostrPublish` hooks.
- `createCordnDmAdapter` / `createCordnRelayCoordinatorClient` — structural adapter for Cordn/ContextVM clients plus a relay-backed coordinator bridge for `PostGroupMessage`, `FetchGroupMessages`, and `SubscribeGroupMessages`.

### FS NAP
- `createFsService` — all `fs.*` request/result envelopes plus scoped `fs.changed` pushes. It guarantees same-id results, error/success-field exclusivity, cross-window watch isolation, and window-destroy cleanup.
- `FsBackend` — host contract for runtime-owned virtual paths, real picker/storage handles, bounded range I/O, atomic writes, directory mutation, and advisory watches. `FsServiceError` maps failures to the closed NAP-FS error set.

### Theme NAP
- `createThemeService` — `theme.get` plus automatic `theme.changed` delivery
  (`theme:read`). Returns a `ThemeService` with `publishTheme()` and
  `getCurrentTheme()` for host-side updates.

### Intent NAP
- `createIntentService` — exact `intent.invoke`, `intent.available`, and
  `intent.handlers` request/result handling plus recipient-gated
  `intent.changed`.
- `manifestToIntentCatalogEntry` — verified manifest archetype contracts to
  catalog entries.
- `createCatalogIntentResolver` — exact convention selection and retained
  target-controller seam.

### Identity and theme wire guarantees

Against NAP-IDENTITY/NAP-THEME at `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`,
`createIdentityService` is readonly: `identity.getPublicKey` always sends one
matching `.result` with `pubkey: ""` when a signer is absent or fails, and the
other supported reads retain their safe primary result fields. Unknown identity
actions are silent; identity changed values are host pushes, not request
retries or INC/intent traffic.

`createThemeService` accepts `theme.get` only and owns the current complete
three-color theme. `publishTheme()` normalizes and stores that state before it
invokes its one bridge callback, so an immediate `theme.get` observes the same
value as the automatic push. There is no theme subscribe/unsubscribe protocol.
For denied or unavailable runtime reads, Kehto uses the fixed non-sensitive
complete normal result without `error`: this explicit policy reconciles the
draft error-only example without a mixed theme/error extension.

### Types
`AudioSource`, `AudioServiceOptions`, `Notification`, `NotificationServiceOptions`, `IdentityServiceOptions`, `RelayPoolServiceOptions`, `CacheServiceOptions`, `CoordinatedRelayOptions`, `KeysServiceOptions`, `MediaServiceOptions`, `NotifyServiceOptions`, `NotifyPresentation`, `NotifyInteractionMessage`, `ThemeServiceOptions`, `ThemeService`, `IntentRequest`, `IntentResult`, `IntentCandidate`, `IntentAvailability`, `IntentResolver`, `IntentTargetController`, `IntentDispatchParams`, `IntentTargetDispatch`, `BleServiceOptions`, `BleServiceContext`, `WebrtcServiceOptions`, `WebrtcServiceContext`, `DmServiceOptions`, `DmAdapter`, `DmRelayPool`, `Nip17DmAdapterOptions`, `NdrDmAdapterOptions`, `CordnDmAdapterOptions`.

## API Reference

Full package docs: [`docs/packages/services.md`](../../docs/packages/services.md).
Generated API module: `docs/api/modules/_kehto_services.html` (run `pnpm docs:api`).

## License

MIT

## NIP-5D event compatibility

Current manifests use a direct artifact `x` hash, plain-text `content`, role-matched
`z`/`i` intent declarations, and required `R` / optional `O` domains. Kehto also
accepts legacy aggregate events through an isolated compatibility adapter.
Existing `aggregateHash` host/cache/ACL fields carry the verified artifact hash
for current events; legacy identities keep their original aggregate. Both paths
verify signatures and bytes before runtime injection and `srcdoc` execution.
For the schema and removal boundary, see [event migration](https://kehto.github.io/web/docs/migrations/NIP-5D-EVENT-SCHEMA.html).

## Canonical intent contracts

`@kehto/services` temporarily owns the canonical NAP-INTENT PR #106 contracts because `@napplet/nap@0.32.0` has not yet published them. Candidates use opaque `id` plus exact `contracts`; successful results contain only `ok`, `archetype`, `action`, `convention`, and `handler` (never `handled`, `windowId`, or `newWindow`). `createIntentService` requires `resolveSender(windowId)` and rejects caller-supplied sender fields. `IntentResolverContext.sourceWindowId` and `IntentDispatchParams.sourceWindowId` are host-only correlation fields: they must never appear in `intent.deliver` or `intent.invoke.result`. A target controller accepts retained work as `{ completion }`; completion failure is host observation, not a second canonical result. Remove these local types only when an upstream package exports the checked PR #106 surface and Kehto's service/runtime regression suite proves direct replacement.

## GAMEPAD integration

This non-normative guidance defers to [NAP-GAMEPAD at `napplet/naps@19de5ce1`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-GAMEPAD.md). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja and the playground register one host reader and deny native gamepad/HID/USB paths before frame execution. A runtime-approved `gamepad.subscribe` must authorize the host-private `gamepad:input` resource before the reader starts; the NAP has no device handle for a narrower scope. Denial emits `reason: "blocked"`. Only the visible host's input owner receives live controls; focus loss supplies neutral controls and timestamp zero. Unsubscribe, revocation, window destruction, and service removal release polling. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).


### Resource request lifecycle

Resource requests are tracked before asynchronous metadata resolution. Cancelling
byte requests before that resolution prevents a fetch; cancelling an active fetch
aborts its signal and suppresses its terminal response. Window destruction and
service detachment cancel outstanding work, including advisory info responses.
The service captures each exact `url` or ordered `urls` list before awaiting host
work. A duplicate in-flight ID cannot replace the original cancellation handle,
and old source cleanup cannot remove a replacement source's request. Successful
results carry canonical padded RFC 4648 base64 in `blob`; shell consumers decode
only that canonical form into a `Blob`. `resource.cancel` stays silent, while a
live permission revocation emits exactly one `blocked-by-policy` terminal and
suppresses stale completions.

These lifecycle rules were checked against NAP-RESOURCE PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. The NAP package declarations are
behind that draft, so Kehto keeps its local envelope types only until packaged
exports catch up.


### Scoped resource authorization

When attached to a runtime configured with `permissions`, the resource service
checks each original URL against a resource grant and, for HTTP(S) or WebSocket destinations, a separate
origin grant. Interface permission remains required. Bulk requests authorize each
item independently. The authorization covers fetching and reading the response
body, so revocation can abort active work and discard late bytes. Request
cancellation also dismisses a pending approval without granting a late answer.

Resolvers must call `init.authorizeNetwork(destination, execute)` before every
actual HTTP(S) or WebSocket contact. That callback runs under a distinct origin requirement,
including each proxy-reported redirect hop, and its signal covers connection and
body reading. Paja's local proxy adds DNS-time address screening and pinned
connections; see [Paja resource proxy policy](../../docs/policies/RESOURCE-PROXY.md).

This host-side boundary does not isolate unrestricted iframe subresource or direct
network access. Phase 114 must close frame admission/CSP isolation before any
end-to-end resource-security claim is made.

Standalone or unmigrated hosts retain resolver-owned policy with diagnostic
`FW-RESOURCE-LEGACY-001`, once per service instance on actual fetch use. Configure
`RuntimeAdapter.permissions` and trusted session `permissionPrincipal` to use
shared grants. No old origin list is imported into Firewall permission grants.

### Resource request replay policy

Kehto retains the latest 1,024 completed resource request IDs per source window.
Reusing a retained ID, including with a different resource operation or malformed
payload, causes no additional resolver call or terminal response. Active IDs are
tracked separately and cannot be evicted by completed requests. Cancellation
always reaches active work; cancelled IDs enter the replay ledger when their
work settles. Source destruction and service detachment clear the corresponding
history. This bounded Kehto policy supplements NAP-RESOURCE's cancellation rules;
callers should generate fresh IDs because older completed entries are evicted.
