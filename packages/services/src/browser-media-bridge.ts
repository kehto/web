import type { MediaAction, MediaMetadata } from '@napplet/nap/media/types';
import type { HostMediaBridge } from './media-service.js';

/** Silent-audio prime data URL (4 kHz silent WAV, 44 bytes, zero network dependency).
 *  Browsers refuse to render OS media controls without a playing audio element —
 *  this silent loop primes the MediaSession API. Per CONTEXT.md Area 1. */
const SILENT_AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** Default action set — all 5 nap-media transport actions. */
export const DEFAULT_MEDIA_ACTIONS: readonly MediaAction[] = ['play', 'pause', 'next', 'prev', 'seek'];

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

/** Mapping from DOM MediaSession action names to nap-media MediaAction literals. */
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
   * Install action handlers for the given set of nap-media actions. Actions not
   * in the set get their handler cleared. Matches Plan 27-01's installActionHandlersFor
   * behavior exactly so capabilities-narrowing tests continue to pass.
   */
  function applyActionHandlers(actions: readonly MediaAction[] = DEFAULT_MEDIA_ACTIONS): void {
    if (!ms) return;
    for (const [domAction, napAction] of ACTION_MATRIX) {
      if (!actions.includes(napAction)) {
        try { ms.setActionHandler(domAction, null); } catch { /* best-effort */ }
        continue;
      }
      ms.setActionHandler(domAction, (details) => {
        if (!activeSessionId) return;
        const value = napAction === 'seek' && typeof details?.seekTime === 'number' ? details.seekTime : undefined;
        for (const cb of actionCallbacks) {
          cb(activeSessionId, napAction, value);
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
      applyActionHandlers(actions ?? DEFAULT_MEDIA_ACTIONS);
    },
    destroySession(_sessionId) {
      sessionsActive = Math.max(0, sessionsActive - 1);
      if (sessionsActive === 0) teardownSilentAudio();
    },
  };
}
