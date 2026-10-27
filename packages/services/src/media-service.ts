/** NAP-MEDIA PR #10 @ 7806f438: owner-bound sessions and ordered retirement. */
import { validMediaCommand } from './media-playback.js';
import type { MediaPlayback, MediaPlaybackBackend, MediaPlaybackCommand, MediaPlaybackState, MediaService, MediaSessionSnapshot } from './media-playback.js';
import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type {
  MediaAction,
  MediaCapabilitiesMessage,
  MediaMetadata,
  MediaSessionContext,
  MediaSessionUpdateMessage,
  MediaStateMessage,
} from '@napplet/nap/media/types';
import {
  createBrowserMediaBridge,
  DEFAULT_MEDIA_ACTIONS,
  type MediaSessionTarget,
} from './browser-media-bridge.js';

export { createBrowserMediaBridge } from './browser-media-bridge.js';
export type {
  MediaMetadataLike,
  MediaSessionTarget,
} from './browser-media-bridge.js';

/** Media service version — follows semver. */
const MEDIA_SERVICE_VERSION = '1.2.0';

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
  context?: MediaSessionContext;
  capabilities?: MediaAction[];
  autoplay?: boolean;
  live?: boolean;
}

type MediaSessionCreateEnvelope = NappletMessage & Partial<MediaSessionCreateOptions> & {
  type: 'media.session.create';
  id?: string;
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
  /** Policy-mediated shell-owned audio/video backend. Omit to reject shell ownership. */
  playback?: MediaPlaybackBackend;
  /** Maximum active and pending sessions per endpoint. Default: 16. */
  maxSessionsPerWindow?: number;
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

interface SessionEntry extends MediaSessionSnapshot {
  send: (message: NappletMessage) => void;
  playback?: MediaPlayback;
}

class MediaRegistry {
  readonly sessions = new Map<string, SessionEntry>();
  readonly pending = new Map<AbortController, string>();
  // Kept until endpoint teardown: retired identifiers must never be reused.
  readonly used = new Map<string, Set<string>>();
  readonly listeners = new Set<(sessions: readonly MediaSessionSnapshot[]) => void>();
  active: string | null = null;
  counter = 0;
  destroyed = false;

  constructor(readonly options: MediaServiceOptions, readonly bridge: HostMediaBridge) {}

  snapshots(): readonly MediaSessionSnapshot[] {
    return [...this.sessions.values()].map(({ send: _send, playback: _playback, ...snapshot }) => structuredClone(snapshot));
  }

  changed(): void {
    for (const listener of this.listeners) listener(this.snapshots());
  }

  activate(sessionId: string | null): void {
    this.active = sessionId;
    const entry = sessionId ? this.sessions.get(sessionId) : undefined;
    this.bridge.setActiveSession?.(sessionId, entry?.actions);
    if (entry?.metadata) {
      // Remote artwork cannot bypass resource policy through OS metadata.
      const { artwork: _artwork, ...metadata } = entry.metadata;
      this.bridge.setMetadata(entry.sessionId, metadata);
    }
    if (entry?.state) this.bridge.setPlaybackState(entry.sessionId, entry.state.status);
  }

  canonicalId(windowId: string, hint?: string): string {
    const ids = this.used.get(windowId) ?? new Set<string>();
    this.used.set(windowId, ids);
    let value = typeof hint === 'string' && hint.trim() ? hint.trim() : `media-${++this.counter}`;
    while ([...this.used.values()].some(used => used.has(value))) value = `media-${++this.counter}`;
    ids.add(value);
    return value;
  }

  retire(sessionId: string, reason = 'destroyed', notify = true): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    this.sessions.delete(sessionId);
    entry.playback?.destroy();
    this.bridge.destroySession?.(sessionId);
    if (this.active === sessionId) this.activate([...this.sessions.keys()].at(-1) ?? null);
    if (notify) entry.send({ type: 'media.session.ended', sessionId, reason } as NappletMessage);
    this.options.onSessionDestroy?.(entry.windowId, sessionId);
    this.changed();
  }

  command(sessionId: string, command: MediaPlaybackCommand): void {
    const entry = this.sessions.get(sessionId);
    if (!entry || !validMediaCommand(command, entry.actions)) return;
    // Caller-supplied reason is explanatory only; this host does not auto-resume.
    const safeCommand = { ...command, reason: 'user' };
    if (entry.playback) entry.playback.command(safeCommand);
    else entry.send({ ...safeCommand, type: 'media.command', sessionId } as NappletMessage);
  }

  publishState(entry: SessionEntry, state: MediaPlaybackState, actions: readonly MediaAction[]): void {
    if (this.sessions.get(entry.sessionId) !== entry) return;
    const capabilitiesChanged = JSON.stringify(entry.actions) !== JSON.stringify(actions);
    entry.state = state;
    entry.actions = [...actions];
    if (state.status === 'playing' || this.active === entry.sessionId) this.activate(entry.sessionId);
    if (entry.owner === 'shell') {
      entry.send({ ...state, type: 'media.state', sessionId: entry.sessionId } as NappletMessage);
      if (capabilitiesChanged) this.sendCapabilities(entry);
    }
    this.options.onState?.(entry.windowId, entry.sessionId, state);
    this.changed();
  }

  sendCapabilities(entry: SessionEntry): void {
    const { sessionId } = entry;
    if (this.sessions.get(sessionId) !== entry) return;
    if (entry.owner === 'shell') entry.send({ type: 'media.capabilities', sessionId, actions: [...entry.actions] } as NappletMessage);
    if (this.sessions.get(sessionId) !== entry) return;
    entry.send({ type: 'media.controls', sessionId, controls: [...entry.actions] } as NappletMessage);
  }

  create(windowId: string, msg: MediaSessionCreateEnvelope, send: SessionEntry['send']): void {
    const fail = (error: string) => send({ type: 'media.session.create.result', id: msg.id ?? '', ...(msg.owner === 'shell' || msg.owner === 'napplet' ? { owner: msg.owner } : {}), error } as NappletMessage);
    if (this.destroyed) return;
    if (msg.owner !== 'napplet' && msg.owner !== 'shell') return fail('missing owner');
    const count = [...this.sessions.values()].filter(entry => entry.windowId === windowId).length
      + [...this.pending.values()].filter(id => id === windowId).length;
    if (count >= (this.options.maxSessionsPerWindow ?? 16)) return fail('session limit exceeded');
    if (msg.owner === 'shell' && !msg.source) return fail('missing source');
    if (msg.owner === 'shell' && !this.options.playback) return fail('unsupported owner mode');
    const entry: SessionEntry = {
      sessionId: this.canonicalId(windowId, msg.sessionId), windowId, owner: msg.owner,
      metadata: msg.metadata, context: msg.context,
      actions: normalizeActions(msg.capabilities ?? DEFAULT_MEDIA_ACTIONS), send,
    };
    if (msg.owner === 'napplet') return this.accept(entry, msg.id);
    const abort = new AbortController();
    this.pending.set(abort, windowId);
    const changed = (state: MediaPlaybackState, actions: readonly MediaAction[]) => this.publishState(entry, state, actions);
    void Promise.resolve().then(() => {
      if (abort.signal.aborted) throw new Error('endpoint closed');
      return this.options.playback!.open(windowId, msg as MediaSessionCreateOptions, abort.signal, changed);
    }).then(playback => {
      if (abort.signal.aborted || this.destroyed) return playback.destroy();
      entry.playback = playback;
      entry.state = playback.state;
      entry.actions = [...playback.actions];
      this.accept(entry, msg.id);
    }).catch(() => {
      if (!abort.signal.aborted && !this.destroyed) fail('source unavailable or autoplay denied');
    }).finally(() => this.pending.delete(abort));
  }

  accept(entry: SessionEntry, id?: string): void {
    this.sessions.set(entry.sessionId, entry);
    // The result must precede pushes, including reentrant retirement by host UI.
    entry.send({ type: 'media.session.create.result', id: id ?? '', sessionId: entry.sessionId, owner: entry.owner } as NappletMessage);
    if (this.sessions.get(entry.sessionId) !== entry) return;
    this.activate(entry.sessionId);
    this.sendCapabilities(entry);
    if (entry.owner === 'shell' && entry.state) this.publishState(entry, entry.state, entry.actions);
    this.options.onSessionCreate?.(entry.windowId, entry.sessionId, entry.metadata);
    this.changed();
  }

  handle(windowId: string, message: NappletMessage, send: SessionEntry['send']): void {
    if (this.destroyed) return;
    if (message.type === 'media.session.create') return this.create(windowId, message as MediaSessionCreateEnvelope, send);
    const msg = message as NappletMessage & { sessionId: string };
    const entry = this.sessions.get(msg.sessionId);
    if (!entry || entry.windowId !== windowId) return;
    switch (message.type) {
      case 'media.session.destroy': return this.retire(entry.sessionId);
      case 'media.session.update': {
        const update = message as MediaSessionUpdateMessage;
        entry.metadata = { ...entry.metadata, ...update.metadata };
        if (this.active === entry.sessionId) this.activate(entry.sessionId);
        this.options.onSessionUpdate?.(windowId, entry.sessionId, update.metadata);
        this.changed();
        return;
      }
      case 'media.command':
        if (entry.owner === 'shell') this.command(entry.sessionId, message as NappletMessage & MediaPlaybackCommand);
        return;
      case 'media.state': {
        const report = message as MediaStateMessage & { reason?: string };
        if (entry.owner !== 'napplet' || !['playing', 'paused', 'stopped', 'buffering'].includes(report.status)) return;
        const state: MediaPlaybackState = { status: report.status };
        for (const key of ['position', 'duration', 'volume'] as const) {
          const value = report[key];
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && (key !== 'volume' || value <= 1)) state[key] = value;
        }
        if (typeof report.reason === 'string') state.reason = report.reason;
        this.publishState(entry, state, entry.actions);
        return;
      }
      case 'media.capabilities':
        if (entry.owner !== 'napplet') return;
        entry.actions = normalizeActions((message as MediaCapabilitiesMessage).actions);
        if (this.active === entry.sessionId) this.activate(entry.sessionId);
        this.options.onCapabilities?.(windowId, entry.sessionId, entry.actions);
        this.sendCapabilities(entry);
        this.changed();
    }
  }

  destroyWindow(windowId: string): void {
    for (const [abort, id] of this.pending) if (id === windowId) { abort.abort(); this.pending.delete(abort); }
    for (const entry of this.sessions.values()) if (entry.windowId === windowId) this.retire(entry.sessionId, 'destroyed', false);
    // Keep IDs unique across replacement endpoints for this service lifetime.
  }
}

function normalizeActions(value: unknown): MediaAction[] {
  const all = ['play', 'pause', 'stop', 'next', 'prev', 'seek', 'volume'];
  return Array.isArray(value) ? [...new Set(value.filter(action => all.includes(action)))] : [];
}

/**
 * Create owner-bound NAP-MEDIA sessions with optional shell playback.
 * @param options - OS integration, policy-mediated playback and host observers.
 * @returns A service with session snapshots and host controls.
 * @example
 * ```ts
 * const media = createMediaService({ playback: browserPlayback });
 * runtime.registerService('media', media);
 * ```
 */
export function createMediaService(options: MediaServiceOptions = {}): MediaService {
  const bridge = options.hostBridge ?? createBrowserMediaBridge(options);
  const registry = new MediaRegistry(options, bridge);
  const off = bridge.onAction((sessionId, action, value) => registry.command(sessionId, { action, value }));
  return {
    descriptor: { name: 'media', version: MEDIA_SERVICE_VERSION, description: 'NAP-MEDIA session registry and player' },
    handleMessage: (windowId, message, send) => registry.handle(windowId, message, send),
    onWindowDestroyed: windowId => registry.destroyWindow(windowId),
    onCapabilityRevoked(windowId, capability) {
      if (capability !== null && capability !== 'media:control') return;
      for (const [abort, id] of registry.pending) if (id === windowId) { abort.abort(); registry.pending.delete(abort); }
      for (const entry of registry.sessions.values()) if (entry.windowId === windowId) registry.retire(entry.sessionId, 'policy');
    },
    getSessions: () => registry.snapshots(),
    subscribe(listener) {
      registry.listeners.add(listener);
      listener(registry.snapshots());
      return () => { registry.listeners.delete(listener); };
    },
    command: (sessionId, command) => registry.command(sessionId, command),
    retire: (sessionId, reason) => registry.retire(sessionId, reason),
    getElement: sessionId => registry.sessions.get(sessionId)?.playback?.element,
    destroy() {
      registry.destroyed = true;
      off();
      for (const abort of registry.pending.keys()) abort.abort();
      registry.pending.clear();
      for (const id of registry.sessions.keys()) registry.retire(id, 'policy');
      registry.used.clear();
      registry.listeners.clear();
      bridge.setActiveSession?.(null);
    },
  };
}

