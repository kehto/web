/**
 * media-service.ts — NIP-5D media NUB reference service (navigator.mediaSession
 * reference implementation).
 *
 * Handles 5 napplet -> shell request types from @napplet/nub-media:
 *   media.session.create (result), media.session.update, media.session.destroy,
 *   media.state, media.capabilities.
 *
 * HostMediaBridge contract: {@link HostMediaBridge} defines the pluggable backend
 * contract for metadata/state mirroring + action routing. The browser reference
 * implementation is {@link createBrowserMediaBridge} (mirrors to navigator.mediaSession
 * with setActionHandler matrix). When no hostBridge option is passed, createMediaService
 * internally uses createBrowserMediaBridge as the default — behavior is identical
 * to the Plan 27-01 single-path implementation.
 *
 * navigator.mediaSession mirroring: on session.create the browser bridge mirrors the
 * napplet-supplied metadata to navigator.mediaSession.metadata via new MediaMetadata()
 * and installs setActionHandler callbacks for the 5 OS transport actions
 * (play / pause / nexttrack / previoustrack / seekto). Each callback emits a canonical
 * media.command envelope to the owning napplet — that is the @napplet/nub-media
 * MediaCommandMessage shape consumed by the SDK's mediaOnCommand() helper.
 *
 * media.command push: when the OS user clicks a media control (hardware key, lock-screen
 * transport, OS media overlay), the bridge's onAction callback fires. The service looks
 * up the active session's owning napplet, invokes the per-window send callback captured
 * at session.create time, and delivers:
 *   { type: 'media.command', sessionId, action, value? }
 * where action is the nub-media MediaAction literal (play|pause|next|prev|seek) and
 * value is the seekTime (seconds) for seek.
 *
 * Silent-audio prime: the browser bridge creates a hidden <audio> element with a
 * 4 kHz silent WAV data URL and plays it when the first session becomes active
 * (setActiveSession with a non-null sessionId). Without a playing audio element in
 * the host page, most browsers refuse to render OS media controls. The element is
 * cleaned up when the last session is destroyed (via bridge.destroySession).
 *
 * Multi-session registry with last-active-wins semantics: every session.create is
 * tracked in a Map<sessionId, SessionEntry>; any media.state report promotes that
 * session to active. The active session's metadata and playback state are reflected
 * via bridge.setMetadata / bridge.setPlaybackState. When the active session is
 * destroyed, the next-most-recently-touched session is promoted automatically.
 *
 * Note: this is SEPARATE from packages/services/src/audio-service.ts, which
 * is the legacy ifc-topic-based audio source registry (audio:* topic events
 * over ifc.emit). media-service is the canonical @napplet/nub-media NIP-5D
 * path and they coexist — audio-service continues to track audio sources for
 * shell UI, while media-service handles the NUB protocol envelope surface.
 *
 * Shell -> Napplet push types (media.command) are emitted here when
 * bridge.onAction callbacks fire — this is the canonical Phase 27 real backend.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  MediaAction,
  MediaCapabilitiesMessage,
  MediaCommandMessage,
  MediaMetadata,
  MediaSessionCreateMessage,
  MediaSessionCreateResultMessage,
  MediaSessionDestroyMessage,
  MediaSessionUpdateMessage,
  MediaStateMessage,
} from '@napplet/nub-media';

/** Silent-audio prime data URL (4 kHz silent WAV, 44 bytes, zero network dependency).
 *  Browsers refuse to render OS media controls without a playing audio element —
 *  this silent loop primes the MediaSession API. Per CONTEXT.md Area 1. */
const SILENT_AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** Registry entry — maps a sessionId back to its owning window, metadata snapshot,
 *  state snapshot, and declared capabilities. Internal; never on the wire. */
interface SessionEntry {
  sessionId: string;
  windowId: string;
  metadata: MediaMetadata | undefined;
  state: { status: 'playing' | 'paused' | 'stopped' | 'buffering'; position?: number; duration?: number; volume?: number } | undefined;
  actions: readonly MediaAction[];  // from media.capabilities; defaults to ['play','pause','next','prev','seek']
  /** Monotonic tick updated on every session.create / session.update / state — used for last-active-wins resolution when the current active session is destroyed. */
  lastTouched: number;
}

/** Minimal subset of navigator.mediaSession the browser bridge depends on. Makes the bridge
 *  Node/test-safe: unit tests pass a MockMediaSession via mediaSessionTarget.
 *  The handler parameter uses `details?` (optional) so both the real DOM impl
 *  (which always passes an object) and test mocks that omit details both satisfy
 *  this type structurally. */
type MediaSessionTarget = {
  metadata: MediaMetadataLike | null;
  playbackState: 'none' | 'playing' | 'paused';
  setActionHandler(action: string, handler: ((details?: { action?: string; seekTime?: number }) => void) | null): void;
};

/** Structural subset of the DOM MediaMetadata class — assignable from a plain object
 *  with title/artist/album/artwork fields. The browser impl uses `new MediaMetadata({...})`;
 *  tests can pass a plain object. */
type MediaMetadataLike = { title?: string; artist?: string; album?: string; artwork?: unknown };

/** Media service version — follows semver. */
const MEDIA_SERVICE_VERSION = '1.1.0';

// ─── HostMediaBridge ─────────────────────────────────────────────────────────

/**
 * Host-bridge contract for pluggable media backends.
 *
 * The browser reference implementation ({@link createBrowserMediaBridge}) mirrors
 * napplet-reported metadata/state to `navigator.mediaSession` and installs
 * `setActionHandler` callbacks that fan into the bridge's onAction subscribers.
 * It satisfies this interface with all 5 fields implemented (setActiveSession
 * switches the active session and optionally re-applies action-handler narrowing;
 * destroySession tears down the silent-audio prime on last-session teardown).
 *
 * Host apps (Electron, Tauri) implement this interface in their own code and
 * pass it via `createMediaService({ hostBridge: myBridge })` — the service
 * then delegates metadata/state mirroring + action routing to the bridge and
 * remains browser-free. Session-ownership bookkeeping (which windowId owns
 * which sessionId, which send callback routes media.command back to which
 * napplet) stays in the service layer — that's wire-protocol concern, not a
 * bridge concern.
 *
 * Reference implementations for Electron / Tauri are explicitly out of v1.4
 * scope and live in host-app examples / follow-up milestones (see
 * REQUIREMENTS.md "Future Requirements").
 *
 * @example
 * ```ts
 * // Host-app pseudocode (Electron main-process relay):
 * const electronBridge: HostMediaBridge = {
 *   setMetadata(sessionId, md) { ipcRenderer.send('media:metadata', { sessionId, md }); },
 *   setPlaybackState(sessionId, state) { ipcRenderer.send('media:state', { sessionId, state }); },
 *   onAction(cb) {
 *     const handler = (_: unknown, msg: { sessionId: string; action: MediaAction; value?: number }) =>
 *       cb(msg.sessionId, msg.action, msg.value);
 *     ipcRenderer.on('media:action', handler);
 *     return () => ipcRenderer.removeListener('media:action', handler);
 *   },
 * };
 * const media = createMediaService({ hostBridge: electronBridge });
 * runtime.registerService('media', media);
 * ```
 */
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

// ─── MediaServiceOptions ──────────────────────────────────────────────────────

/**
 * Optional host callbacks for the media service.
 *
 * Host shells can hook session creation and state updates to drive
 * their own UI (e.g., now-playing banner) without replacing the
 * ServiceHandler wholesale.
 *
 * @example
 * ```ts
 * const media = createMediaService({
 *   onSessionCreate: (windowId, sessionId, metadata) => {
 *     console.log(`[${windowId}] created session ${sessionId}`, metadata);
 *   },
 *   onState: (windowId, sessionId, state) => {
 *     nowPlaying.update(windowId, state);
 *   },
 * });
 *
 * runtime.registerService('media', media);
 * ```
 */
export interface MediaServiceOptions {
  /** Called when a napplet creates a session. May inspect/record the session. */
  onSessionCreate?: (windowId: string, sessionId: string, metadata?: unknown) => void;
  /** Called on media.state updates — high-frequency; keep handler work minimal. */
  onState?: (windowId: string, sessionId: string, state: unknown) => void;
  /** Called when a napplet destroys a session. */
  onSessionDestroy?: (windowId: string, sessionId: string) => void;
  /** Called when a napplet updates session metadata. */
  onSessionUpdate?: (windowId: string, sessionId: string, metadata: unknown) => void;
  /** Called when a napplet declares capabilities for a session. */
  onCapabilities?: (windowId: string, sessionId: string, actions: unknown) => void;

  /**
   * MediaSession target override (used by default browser bridge only).
   * Defaults to `navigator.mediaSession` when running in a browser. Pass a
   * MockMediaSession in unit tests. Ignored when `hostBridge` is provided.
   */
  mediaSessionTarget?: MediaSessionTarget;

  /**
   * DOM document override (used by default browser bridge only).
   * Defaults to `document` when available. Set to null to disable the silent-audio
   * prime entirely — useful in unit tests. Ignored when `hostBridge` is provided.
   */
  documentTarget?: Document | null;

  /**
   * Optional pluggable backend for metadata/state mirroring + OS action handling.
   * When provided, the service delegates setMetadata / setPlaybackState / onAction
   * to the bridge and skips navigator.mediaSession entirely. When omitted, the
   * service internally uses {@link createBrowserMediaBridge} as the default.
   * See {@link HostMediaBridge}.
   */
  hostBridge?: HostMediaBridge;
}

// ─── createBrowserMediaBridge ─────────────────────────────────────────────────

/** Default action set — all 5 nub-media transport actions. */
const DEFAULT_ACTIONS: readonly MediaAction[] = ['play', 'pause', 'next', 'prev', 'seek'];

/** Mapping from DOM MediaSession action names to nub-media MediaAction literals. */
const ACTION_MATRIX: ReadonlyArray<[string, MediaAction]> = [
  ['play', 'play'],
  ['pause', 'pause'],
  ['nexttrack', 'next'],
  ['previoustrack', 'prev'],
  ['seekto', 'seek'],
];

/**
 * Reference browser implementation of {@link HostMediaBridge}.
 *
 * Mirrors metadata to `navigator.mediaSession.metadata` (via the DOM
 * `MediaMetadata` constructor when available; plain-object fallback in test
 * envs). Mirrors playback state to `navigator.mediaSession.playbackState`
 * with the canonical mapping: 'playing' maps to 'playing', 'paused' maps to
 * 'paused', 'buffering' maps to 'paused', 'stopped' maps to 'none'. Installs
 * `setActionHandler` callbacks for play/pause/nexttrack/previoustrack/seekto
 * that fan into the onAction subscriber with the mapped `MediaAction` literal
 * (and `value` from `details.seekTime` for seekto). When `setActiveSession` is
 * called with a non-null `actions` parameter, only the declared actions get
 * active handlers — the remaining are cleared (matching the capabilities
 * narrowing behavior of Plan 27-01's inline implementation).
 *
 * Installs a silent-audio prime (4 kHz silent WAV data URL) when the first
 * session becomes active (setActiveSession called with a non-null sessionId) —
 * browsers refuse to render OS media controls without a playing audio element.
 * Removes the element when destroySession brings the active session count to
 * zero.
 *
 * @param opts.mediaSessionTarget - Override navigator.mediaSession (tests).
 * @param opts.documentTarget - Override document (tests; pass null to disable silent-audio prime).
 */
export function createBrowserMediaBridge(opts: {
  mediaSessionTarget?: MediaSessionTarget;
  documentTarget?: Document | null;
} = {}): HostMediaBridge {
  const ms: MediaSessionTarget | null =
    opts.mediaSessionTarget
      ?? (typeof navigator !== 'undefined' && 'mediaSession' in navigator
          ? (navigator.mediaSession as unknown as MediaSessionTarget)
          : null);
  const doc: Document | null =
    opts.documentTarget !== undefined
      ? opts.documentTarget
      : (typeof document !== 'undefined' ? document : null);

  let silentAudioEl: HTMLAudioElement | null = null;
  let activeSessionId: string | null = null;
  let sessionsActive = 0;
  const actionCallbacks = new Set<(sessionId: string, action: MediaAction, value?: number) => void>();

  function primeSilentAudio(): void {
    if (silentAudioEl || !doc) return;
    const el = doc.createElement('audio') as HTMLAudioElement;
    el.src = SILENT_AUDIO_DATA_URL;
    el.loop = true;
    el.style.display = 'none';
    (el as HTMLAudioElement).setAttribute('data-kehto-silent-audio-prime', 'true');
    doc.body.appendChild(el);
    void el.play().catch(() => { /* autoplay refused — metadata mirror still works */ });
    silentAudioEl = el;
  }

  function teardownSilentAudio(): void {
    if (!silentAudioEl) return;
    try { silentAudioEl.pause(); } catch { /* best-effort */ }
    try { silentAudioEl.remove(); } catch { /* best-effort */ }
    silentAudioEl = null;
  }

  /**
   * Install action handlers for the given set of nub-media actions. Actions not
   * in the set get their handler cleared. Matches Plan 27-01's installActionHandlersFor
   * behavior exactly so capabilities-narrowing tests continue to pass.
   */
  function applyActionHandlers(actions: readonly MediaAction[] = DEFAULT_ACTIONS): void {
    if (!ms) return;
    for (const [domAction, nubAction] of ACTION_MATRIX) {
      if (!actions.includes(nubAction)) {
        try { ms.setActionHandler(domAction, null); } catch { /* best-effort */ }
        continue;
      }
      ms.setActionHandler(domAction, (details) => {
        if (!activeSessionId) return;
        const value = nubAction === 'seek' && typeof details?.seekTime === 'number' ? details.seekTime : undefined;
        for (const cb of actionCallbacks) {
          cb(activeSessionId, nubAction, value);
        }
      });
    }
  }

  function writeMetadata(metadata: MediaMetadata | undefined): void {
    if (!ms) return;
    if (!metadata) { ms.metadata = null; return; }
    const artwork = metadata.artwork?.url ? [{ src: metadata.artwork.url }] : undefined;
    const init: MediaMetadataLike & { artwork?: unknown } = {
      title: metadata.title ?? '',
      artist: metadata.artist ?? '',
      album: metadata.album ?? '',
      ...(artwork ? { artwork } : {}),
    };
    try {
      const ctor = (globalThis as unknown as { MediaMetadata?: new (init: MediaMetadataLike) => MediaMetadataLike }).MediaMetadata;
      ms.metadata = ctor ? new ctor(init) : (init as MediaMetadataLike);
    } catch {
      ms.metadata = init as MediaMetadataLike;
    }
  }

  return {
    setMetadata(sessionId, metadata) {
      if (sessionId === activeSessionId) writeMetadata(metadata);
    },
    setPlaybackState(sessionId, state) {
      if (!ms || sessionId !== activeSessionId) return;
      ms.playbackState =
        state === 'playing' ? 'playing'
        : state === 'paused' || state === 'buffering' ? 'paused'
        : 'none';
    },
    onAction(callback) {
      actionCallbacks.add(callback);
      return () => { actionCallbacks.delete(callback); };
    },
    setActiveSession(sessionId, actions) {
      activeSessionId = sessionId;
      if (!sessionId) {
        if (ms) {
          ms.metadata = null;
          ms.playbackState = 'none';
          for (const [domAction] of ACTION_MATRIX) {
            try { ms.setActionHandler(domAction, null); } catch { /* best-effort */ }
          }
        }
        return;
      }
      // Prime silent-audio on first session becoming active.
      if (sessionsActive === 0) { primeSilentAudio(); sessionsActive = 1; }
      applyActionHandlers(actions ?? DEFAULT_ACTIONS);
    },
    destroySession(_sessionId) {
      sessionsActive = Math.max(0, sessionsActive - 1);
      if (sessionsActive === 0) teardownSilentAudio();
    },
  };
}

// ─── createMediaService ───────────────────────────────────────────────────────

/**
 * Create a media NUB service handler with navigator.mediaSession integration.
 *
 * Implements the 5 napplet->shell media.* request types defined in
 * `@napplet/nub-media`. Only `media.session.create` produces a reply
 * envelope (`media.session.create.result`) — the remaining four
 * (`session.update`, `session.destroy`, `state`, `capabilities`) are
 * fire-and-forget per the NUB spec.
 *
 * Unknown `media.*` actions produce a `<type>.error` envelope so
 * napplets are never left hanging on a malformed request.
 *
 * @param options - Optional host callbacks for session lifecycle + state, plus
 *   mediaSessionTarget and documentTarget for test injection, and an optional
 *   hostBridge for native-OS media backend delegation.
 * @returns A ServiceHandler (with `destroy()`) to register with the runtime
 *
 * @example
 * ```ts
 * import { createMediaService } from '@kehto/services';
 *
 * const media = createMediaService();
 * runtime.registerService('media', media);
 * // Later, on shell teardown:
 * media.destroy();
 * ```
 */
export function createMediaService(options: MediaServiceOptions = {}): ServiceHandler & { destroy(): void } {
  // MEDIA-02 per CONTEXT.md Area 2 — host-bridge override path. Bridge owns
  // metadata/state mirroring + action routing; service owns wire-protocol
  // bookkeeping (sessionRegistry + windowSessions + sendHandles) so
  // onWindowDestroyed cleanup + media.command dispatch semantics stay
  // identical across default and override paths.
  const descriptor: ServiceDescriptor = {
    name: 'media',
    version: MEDIA_SERVICE_VERSION,
    description: options.hostBridge
      ? 'NIP-5D media NUB reference handler (host-bridge delegated)'
      : 'NIP-5D media NUB reference handler (navigator.mediaSession mirror)',
  };

  // Bridge resolution: use the caller-provided bridge, else instantiate the
  // default browser bridge from the same options (mediaSessionTarget / documentTarget
  // are bridge-config knobs, preserved backward-compat for Plan 27-01 tests).
  const bridge: HostMediaBridge = options.hostBridge
    ?? createBrowserMediaBridge({
      mediaSessionTarget: options.mediaSessionTarget,
      documentTarget: options.documentTarget,
    });

  // ─── Session-ownership bookkeeping (wire-protocol concern — stays in the service) ─
  const sessionRegistry = new Map<string, SessionEntry>();             // sessionId → entry
  const windowSessions = new Map<string, Set<string>>();               // windowId → Set<sessionId>
  const sendHandles = new Map<string, (msg: NappletMessage) => void>(); // windowId → send
  let activeSessionId: string | null = null;
  let touchCounter = 0;  // monotonic; increments on every touch for last-active-wins

  // Subscribe to bridge action events — fan into the owning napplet's send callback.
  const unsubscribeAction = bridge.onAction((sessionId, action, value) => {
    const entry = sessionRegistry.get(sessionId);
    if (!entry) return;
    const send = sendHandles.get(entry.windowId);
    if (!send) return;
    const payload: MediaCommandMessage = {
      type: 'media.command',
      sessionId,
      action,
      ...(typeof value === 'number' ? { value } : {}),
    };
    send(payload as NappletMessage);
  });

  function setActive(sessionId: string | null, actions?: readonly MediaAction[]): void {
    activeSessionId = sessionId;
    bridge.setActiveSession?.(sessionId, actions);
    if (!sessionId) return;
    const entry = sessionRegistry.get(sessionId);
    if (!entry) return;
    if (entry.metadata) bridge.setMetadata(sessionId, entry.metadata);
    if (entry.state) bridge.setPlaybackState(sessionId, entry.state.status);
  }

  function promoteNextActiveOrClear(): void {
    if (sessionRegistry.size === 0) { setActive(null); return; }
    let latest: SessionEntry | null = null;
    for (const entry of sessionRegistry.values()) {
      if (!latest || entry.lastTouched > latest.lastTouched) latest = entry;
    }
    setActive(latest ? latest.sessionId : null, latest?.actions);
  }

  // ─── ServiceHandler ──────────────────────────────────────────────────
  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      switch (message.type) {
        case 'media.session.create': {
          const m = message as MediaSessionCreateMessage;
          // Capture (or refresh) the per-window send callback.
          sendHandles.set(windowId, send);

          const entry: SessionEntry = {
            sessionId: m.sessionId,
            windowId,
            metadata: m.metadata,
            state: undefined,
            actions: ['play', 'pause', 'next', 'prev', 'seek'],  // default until media.capabilities narrows
            lastTouched: ++touchCounter,
          };
          sessionRegistry.set(m.sessionId, entry);
          if (!windowSessions.has(windowId)) windowSessions.set(windowId, new Set());
          windowSessions.get(windowId)!.add(m.sessionId);

          // Last-active-wins: activate new session with its default capabilities.
          setActive(m.sessionId, entry.actions);
          // Mirror initial metadata if provided (after setActive so bridge has sessionId).
          if (m.metadata) bridge.setMetadata(m.sessionId, m.metadata);

          options.onSessionCreate?.(windowId, m.sessionId, m.metadata);

          const result: MediaSessionCreateResultMessage = {
            type: 'media.session.create.result',
            id: m.id,
            sessionId: m.sessionId,
          };
          send(result as NappletMessage);
          return;
        }

        case 'media.session.update': {
          const m = message as MediaSessionUpdateMessage;
          const entry = sessionRegistry.get(m.sessionId);
          if (entry) {
            entry.metadata = { ...(entry.metadata ?? {}), ...m.metadata };
            entry.lastTouched = ++touchCounter;
            if (m.sessionId === activeSessionId && entry.metadata) {
              bridge.setMetadata(m.sessionId, entry.metadata);
            }
          }
          options.onSessionUpdate?.(windowId, m.sessionId, m.metadata);
          return; // fire-and-forget
        }

        case 'media.session.destroy': {
          const m = message as MediaSessionDestroyMessage;
          const entry = sessionRegistry.get(m.sessionId);
          if (entry) {
            sessionRegistry.delete(m.sessionId);
            const set = windowSessions.get(entry.windowId);
            if (set) {
              set.delete(m.sessionId);
              if (set.size === 0) windowSessions.delete(entry.windowId);
            }
            bridge.destroySession?.(m.sessionId);
            if (m.sessionId === activeSessionId) promoteNextActiveOrClear();
          }
          options.onSessionDestroy?.(windowId, m.sessionId);
          return; // fire-and-forget
        }

        case 'media.state': {
          const m = message as MediaStateMessage;
          const entry = sessionRegistry.get(m.sessionId);
          if (entry) {
            entry.state = { status: m.status, position: m.position, duration: m.duration, volume: m.volume };
            entry.lastTouched = ++touchCounter;
            // Last-active-wins: any state report promotes to active.
            if (activeSessionId !== m.sessionId) setActive(m.sessionId, entry.actions);
            else bridge.setPlaybackState(m.sessionId, m.status);
          }
          options.onState?.(windowId, m.sessionId, m);
          return; // fire-and-forget
        }

        case 'media.capabilities': {
          const m = message as MediaCapabilitiesMessage;
          const entry = sessionRegistry.get(m.sessionId);
          if (entry) {
            entry.actions = m.actions;
            entry.lastTouched = ++touchCounter;
            // Capabilities narrowing: re-activate the active session with the updated
            // action set so the bridge can narrow which OS transport buttons are active.
            if (m.sessionId === activeSessionId) {
              bridge.setActiveSession?.(m.sessionId, entry.actions);
            }
          }
          options.onCapabilities?.(windowId, m.sessionId, m.actions);
          return; // fire-and-forget
        }

        default: {
          const id = (message as NappletMessage & { id?: string }).id ?? '';
          send({
            type: `${message.type}.error`,
            id,
            error: `Unknown media method: ${message.type}`,
          } as NappletMessage);
          return;
        }
      }
    },

    onWindowDestroyed(windowId: string): void {
      const sessions = windowSessions.get(windowId);
      if (sessions) {
        const ownedActive = activeSessionId !== null && sessions.has(activeSessionId);
        for (const sessionId of sessions) {
          sessionRegistry.delete(sessionId);
          bridge.destroySession?.(sessionId);
        }
        windowSessions.delete(windowId);
        if (ownedActive) promoteNextActiveOrClear();
      }
      sendHandles.delete(windowId);
    },

    destroy(): void {
      unsubscribeAction();
      for (const sessionId of sessionRegistry.keys()) bridge.destroySession?.(sessionId);
      bridge.setActiveSession?.(null);
      sessionRegistry.clear();
      windowSessions.clear();
      sendHandles.clear();
      activeSessionId = null;
      touchCounter = 0;
    },
  };
}
