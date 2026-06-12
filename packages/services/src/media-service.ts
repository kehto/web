/**
 * media-service.ts — NIP-5D media NUB reference service (navigator.mediaSession
 * reference implementation).
 *
 * Handles the napplet-owned subset of @napplet/nub/media:
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
 * media.command envelope to the owning napplet — that is the @napplet/nub/media
 * MediaCommandMessage shape consumed by the SDK's mediaOnCommand() helper.
 *
 * NAP-MEDIA now distinguishes napplet-owned playback from shell-owned
 * playback. This reference backend supports `owner: "napplet"` because it
 * mirrors a napplet's own media element to navigator.mediaSession. It rejects
 * `owner: "shell"` until a host bridge provides policy-checked source fetching
 * and playback.
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
 * over ifc.emit). media-service is the canonical @napplet/nub/media NIP-5D
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
  MediaSessionDestroyMessage,
  MediaSessionUpdateMessage,
  MediaStateMessage,
} from '@napplet/nub/media/types';

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
  owner: MediaPlaybackOwner;
  source: MediaSourceRef | undefined;
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
export type MediaSessionTarget = {
  metadata: MediaMetadataLike | null;
  playbackState: 'none' | 'playing' | 'paused';
  setActionHandler(action: string, handler: ((details?: { action?: string; seekTime?: number }) => void) | null): void;
};

/** Structural subset of the DOM MediaMetadata class — assignable from a plain object
 *  with title/artist/album/artwork fields. The browser impl uses `new MediaMetadata({...})`;
 *  tests can pass a plain object. */
export type MediaMetadataLike = { title?: string; artist?: string; album?: string; artwork?: unknown };

/** Media service version — follows semver. */
const MEDIA_SERVICE_VERSION = '1.1.0';

export type MediaPlaybackOwner = 'shell' | 'napplet';

export interface MediaSourceRef {
  url?: string;
  blossomHash?: string;
  nostr?: {
    eventId?: string;
    address?: string;
    relays?: string[];
  };
  mimeType?: string;
}

export interface MediaSessionCreateOptions {
  owner: MediaPlaybackOwner;
  sessionId?: string;
  source?: MediaSourceRef;
  metadata?: MediaMetadata;
  capabilities?: MediaAction[];
  autoplay?: boolean;
  live?: boolean;
}

type MediaSessionCreateEnvelope = NappletMessage & Partial<MediaSessionCreateOptions> & {
  type: 'media.session.create';
  id?: string;
};

type MediaSessionCreateResultEnvelope = NappletMessage & {
  type: 'media.session.create.result';
  id: string;
  sessionId?: string;
  owner?: MediaPlaybackOwner;
  error?: string;
};

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
 *   setMetadata(sessionId, md) { mediaBridge.sendMetadata({ sessionId, md }); },
 *   setPlaybackState(sessionId, state) { mediaBridge.sendPlaybackState({ sessionId, state }); },
 *   onAction(cb) {
 *     const handler = (_: unknown, msg: { sessionId: string; action: MediaAction; value?: number }) =>
 *       cb(msg.sessionId, msg.action, msg.value);
 *     mediaBridge.onAction(handler);
 *     return () => mediaBridge.offAction(handler);
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
          ? (navigator.mediaSession as MediaSessionTarget)
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
      const ctor = (globalThis as typeof globalThis & { MediaMetadata?: new (init: MediaMetadataLike) => MediaMetadataLike }).MediaMetadata;
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

interface MediaServiceState {
  bridge: HostMediaBridge;
  options: MediaServiceOptions;
  sessionRegistry: Map<string, SessionEntry>;
  windowSessions: Map<string, Set<string>>;
  sendHandles: Map<string, (msg: NappletMessage) => void>;
  activeSessionId: string | null;
  touchCounter: number;
  sessionCounter: number;
}

function createMediaServiceState(options: MediaServiceOptions, bridge: HostMediaBridge): MediaServiceState {
  return {
    bridge,
    options,
    sessionRegistry: new Map<string, SessionEntry>(),
    windowSessions: new Map<string, Set<string>>(),
    sendHandles: new Map<string, (msg: NappletMessage) => void>(),
    activeSessionId: null,
    touchCounter: 0,
    sessionCounter: 0,
  };
}

function setActive(state: MediaServiceState, sessionId: string | null, actions?: readonly MediaAction[]): void {
  state.activeSessionId = sessionId;
  state.bridge.setActiveSession?.(sessionId, actions);
  if (!sessionId) return;
  const entry = state.sessionRegistry.get(sessionId);
  if (!entry) return;
  if (entry.metadata) state.bridge.setMetadata(sessionId, entry.metadata);
  if (entry.state) state.bridge.setPlaybackState(sessionId, entry.state.status);
}

function promoteNextActiveOrClear(state: MediaServiceState): void {
  if (state.sessionRegistry.size === 0) {
    setActive(state, null);
    return;
  }
  let latest: SessionEntry | null = null;
  for (const entry of state.sessionRegistry.values()) {
    if (!latest || entry.lastTouched > latest.lastTouched) latest = entry;
  }
  setActive(state, latest ? latest.sessionId : null, latest?.actions);
}

function sendMediaCommand(state: MediaServiceState, sessionId: string, action: MediaAction, value?: number): void {
  const entry = state.sessionRegistry.get(sessionId);
  if (!entry) return;
  const send = state.sendHandles.get(entry.windowId);
  if (!send) return;
  const payload: MediaCommandMessage = {
    type: 'media.command',
    sessionId,
    action,
    ...(typeof value === 'number' ? { value } : {}),
  };
  send(payload as NappletMessage);
}

function registerWindowSession(state: MediaServiceState, windowId: string, sessionId: string): void {
  if (!state.windowSessions.has(windowId)) state.windowSessions.set(windowId, new Set());
  state.windowSessions.get(windowId)!.add(sessionId);
}

function sendSessionCreateResult(
  send: (msg: NappletMessage) => void,
  id: string | undefined,
  fields: Omit<MediaSessionCreateResultEnvelope, 'type' | 'id'>,
): void {
  send({
    type: 'media.session.create.result',
    id: id ?? '',
    ...fields,
  } as NappletMessage);
}

function isMediaPlaybackOwner(value: unknown): value is MediaPlaybackOwner {
  return value === 'shell' || value === 'napplet';
}

function hasSourceRef(source: MediaSourceRef | undefined): boolean {
  if (!source) return false;
  if (typeof source.url === 'string' && source.url.length > 0) return true;
  if (typeof source.blossomHash === 'string' && source.blossomHash.length > 0) return true;
  if (source.nostr) {
    return Boolean(source.nostr.eventId || source.nostr.address);
  }
  return false;
}

function canonicalizeSessionId(
  state: MediaServiceState,
  windowId: string,
  preferredSessionId: string | undefined,
): string {
  const trimmed = typeof preferredSessionId === 'string' ? preferredSessionId.trim() : '';
  const hint = trimmed || `session-${++state.sessionCounter}`;
  if (!state.sessionRegistry.has(hint)) return hint;

  let next: string;
  do {
    next = `${windowId}:${hint}:${++state.sessionCounter}`;
  } while (state.sessionRegistry.has(next));
  return next;
}

function handleSessionCreate(
  state: MediaServiceState,
  windowId: string,
  message: MediaSessionCreateEnvelope,
  send: (msg: NappletMessage) => void,
): void {
  if (!isMediaPlaybackOwner(message.owner)) {
    sendSessionCreateResult(send, message.id, { error: 'missing owner' });
    return;
  }

  if (message.owner === 'shell') {
    if (!hasSourceRef(message.source)) {
      sendSessionCreateResult(send, message.id, { owner: 'shell', error: 'missing source' });
      return;
    }
    sendSessionCreateResult(send, message.id, { owner: 'shell', error: 'unsupported owner mode' });
    return;
  }

  state.sendHandles.set(windowId, send);
  const sessionId = canonicalizeSessionId(state, windowId, message.sessionId);
  const entry: SessionEntry = {
    sessionId,
    windowId,
    owner: message.owner,
    source: message.source,
    metadata: message.metadata,
    state: undefined,
    actions: message.capabilities ?? DEFAULT_ACTIONS,
    lastTouched: ++state.touchCounter,
  };
  state.sessionRegistry.set(sessionId, entry);
  registerWindowSession(state, windowId, sessionId);
  setActive(state, sessionId, entry.actions);
  state.options.onSessionCreate?.(windowId, sessionId, message.metadata);
  sendSessionCreateResult(send, message.id, { sessionId, owner: message.owner });
}

function handleSessionUpdate(state: MediaServiceState, windowId: string, message: MediaSessionUpdateMessage): void {
  const entry = state.sessionRegistry.get(message.sessionId);
  if (entry) {
    entry.metadata = { ...entry.metadata, ...message.metadata };
    entry.lastTouched = ++state.touchCounter;
    if (entry.owner === 'napplet' && message.sessionId === state.activeSessionId && entry.metadata) {
      state.bridge.setMetadata(message.sessionId, entry.metadata);
    }
  }
  state.options.onSessionUpdate?.(windowId, message.sessionId, message.metadata);
}

function handleSessionDestroy(state: MediaServiceState, windowId: string, message: MediaSessionDestroyMessage): void {
  const entry = state.sessionRegistry.get(message.sessionId);
  if (entry) {
    state.sessionRegistry.delete(message.sessionId);
    const set = state.windowSessions.get(entry.windowId);
    if (set) {
      set.delete(message.sessionId);
      if (set.size === 0) state.windowSessions.delete(entry.windowId);
    }
    state.bridge.destroySession?.(message.sessionId);
    if (message.sessionId === state.activeSessionId) promoteNextActiveOrClear(state);
  }
  state.options.onSessionDestroy?.(windowId, message.sessionId);
}

function handleMediaState(state: MediaServiceState, windowId: string, message: MediaStateMessage): void {
  const entry = state.sessionRegistry.get(message.sessionId);
  if (entry?.owner === 'napplet') {
    entry.state = {
      status: message.status,
      position: message.position,
      duration: message.duration,
      volume: message.volume,
    };
    entry.lastTouched = ++state.touchCounter;
    if (state.activeSessionId !== message.sessionId) setActive(state, message.sessionId, entry.actions);
    else state.bridge.setPlaybackState(message.sessionId, message.status);
  }
  state.options.onState?.(windowId, message.sessionId, message);
}

function handleMediaCapabilities(
  state: MediaServiceState,
  windowId: string,
  message: MediaCapabilitiesMessage,
): void {
  const entry = state.sessionRegistry.get(message.sessionId);
  if (entry?.owner === 'napplet') {
    entry.actions = message.actions;
    entry.lastTouched = ++state.touchCounter;
    if (message.sessionId === state.activeSessionId) {
      state.bridge.setActiveSession?.(message.sessionId, entry.actions);
    }
  }
  state.options.onCapabilities?.(windowId, message.sessionId, message.actions);
}

function handleMediaMessage(
  state: MediaServiceState,
  windowId: string,
  message: NappletMessage,
  send: (msg: NappletMessage) => void,
): void {
  switch (message.type) {
    case 'media.session.create':
      handleSessionCreate(state, windowId, message as MediaSessionCreateEnvelope, send);
      return;
    case 'media.session.update':
      handleSessionUpdate(state, windowId, message as MediaSessionUpdateMessage);
      return;
    case 'media.session.destroy':
      handleSessionDestroy(state, windowId, message as MediaSessionDestroyMessage);
      return;
    case 'media.state':
      handleMediaState(state, windowId, message as MediaStateMessage);
      return;
    case 'media.capabilities':
      handleMediaCapabilities(state, windowId, message as MediaCapabilitiesMessage);
      return;
    default: {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown media method: ${message.type}`,
      } as NappletMessage);
    }
  }
}

function destroyWindowSessions(state: MediaServiceState, windowId: string): void {
  const sessions = state.windowSessions.get(windowId);
  if (sessions) {
    const ownedActive = state.activeSessionId !== null && sessions.has(state.activeSessionId);
    for (const sessionId of sessions) {
      state.sessionRegistry.delete(sessionId);
      state.bridge.destroySession?.(sessionId);
    }
    state.windowSessions.delete(windowId);
    if (ownedActive) promoteNextActiveOrClear(state);
  }
  state.sendHandles.delete(windowId);
}

function destroyMediaState(state: MediaServiceState, unsubscribeAction: () => void): void {
  unsubscribeAction();
  for (const sessionId of state.sessionRegistry.keys()) state.bridge.destroySession?.(sessionId);
  state.bridge.setActiveSession?.(null);
  state.sessionRegistry.clear();
  state.windowSessions.clear();
  state.sendHandles.clear();
  state.activeSessionId = null;
  state.touchCounter = 0;
  state.sessionCounter = 0;
}

/**
 * Create a media NUB service handler with navigator.mediaSession integration.
 *
 * Implements the 5 napplet->shell media.* request types defined in
 * `@napplet/nub/media`. Only `media.session.create` produces a reply
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
  const descriptor: ServiceDescriptor = {
    name: 'media',
    version: MEDIA_SERVICE_VERSION,
    description: options.hostBridge
      ? 'NIP-5D media NUB reference handler (host-bridge delegated)'
      : 'NIP-5D media NUB reference handler (navigator.mediaSession mirror)',
  };

  const bridge: HostMediaBridge = options.hostBridge
    ?? createBrowserMediaBridge({
      mediaSessionTarget: options.mediaSessionTarget,
      documentTarget: options.documentTarget,
    });
  const state = createMediaServiceState(options, bridge);

  const unsubscribeAction = bridge.onAction((sessionId, action, value) => {
    sendMediaCommand(state, sessionId, action, value);
  });

  return {
    descriptor,

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      handleMediaMessage(state, windowId, message, send);
    },

    onWindowDestroyed(windowId: string): void {
      destroyWindowSessions(state, windowId);
    },

    destroy(): void {
      destroyMediaState(state, unsubscribeAction);
    },
  };
}
