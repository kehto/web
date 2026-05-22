# @kehto/services

Reference service handlers for the napplet protocol — audio, notifications, identity, relay pool, cache, keys, media, notify, theme.

## Install

```bash
pnpm add @kehto/services
```

## Overview

`@kehto/services` ships the reference implementations of the `ServiceHandler` contract defined by `@kehto/runtime`. Each factory returns an object that the runtime routes NIP-5D envelopes to based on the domain prefix of the incoming message type (e.g., `identity.*` goes to the handler registered under `identity`).

Host apps wire services into the runtime via `runtime.registerService(name, handler)`. The services are browser-agnostic — they have no DOM dependency. Browser-specific behaviors (audio element pool, OS notifications) are delivered through host-supplied callbacks.

Canonical v1.2 posture:

- The v1.1 signer service is deleted outright. Its responsibilities split into two: read-only identity lookups go through `createIdentityService` (`getPublicKey`, `getRelays`, `getProfile`, `getFollows`, `getList`, `getZaps`, `getMutes`, `getBlocked`, `getBadges`); signing happens inside the shell as part of `relay.publish` / `relay.publishEncrypted` and is never exposed to napplets.
- `createKeysService` and `createMediaService` ship real reference backends as of v1.4 (see the dedicated sections below). `createKeysService` attaches a document-level `keydown` listener by default and delivers `keys.action` push envelopes to registered napplets; `createMediaService` mirrors session metadata and playback state to `navigator.mediaSession` and emits `media.command` push envelopes on OS transport events. Both accept a host-bridge option (`HostKeysBridge` / `HostMediaBridge`) so Electron / Tauri / native shells can swap in OS-level backends without re-implementing the wire-protocol bookkeeping.
- `createNotifyService` (NIP-5D `notify.*` NUB) coexists with the legacy `createNotificationService` (ifc-emit `notifications:*` channel). Both may be registered simultaneously until the legacy handler is retired.

## Quick Start

```ts
import {
  createIdentityService,
  createNotificationService,
} from '@kehto/services';

// Identity service — read-only lookups backed by a signer adapter.
runtime.registerService(
  'identity',
  createIdentityService({
    getPublicKey: () => signer.getPublicKey(),
    getRelays: () => signer.getRelays(),
    getProfile: (pk) => nostrClient.fetchProfile(pk),
  }),
);

// Notification service — legacy ifc-emit channel, browser badge fan-out.
runtime.registerService(
  'notifications',
  createNotificationService({ onChange: (list) => updateBadge(list) }),
);
```

## Keys Service

Reference keyboard / chord backend for the `keys.*` NIP-5D NUB. By default attaches a single `document`-level `keydown` listener that matches incoming events against registered chord subscriptions and delivers a canonical `keys.action` push envelope back to the owning napplet. Implement the [`HostKeysBridge`](#hostkeysbridge-interface) interface to swap in OS-level backends (Electron `globalShortcut`, Tauri `GlobalShortcut`).

### Factory

```ts
import { createKeysService } from '@kehto/services';

export function createKeysService(options?: KeysServiceOptions): ServiceHandler & { destroy(): void };
```

`destroy()` detaches the document listener (or the bridge's unsubscribe handles) and clears all subscription registries. Call on shell teardown.

### KeysServiceOptions

| Field | Type | Description |
|-------|------|-------------|
| `onForward` | `(event: { key, code, ctrlKey, altKey, shiftKey, metaKey }) => void` | Called on `keys.forward` envelopes AND on matching document keydowns. DOM-shape payload (the service translates from the wire-format `{ ctrl, alt, shift, meta }` before invoking this callback). |
| `listenerTarget` | `EventTarget` | Defaults to `document`. Pass a fresh `new EventTarget()` in unit tests to isolate the listener. Ignored when `hostBridge` is provided. |
| `hostBridge` | `HostKeysBridge` | Pluggable OS-bridge. When provided, the service delegates `keys.registerAction` to `bridge.subscribe(chord, cb)` and the default document listener is NOT attached. |
| `reservedChords` | `ReadonlyArray<string>` | Optional set of shell-reserved chords (wire-format strings like `'Ctrl+Shift+K'`, `'Cmd+P'`). When a napplet forwards a reserved chord via `keys.forward` OR a document keydown matches a reserved chord, `onForward` (or the `hostBridge` handler) fires but `keys.action` is NOT dispatched to any napplet that registered the same chord via `keys.registerAction`. Precedence: **reserved > registered**. Normalized once at construction via the same parser used for `action.defaultKey`. See [Reserved Chords](#reserved-chords). |

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
   *   - accept the string chord format documented by @napplet/nub/keys
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
import { createKeysService, type HostKeysBridge } from '@kehto/services';
import { globalShortcut } from 'electron';

const electronBridge: HostKeysBridge = {
  subscribe(chord, cb) {
    globalShortcut.register(chord, () => cb({
      key: '', code: '',
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    } as KeyboardEvent));
    return () => globalShortcut.unregister(chord);
  },
};

runtime.registerService('keys', createKeysService({ hostBridge: electronBridge }));
```

### When to plug a custom bridge

Plug a `HostKeysBridge` when the default document listener is insufficient: Electron or Tauri apps that need to register OS-level global hotkeys (chords delivered even when the host window is not focused), native shells that route chords through a platform-specific hotkey manager (macOS Carbon, Linux X11 grab, Windows RegisterHotKey), or test harnesses that inject synthetic events through a controlled `EventTarget`. The bridge owns subscription lifecycle; the service retains per-window bookkeeping (so `onWindowDestroyed` cleanup stays identical across paths).

See the demo: [`apps/playground/napplets/hotkey-chord/src/main.ts`](../../apps/playground/napplets/hotkey-chord/src/main.ts) (the Phase 26 end-to-end exemplar — uses `@napplet/sdk` `keys.registerAction` + `keys.onAction` against the real backend).

### Reserved Chords

Shell-reserved chords let a host application (window manager, launcher shell, tiling WM) claim specific chords for its own dispatch regardless of what napplets subscribe to. Declare the reserved set once at service construction via the `reservedChords` option on [`KeysServiceOptions`](#keysserviceoptions):

```ts
import { createKeysService } from '@kehto/services';

const keys = createKeysService({
  reservedChords: [
    'Ctrl+Alt+T',        // launcher
    'Super+Space',       // workspace switch
    'Ctrl+Shift+Q',      // window close
  ],
  onForward: (event) => {
    // The shell's WM dispatcher — fires for reserved chords regardless of
    // which napplet (if any) tried to register them.
    wmLauncher.dispatch(event);
  },
});

runtime.registerService('keys', keys);
```

**Precedence contract: reserved > registered.** When a napplet forwards a chord via `keys.forward` — or when the default document keydown listener matches a chord registered by a napplet via `keys.registerAction` — the service consults the reserved set first:

- If the chord IS reserved: `onForward` (or the `hostBridge`-registered handler) fires exactly once. No `keys.action` envelope is dispatched to any napplet, even if the napplet registered the identical chord. This is intentional — the shell WANTS the forward; that is why it reserved the chord.
- If the chord is NOT reserved: legacy behavior. `onForward` fires AND every napplet whose registered action matches receives a `keys.action` envelope via its captured `send` handle.

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

// Napplet-side (hotkey-chord napplet, for example): perfectly free to register
// `Ctrl+Shift+K` via keys.registerAction. If Ctrl+Shift+K is NOT in the shell's
// reservedChords, the napplet receives keys.action as normal. If a shell later
// adds Ctrl+Shift+K to its reserved set (e.g. because it now binds the chord
// to a WM action), the napplet's registration is silently suppressed for that
// chord — the shell is authoritative.
```

**Dynamic reservation is out of scope for v1.6.** If a downstream shell needs runtime updates to the reserved set (e.g. "reservation depends on which workspace is active"), open an issue referencing `HostKeysBridge.reserveAbsolute(chords)` — the deferred extension shape. Until then, `reservedChords` is static at service construction.

**OS-level global hotkeys remain a separate concern.** `reservedChords` operates at the service layer — the chord must still reach the host window's focus (or be forwarded via `keys.forward`). For OS-level reservation (chord fires even when the host window is unfocused), implement [`HostKeysBridge.registerGlobalHotkey`](#hostkeysbridge-interface) in your bridge — reserved chords and global hotkeys compose orthogonally.

## Media Service

Reference media backend for the `media.*` NIP-5D NUB. By default mirrors session metadata + playback state to `navigator.mediaSession` via the DOM `MediaSession` API and installs `setActionHandler` callbacks that emit `media.command` push envelopes on OS transport events (play / pause / next / previous / seek). Implement the [`HostMediaBridge`](#hostmediabridge-interface) interface to swap in native backends (Electron bridge, MPRIS on Linux, MediaRemote on macOS).

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
   * nub-media MediaState.status exactly. Implementations MUST be idempotent.
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

See the demo: [`apps/playground/napplets/media-controller/src/main.ts`](../../apps/playground/napplets/media-controller/src/main.ts) (the Phase 27 end-to-end exemplar — uses `@napplet/nub/media` `mediaCreateSession` + `mediaReportState` + `mediaOnCommand` against the real backend).

## Public API

Each factory returns a `ServiceHandler` registrable via `runtime.registerService()`. The bullets below note the canonical NIP-5D domain the handler owns and the ACL capability napplets need in order to reach it.

### Identity NUB
- [`createIdentityService`](../../docs/api/functions/_kehto_services.createIdentityService.html) — `identity.*` reads (`identity:read`). No signing surface; shell mediates signing internally.

### Notify NUB
- [`createNotifyService`](../../docs/api/functions/_kehto_services.createNotifyService.html) — canonical `notify.*` envelopes (`notify:send` / `notify:channel`).
- [`createNotificationService`](../../docs/api/functions/_kehto_services.createNotificationService.html) — legacy ifc-emit `notifications:*` channel; coexists with `createNotifyService` until retired.

### Relay NUB
- [`createRelayPoolService`](../../docs/api/functions/_kehto_services.createRelayPoolService.html) — `relay.publish`, `relay.publishEncrypted`, `relay.subscribe` fan-out (`relay:read` / `relay:write`).
- [`createCacheService`](../../docs/api/functions/_kehto_services.createCacheService.html) — offline event cache (`cache:read` / `cache:write`).
- [`createCoordinatedRelay`](../../docs/api/functions/_kehto_services.createCoordinatedRelay.html) — composite service that bundles relay-pool + cache with read-through behavior.

### Keys NUB
- [`createKeysService`](../../docs/api/functions/_kehto_services.createKeysService.html) — `keys.registerAction` / `keys.unregisterAction` / `keys.forward` + `keys.action` push envelopes (`keys:forward`). Document-level chord listener by default; implement the `HostKeysBridge` interface to swap in Electron / Tauri / OS-level backends. See [Keys Service](#keys-service) for the full contract.

### Media NUB
- [`createMediaService`](../../docs/api/functions/_kehto_services.createMediaService.html) — `media.session.create` / `update` / `destroy` / `media.state` / `media.capabilities` + `media.command` push envelopes (`media:control`). Mirrors to `navigator.mediaSession` by default; implement the `HostMediaBridge` interface to swap in native backends. See [Media Service](#media-service) for the full contract.

### Theme NUB
- [`createThemeService`](../../docs/api/functions/_kehto_services.createThemeService.html) — `theme.get` + `theme.changed` fan-out (`theme:read`). Returns a `ThemeService` with `publishTheme()` / `setTheme()` utilities for host-side updates.

### Audio (legacy ifc-emit)
- [`createAudioService`](../../docs/api/functions/_kehto_services.createAudioService.html) — `audio:*` ifc-emit topic handler. Browser-agnostic registry of per-window audio sources; host wires `onChange` to update transport UI.

### Types
`AudioSource`, `AudioServiceOptions`, `Notification`, `NotificationServiceOptions`, `IdentityServiceOptions`, `RelayPoolServiceOptions`, `CacheServiceOptions`, `CoordinatedRelayOptions`, `KeysServiceOptions`, `MediaServiceOptions`, `NotifyServiceOptions`, `ThemeServiceOptions`, `ThemeService`.

## API Reference

Full API reference: [docs/api/@kehto/services/](../../docs/api/modules/_kehto_services.html) (generated via `pnpm docs:api`).

## License

MIT
