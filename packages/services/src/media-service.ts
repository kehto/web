/**
 * media-service.ts — NIP-5D media NUB reference service (navigator.mediaSession
 * reference implementation).
 *
 * Handles 5 napplet -> shell request types from @napplet/nub-media:
 *   media.session.create (result), media.session.update, media.session.destroy,
 *   media.state, media.capabilities.
 *
 * navigator.mediaSession mirroring: on session.create the service mirrors the
 * napplet-supplied metadata to navigator.mediaSession.metadata via new MediaMetadata()
 * and installs setActionHandler callbacks for the 5 OS transport actions
 * (play / pause / nexttrack / previoustrack / seekto). Each callback emits a canonical
 * media.command envelope to the owning napplet — that is the @napplet/nub-media
 * MediaCommandMessage shape consumed by the SDK's mediaOnCommand() helper.
 *
 * media.command push: when the OS user clicks a media control (hardware key, lock-screen
 * transport, OS media overlay), the installed setActionHandler callback fires. The
 * service looks up the active session's owning napplet, invokes the per-window send
 * callback captured at session.create time, and delivers:
 *   { type: 'media.command', sessionId, action, value? }
 * where action is the nub-media MediaAction literal (play|pause|next|prev|seek) and
 * value is the seekTime (seconds) for seek.
 *
 * Silent-audio prime: on first session.create the service creates a hidden <audio>
 * element with a 4 kHz silent WAV data URL and plays it. Without a playing audio
 * element in the host page, most browsers refuse to render OS media controls.
 * The element is cleaned up when the last session is destroyed.
 *
 * Multi-session registry with last-active-wins semantics: every session.create is
 * tracked in a Map<sessionId, SessionEntry>; any media.state report promotes that
 * session to active. The active session's metadata and playback state are reflected
 * on navigator.mediaSession. When the active session is destroyed, the next-most-
 * recently-touched session is promoted automatically.
 *
 * Note: this is SEPARATE from packages/services/src/audio-service.ts, which
 * is the legacy ifc-topic-based audio source registry (audio:* topic events
 * over ifc.emit). media-service is the canonical @napplet/nub-media NIP-5D
 * path and they coexist — audio-service continues to track audio sources for
 * shell UI, while media-service handles the NUB protocol envelope surface.
 *
 * Shell -> Napplet push types (media.command) are emitted here when
 * setActionHandler callbacks fire — this is the canonical Phase 27 real backend.
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  MediaAction,
  MediaArtwork,
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

/** Minimal subset of navigator.mediaSession the service depends on. Makes the service
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
   * MediaSession target to install action handlers on. Defaults to
   * `navigator.mediaSession` when running in a browser. Pass a MockMediaSession
   * in unit tests. Mirrors the listenerTarget pattern from keys-service.ts.
   */
  mediaSessionTarget?: MediaSessionTarget;

  /**
   * DOM document to append the silent-audio prime element to. Defaults to
   * `document` when available. Set to null (or a mock object) to disable the silent-audio
   * prime entirely — useful in unit tests.
   */
  documentTarget?: Document | null;
}

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
 *   mediaSessionTarget and documentTarget for test injection
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
    description: 'NIP-5D media NUB reference handler (navigator.mediaSession mirror)',
  };

  // ─── Session registries ──────────────────────────────────────────────
  const sessionRegistry = new Map<string, SessionEntry>();             // sessionId → entry
  const windowSessions = new Map<string, Set<string>>();                // windowId → Set<sessionId>
  // Per-window `send` callback captured at session.create time. Used to
  // push media.command envelopes back to the owning napplet when the OS
  // user clicks a media control — this is the canonical @napplet/nub-media
  // surface the SDK's mediaOnCommand(...) helper consumes.
  const sendHandles = new Map<string, (msg: NappletMessage) => void>(); // windowId → send
  let activeSessionId: string | null = null;
  let touchCounter = 0;  // monotonic; increments on every touch for last-active-wins
  let silentAudioEl: HTMLAudioElement | null = null;

  // ─── MediaSession target fallback (SSR / test-safe, mirrors keys-service.ts) ─
  const ms: MediaSessionTarget | null =
    options.mediaSessionTarget
      ?? (typeof navigator !== 'undefined' && 'mediaSession' in navigator
          ? (navigator.mediaSession as unknown as MediaSessionTarget)
          : null);

  const doc: Document | null =
    options.documentTarget !== undefined
      ? options.documentTarget
      : (typeof document !== 'undefined' ? document : null);

  // ─── Silent-audio prime ──────────────────────────────────────────────
  function primeSilentAudio(): void {
    if (silentAudioEl || !doc) return;
    const el = doc.createElement('audio') as HTMLAudioElement;
    el.src = SILENT_AUDIO_DATA_URL;
    el.loop = true;
    el.style.display = 'none';
    el.setAttribute('data-kehto-silent-audio-prime', 'true');
    doc.body.appendChild(el);
    // Playback may be refused by autoplay policy; log + swallow — a failed prime
    // is not fatal (the service still mirrors state; OS controls just might not appear).
    void el.play().catch(() => { /* autoplay refused — metadata mirror still works */ });
    silentAudioEl = el;
  }

  function teardownSilentAudio(): void {
    if (!silentAudioEl) return;
    try { silentAudioEl.pause(); } catch { /* best-effort */ }
    try { silentAudioEl.remove(); } catch { /* best-effort */ }
    silentAudioEl = null;
  }

  // ─── Metadata / state mirroring ──────────────────────────────────────
  function toMediaImageArray(artwork: MediaArtwork | undefined): Array<{ src: string }> {
    if (!artwork?.url) return [];
    return [{ src: artwork.url }];
  }

  function mirrorMetadata(entry: SessionEntry): void {
    if (!ms) return;
    const md = entry.metadata;
    if (!md) { ms.metadata = null; return; }
    // Prefer the DOM MediaMetadata ctor when available (browser); fall back to
    // a plain object in test envs. Both satisfy MediaMetadataLike.
    const artwork = toMediaImageArray(md.artwork);
    const init: MediaMetadataLike & { artwork?: unknown } = {
      title: md.title ?? '',
      artist: md.artist ?? '',
      album: md.album ?? '',
      ...(artwork.length > 0 ? { artwork } : {}),
    };
    try {
      // Browser path — real MediaMetadata class available globally.
      const ctor = (globalThis as unknown as { MediaMetadata?: new (init: MediaMetadataLike) => MediaMetadataLike }).MediaMetadata;
      ms.metadata = ctor ? new ctor(init) : (init as MediaMetadataLike);
    } catch {
      ms.metadata = init as MediaMetadataLike;
    }
  }

  function mirrorPlaybackState(entry: SessionEntry): void {
    if (!ms || !entry.state) return;
    // MediaSession API only knows 'none' | 'playing' | 'paused'. Map buffering → paused,
    // stopped → none per W3C Media Session spec (buffering is not a distinct state).
    ms.playbackState =
      entry.state.status === 'playing' ? 'playing'
      : entry.state.status === 'paused' || entry.state.status === 'buffering' ? 'paused'
      : 'none';
  }

  function clearMediaSession(): void {
    if (!ms) return;
    ms.metadata = null;
    ms.playbackState = 'none';
  }

  // ─── Action-handler installation + media.command emission ────────────
  const ACTION_MATRIX: ReadonlyArray<[string, MediaAction]> = [
    ['play', 'play'],
    ['pause', 'pause'],
    ['nexttrack', 'next'],
    ['previoustrack', 'prev'],
    ['seekto', 'seek'],
  ];

  function installActionHandlersFor(entry: SessionEntry): void {
    if (!ms) return;
    for (const [domAction, nubAction] of ACTION_MATRIX) {
      // Only install handlers for actions declared in the session's capabilities.
      // Default capabilities (when no media.capabilities has been received yet)
      // include all 5 mapped actions — see sessionRegistry entry initialization.
      if (!entry.actions.includes(nubAction)) {
        try { ms.setActionHandler(domAction, null); } catch { /* best-effort */ }
        continue;
      }
      ms.setActionHandler(domAction, (details) => {
        // Only dispatch if the session at firing-time is still the active session.
        // Active-session identity may have shifted between handler install and fire.
        const active = activeSessionId ? sessionRegistry.get(activeSessionId) : null;
        if (!active) return;
        const send = sendHandles.get(active.windowId);
        if (!send) return;
        const payload: MediaCommandMessage = {
          type: 'media.command',
          sessionId: active.sessionId,
          action: nubAction,
          ...(nubAction === 'seek' && typeof details?.seekTime === 'number'
              ? { value: details.seekTime }
              : {}),
        };
        send(payload as NappletMessage);
      });
    }
  }

  function clearAllActionHandlers(): void {
    if (!ms) return;
    for (const [domAction] of ACTION_MATRIX) {
      try { ms.setActionHandler(domAction, null); } catch { /* best-effort */ }
    }
  }

  function setActiveSession(sessionId: string | null): void {
    activeSessionId = sessionId;
    if (!sessionId) { clearMediaSession(); clearAllActionHandlers(); return; }
    const entry = sessionRegistry.get(sessionId);
    if (!entry) return;
    mirrorMetadata(entry);
    if (entry.state) mirrorPlaybackState(entry);
    installActionHandlersFor(entry);
  }

  function promoteNextActiveOrClear(): void {
    if (sessionRegistry.size === 0) {
      setActiveSession(null);
      teardownSilentAudio();
      return;
    }
    // Most-recently-touched wins.
    let latest: SessionEntry | null = null;
    for (const entry of sessionRegistry.values()) {
      if (!latest || entry.lastTouched > latest.lastTouched) latest = entry;
    }
    setActiveSession(latest ? latest.sessionId : null);
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

          primeSilentAudio();

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

          // Last-active-wins: newest session becomes the active one.
          setActiveSession(m.sessionId);

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
            if (m.sessionId === activeSessionId) mirrorMetadata(entry);
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
            if (activeSessionId !== m.sessionId) setActiveSession(m.sessionId);
            else mirrorPlaybackState(entry);
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
            if (m.sessionId === activeSessionId) installActionHandlersFor(entry);
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
        for (const sessionId of sessions) sessionRegistry.delete(sessionId);
        windowSessions.delete(windowId);
        if (ownedActive) promoteNextActiveOrClear();
      }
      sendHandles.delete(windowId);
    },

    destroy(): void {
      clearAllActionHandlers();
      teardownSilentAudio();
      sessionRegistry.clear();
      windowSessions.clear();
      sendHandles.clear();
      activeSessionId = null;
      touchCounter = 0;
      if (ms) clearMediaSession();
    },
  };
}
