/**
 * domains/media.ts — Mock NAP-MEDIA service.
 *
 * Spec: naps/NAP-MEDIA.md @ napplet/naps PR #10 head 7806f4385302 (draft)
 *       + torrent file sources from PR #133 head 8ea49c337cf3 (draft)
 * Routes: media.session.create, media.session.update, media.session.destroy,
 *         media.state, media.capabilities, media.command
 * Spec gaps / decisions:
 * - `@napplet/nap/media/types` 0.32.0 lags PR #133 (no `source.torrent`) and
 *   PR #10 (`MediaState.reason`); local `MockMediaSourceRef` and
 *   `MockMediaPlaybackState` widen them.
 * - Shell-owned sources: `url` (https only; other schemes → `source blocked`),
 *   `blossomHash` (64 hex), and `torrent` (job id = a `LINUX_DISTROS` id,
 *   single-file so `fileIndex` must be 0). `nostr` refs → `unsupported source`.
 * - `media.controls` carries the shell's full control list for every session,
 *   per the NAP text ("which controls the shell supports").
 * - Retired session ids stay unusable for the window's lifetime; the set is
 *   dropped on `onWindowDestroyed` (no persistent-playback promotion here).
 * - Torrent durations are placeholders (one second per MiB of the image).
 */
import type { NappletMessage } from '@kehto/runtime';
import type { MediaAction, MediaMetadata, MediaSessionContext, MediaSourceRef, MediaState } from '@napplet/nap/media/types';
import { DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS, findLinuxDistro } from '../fixtures/linux-distros.js';

export type { MediaAction, MediaMetadata, MediaSessionContext, MediaSourceRef, MediaState };

/** NAP-MEDIA document checked for this mock (base contract). */
export const MEDIA_SPEC_REF: NapSpecRef = { nap: 'NAP-MEDIA', status: 'draft', source: 'pr', pr: 10, sha: '7806f4385302', path: 'naps/NAP-MEDIA.md' };

/** NAP-MEDIA torrent-source extension (PR #133) layered on top of `MEDIA_SPEC_REF`. */
export const MEDIA_TORRENT_SPEC_REF: NapSpecRef = { nap: 'NAP-MEDIA', status: 'draft', source: 'pr', pr: 133, sha: '8ea49c337cf3', path: 'naps/NAP-MEDIA.md' };

/** Every action a shell may expose (`media.controls`). */
export const MEDIA_SHELL_CONTROLS: readonly MediaAction[] = Object.freeze(['play', 'pause', 'stop', 'next', 'prev', 'seek', 'volume']);

/**
 * One placeholder track in the seeded playlist (Creative-Commons style metadata).
 *
 * @example
 * ```ts
 * const first = MOCK_MEDIA_PLAYLIST[0];
 * first.url.startsWith('https://media.example.org/');
 * ```
 */
export interface MockMediaTrack {
  /** Source URL (example.org placeholder). */
  url: string;
  /** Track title. */
  title: string;
  /** Artist name. */
  artist: string;
  /** Album name. */
  album: string;
  /** Duration in seconds. */
  duration: number;
  /** MIME type. */
  mimeType: string;
  /** Artwork URL (example.org placeholder). */
  artwork: string;
}

function track(slug: string, title: string, artist: string, album: string, duration: number): MockMediaTrack {
  return {
    url: `https://media.example.org/cc/${slug}.ogg`, title, artist, album, duration,
    mimeType: 'audio/ogg', artwork: `https://media.example.org/cc/${slug}.jpg`,
  };
}

/**
 * Seeded playlist of placeholder tracks; `next`/`prev` commands walk it.
 *
 * @example
 * ```ts
 * MOCK_MEDIA_PLAYLIST.length === 5;
 * ```
 */
export const MOCK_MEDIA_PLAYLIST: readonly MockMediaTrack[] = Object.freeze([
  track('morning-compile', 'Morning Compile', 'The Kernel Panics', 'Build Logs', 214),
  track('package-manager-blues', 'Package Manager Blues', 'Dependency Hell', 'Build Logs', 187),
  track('rolling-release', 'Rolling Release', 'Tumbleweed Trio', 'Mirror Sessions', 243),
  track('netinst', 'Netinst', 'Dave and the Release Notes', 'Mirror Sessions', 198),
  track('musl-lullaby', 'musl Lullaby', 'Alpine Choir', 'Edge Devices', 161),
]);

/** Torrent selector added by PR #133 (absent from nap 0.32.0 types). */
export interface MockMediaTorrentSource {
  /** Existing torrent job id; here a `LINUX_DISTROS` id. */
  jobId: string;
  /** Non-negative file index inside the job. */
  fileIndex: number;
}

/** `MediaSourceRef` plus the PR #133 `torrent` selector. */
export interface MockMediaSourceRef extends MediaSourceRef {
  /** Torrent job-file selector; exclusive of `url`, `blossomHash`, `nostr`. */
  torrent?: MockMediaTorrentSource;
}

/** `MediaState` plus the PR #10 transition `reason`. */
export interface MockMediaPlaybackState extends MediaState {
  /** Transition reason (`user`, `ended`, `focus-lost`, ...). */
  reason?: string;
}

/** A command as carried by `media.command`. */
export interface MockMediaCommand {
  /** Requested action. */
  action: MediaAction;
  /** Seek position (seconds) or volume (0..1). */
  value?: number;
  /** Explanatory cause; grants nothing. */
  reason?: string;
}

/** A torrent job the mock shell can resolve for `source.torrent`. */
export interface MockMediaTorrentJob {
  /** Job id (a `LINUX_DISTROS` id). */
  jobId: string;
  /** File name at index 0. */
  fileName: string;
  /** Whether verified metadata exists (`false` → `source not ready`). */
  ready: boolean;
  /** Whether file 0 is selected for download (`false` → `source blocked`). */
  selected: boolean;
  /** Placeholder duration in seconds. */
  duration: number;
}

/** One live media session. */
export interface MockMediaSession {
  /** Canonical session id. */
  sessionId: string;
  /** Owning window. */
  windowId: string;
  /** Playback owner. */
  owner: 'shell' | 'napplet';
  /** Metadata (merged by `media.session.update`). */
  metadata: MediaMetadata;
  /** Optional context. */
  context?: MediaSessionContext;
  /** Supported actions. */
  actions: MediaAction[];
  /** Latest playback state. */
  state: MockMediaPlaybackState;
  /** Source reference (shell-owned sessions). */
  source?: MockMediaSourceRef;
  /** Playlist index when the source url is a seeded track. */
  playlistIndex?: number;
  /** Bound torrent job id for torrent sources. */
  torrentJobId?: string;
  /** Live source flag. */
  live: boolean;
}

/** In-memory state of the media mock. */
export interface MockMediaState {
  /** Live sessions by canonical id. */
  sessions: Map<string, MockMediaSession>;
  /** Session ids ever issued per window (retired ids are never reused). */
  usedIds: Map<string, Set<string>>;
  /** Resolvable torrent jobs by id. */
  torrentJobs: Map<string, MockMediaTorrentJob>;
  /** Counter for generated session ids. */
  counter: number;
  /** Cancel function of the running `tickMs` loop, if any. */
  tickTimer?: () => void;
}

/**
 * Factory options for the media mock.
 *
 * @example
 * ```ts
 * const media = createMockMediaService({ tickMs: 250, autoplayPolicy: 'deny' });
 * ```
 */
export interface MockMediaOptions extends MockServiceOptions {
  /** Max sessions per window. Default 16. */
  maxSessionsPerWindow?: number;
  /** `deny` rejects `autoplay: true` with `autoplay denied`. Default `allow`. */
  autoplayPolicy?: 'allow' | 'deny';
  /** Advance playing sessions automatically every `tickMs` through the scheduler. */
  tickMs?: number;
  /** Overrides for seeded torrent jobs, keyed by job id. */
  torrentJobs?: Readonly<Record<string, Partial<MockMediaTorrentJob>>>;
}

/** Media mock plus playback controls. */
export type MockMediaService = MockService<MockMediaState> & {
  /** Advance every playing shell-owned session by `ms` and push `media.state`. */
  tick(ms: number): void;
  /** Act as the shell controller: command a session (either owner mode). */
  command(sessionId: string, command: MockMediaCommand): void;
  /** Retire a session with `media.session.ended` (`preempted`, `policy`, ...). */
  retire(sessionId: string, reason?: string): void;
  /** Remove a torrent job; dependent sessions end with `source-unavailable`. */
  removeTorrentJob(jobId: string): void;
};

const ACTIONS: readonly MediaAction[] = MEDIA_SHELL_CONTROLS;
const STATUSES = ['playing', 'paused', 'stopped', 'buffering'];

function normalizeActions(value: unknown): MediaAction[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is MediaAction => ACTIONS.includes(item)))] : [];
}

function validCommand(command: MockMediaCommand, actions: readonly MediaAction[]): boolean {
  if (!actions.includes(command.action)) return false;
  if (command.action !== 'seek' && command.action !== 'volume') return true;
  return typeof command.value === 'number' && Number.isFinite(command.value) && command.value >= 0 && (command.action !== 'volume' || command.value <= 1);
}

function seedTorrentJobs(overrides: MockMediaOptions['torrentJobs']): Map<string, MockMediaTorrentJob> {
  const jobs = new Map<string, MockMediaTorrentJob>();
  for (const image of LINUX_DISTROS) {
    jobs.set(image.id, {
      jobId: image.id, fileName: image.fileName, ready: true, selected: true,
      duration: Math.round(image.sizeBytes / (1024 * 1024)), ...overrides?.[image.id],
    });
  }
  return jobs;
}

interface Resolved { duration?: number; playlistIndex?: number; torrentJobId?: string; live: boolean; actions: MediaAction[] }

function resolveSource(state: MockMediaState, source: MockMediaSourceRef, live: boolean): Resolved | string {
  const forms = ['url', 'blossomHash', 'nostr', 'torrent'].filter((key) => source[key as keyof MockMediaSourceRef] !== undefined);
  if (forms.length === 0) return 'missing source';
  if (source.torrent !== undefined) {
    if (forms.length > 1 || live) return 'invalid source';
    const { jobId, fileIndex } = source.torrent;
    if (typeof jobId !== 'string' || !Number.isInteger(fileIndex) || fileIndex < 0) return 'invalid source';
    const job = state.torrentJobs.get(jobId);
    if (!job || !findLinuxDistro(jobId)) return 'source not found';
    if (fileIndex !== 0) return 'invalid source';
    if (!job.ready) return 'source not ready';
    if (!job.selected) return 'source blocked';
    return { duration: job.duration, torrentJobId: jobId, live: false, actions: ['play', 'pause', 'stop', 'seek', 'volume'] };
  }
  if (source.nostr !== undefined) return 'unsupported source';
  if (source.blossomHash !== undefined) {
    return /^[0-9a-f]{64}$/.test(source.blossomHash) ? { live, actions: live ? ['play', 'pause', 'stop', 'volume'] : ['play', 'pause', 'stop', 'seek', 'volume'] } : 'unsupported source';
  }
  if (typeof source.url !== 'string' || !source.url.startsWith('https://')) return 'source blocked';
  const playlistIndex = MOCK_MEDIA_PLAYLIST.findIndex((item) => item.url === source.url);
  const seekable: MediaAction[] = live ? ['play', 'pause', 'stop', 'volume'] : ['play', 'pause', 'stop', 'seek', 'volume'];
  if (playlistIndex < 0) return { live, actions: seekable };
  return { duration: MOCK_MEDIA_PLAYLIST[playlistIndex]!.duration, playlistIndex, live, actions: [...seekable, 'next', 'prev'] };
}

function canonicalId(state: MockMediaState, windowId: string, hint: unknown): string | undefined {
  if (hint !== undefined && (typeof hint !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(hint))) return undefined;
  const used = state.usedIds.get(windowId) ?? new Set<string>();
  state.usedIds.set(windowId, used);
  const taken = (id: string): boolean => [...state.usedIds.values()].some((set) => set.has(id));
  let id = hint as string | undefined;
  while (id === undefined || taken(id)) id = `media-${++state.counter}`;
  used.add(id);
  return id;
}

function stateEnvelope(session: MockMediaSession): NappletMessage {
  return { type: 'media.state', sessionId: session.sessionId, ...session.state } as NappletMessage;
}

type Ctx = MockRouteContext<MockMediaState>;

function createSession(ctx: Ctx, policy: MockMediaOptions): void {
  const { message, state, windowId, reply, fail, push } = ctx;
  const owner = message.owner;
  if (owner !== 'shell' && owner !== 'napplet') return fail('missing owner');
  const ownerField = { owner };
  const count = [...state.sessions.values()].filter((item) => item.windowId === windowId).length;
  if (count >= (policy.maxSessionsPerWindow ?? 16)) return fail('session limit exceeded', ownerField);
  const sessionId = canonicalId(state, windowId, message.sessionId);
  if (sessionId === undefined) return fail('invalid session ID', ownerField);
  const live = message.live === true;
  const session: MockMediaSession = {
    sessionId, windowId, owner, metadata: { ...(message.metadata as MediaMetadata | undefined) },
    ...(message.context ? { context: message.context as MediaSessionContext } : {}),
    actions: normalizeActions(message.capabilities), state: { status: 'stopped' }, live,
  };
  if (owner === 'shell') {
    const source = message.source as MockMediaSourceRef | undefined;
    const resolved = source && typeof source === 'object' ? resolveSource(state, source, live) : 'missing source';
    if (typeof resolved === 'string') return fail(resolved, ownerField);
    if (message.autoplay === true && policy.autoplayPolicy === 'deny') return fail('autoplay denied', ownerField);
    Object.assign(session, { source, playlistIndex: resolved.playlistIndex, torrentJobId: resolved.torrentJobId, actions: resolved.actions, live: resolved.live });
    if (resolved.playlistIndex !== undefined) {
      const item = MOCK_MEDIA_PLAYLIST[resolved.playlistIndex]!;
      session.metadata = { title: item.title, artist: item.artist, album: item.album, artwork: { url: item.artwork }, duration: item.duration, mediaType: 'audio', ...session.metadata };
    }
    session.state = { status: 'paused', position: 0, volume: 1, ...(resolved.duration !== undefined ? { duration: resolved.duration } : {}) };
  }
  state.sessions.set(sessionId, session);
  reply({ sessionId, owner });
  push({ type: 'media.controls', sessionId, controls: [...MEDIA_SHELL_CONTROLS] } as NappletMessage);
  if (owner !== 'shell') return;
  push({ type: 'media.capabilities', sessionId, actions: [...session.actions] } as NappletMessage);
  if (message.autoplay === true) {
    push({ type: 'media.state', sessionId, status: 'buffering' } as NappletMessage);
    session.state.status = 'playing';
  }
  push(stateEnvelope(session));
}

function applyShellCommand(session: MockMediaSession, command: MockMediaCommand, emit: (message: NappletMessage) => void): void {
  if (!validCommand(command, session.actions)) return;
  const playback = session.state;
  const buffering = session.torrentJobId !== undefined;
  const bufferAt = (position?: number): void => {
    if (buffering) emit({ type: 'media.state', sessionId: session.sessionId, status: 'buffering', ...(position !== undefined ? { position } : {}) } as NappletMessage);
  };
  switch (command.action) {
    case 'play': if (playback.status !== 'playing') { bufferAt(); playback.status = 'playing'; playback.reason = 'user'; } break;
    case 'pause': playback.status = 'paused'; playback.reason = 'user'; break;
    case 'stop': playback.status = 'stopped'; playback.position = 0; playback.reason = 'user'; break;
    case 'seek': {
      playback.position = Math.min(command.value ?? 0, playback.duration ?? Number.POSITIVE_INFINITY);
      delete playback.reason;
      bufferAt(playback.position);
      break;
    }
    case 'volume': playback.volume = command.value ?? 1; delete playback.reason; break;
    default: {
      if (session.playlistIndex === undefined) return;
      const size = MOCK_MEDIA_PLAYLIST.length;
      session.playlistIndex = (session.playlistIndex + (command.action === 'next' ? 1 : size - 1)) % size;
      const item = MOCK_MEDIA_PLAYLIST[session.playlistIndex]!;
      session.metadata = { ...session.metadata, title: item.title, artist: item.artist, album: item.album, artwork: { url: item.artwork }, duration: item.duration };
      playback.position = 0;
      playback.duration = item.duration;
      playback.reason = 'user';
    }
  }
  emit(stateEnvelope(session));
}

function napletState(ctx: Ctx, session: MockMediaSession): void {
  const report = ctx.message as { status?: unknown; position?: unknown; duration?: unknown; volume?: unknown; reason?: unknown };
  if (typeof report.status !== 'string' || !STATUSES.includes(report.status)) return;
  const next: MockMediaPlaybackState = { status: report.status as MediaState['status'] };
  for (const key of ['position', 'duration', 'volume'] as const) {
    const value = report[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && (key !== 'volume' || value <= 1)) next[key] = value;
  }
  if (typeof report.reason === 'string') next.reason = report.reason;
  session.state = next;
}

/**
 * Create the NAP-MEDIA mock: owner-bound sessions, shell-owned playback over
 * a seeded playlist or torrent job files, ordered retirement.
 *
 * @param options - Seed, clock, scheduler, policy knobs.
 * @returns A `media` service with `tick`, `command`, `retire`, `removeTorrentJob`.
 * @example
 * ```ts
 * const media = createMockMediaService();
 * media.handleMessage('w1', { type: 'media.session.create', id: 'm1', owner: 'shell', source: { url: MOCK_MEDIA_PLAYLIST[0].url }, autoplay: true }, send);
 * media.tick(5_000); // pushes media.state with position 5
 * ```
 */
export function createMockMediaService(options: MockMediaOptions = {}): MockMediaService {
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const mock = defineMockService<MockMediaState>({
    domain: 'media',
    version: '1.2.0',
    description: 'Mock NAP-MEDIA session registry and shell player',
    kind: 'service',
    initialState: () => ({ sessions: new Map(), usedIds: new Map(), torrentJobs: seedTorrentJobs(options.torrentJobs), counter: 0 }),
    routes: {
      'media.session.create': (ctx) => { createSession(ctx, options); startLoop(); },
      'media.session.update': ({ message, state, windowId }) => {
        const session = owned(state, windowId, message.sessionId);
        if (session && message.metadata && typeof message.metadata === 'object') session.metadata = { ...session.metadata, ...(message.metadata as MediaMetadata) };
      },
      'media.session.destroy': ({ message, state, windowId }) => { if (owned(state, windowId, message.sessionId)) retire(message.sessionId as string, 'destroyed'); },
      'media.state': (ctx) => { const session = owned(ctx.state, ctx.windowId, ctx.message.sessionId); if (session?.owner === 'napplet') napletState(ctx, session); },
      'media.capabilities': ({ message, state, windowId }) => {
        const session = owned(state, windowId, message.sessionId);
        if (session?.owner === 'napplet') session.actions = normalizeActions(message.actions);
      },
      'media.command': ({ message, state, windowId, push }) => {
        const session = owned(state, windowId, message.sessionId);
        if (session?.owner !== 'shell' || typeof message.action !== 'string') return;
        applyShellCommand(session, { action: message.action as MediaAction, value: message.value as number | undefined }, push);
        startLoop();
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const session of [...state.sessions.values()]) if (session.windowId === windowId) state.sessions.delete(session.sessionId);
      state.usedIds.delete(windowId);
      if (state.sessions.size === 0) stopLoop(state);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && capability !== 'media:control') return;
      for (const session of [...state.sessions.values()]) if (session.windowId === windowId) retire(session.sessionId, 'policy');
    },
  }, options);

  function owned(state: MockMediaState, windowId: string, sessionId: unknown): MockMediaSession | undefined {
    const session = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
    return session?.windowId === windowId ? session : undefined;
  }
  function retire(sessionId: string, reason: string): void {
    const state = mock.mock.state();
    const session = state.sessions.get(sessionId);
    if (!session) return;
    state.sessions.delete(sessionId);
    pushToWindow(mock, session.windowId, { type: 'media.session.ended', sessionId, reason } as NappletMessage);
    if (state.sessions.size === 0) stopLoop(state);
  }
  function tick(ms: number): void {
    for (const session of mock.mock.state().sessions.values()) {
      if (session.owner !== 'shell' || session.state.status !== 'playing') continue;
      const playback = session.state;
      playback.position = (playback.position ?? 0) + ms / 1000;
      delete playback.reason;
      if (playback.duration !== undefined && playback.position >= playback.duration) {
        playback.position = playback.duration;
        playback.status = 'stopped';
        playback.reason = 'ended';
      }
      pushToWindow(mock, session.windowId, stateEnvelope(session));
    }
  }
  function stopLoop(state: MockMediaState): void { state.tickTimer?.(); delete state.tickTimer; }
  function startLoop(): void {
    const state = mock.mock.state();
    if (options.tickMs === undefined || state.tickTimer) return;
    const playing = [...state.sessions.values()].some((item) => item.owner === 'shell' && item.state.status === 'playing');
    if (!playing) return;
    state.tickTimer = scheduler.schedule(options.tickMs, () => { delete state.tickTimer; tick(options.tickMs!); startLoop(); });
  }

  const baseReset = mock.mock.reset;
  mock.mock.reset = () => { stopLoop(mock.mock.state()); baseReset(); };
  return Object.assign(mock, {
    tick,
    command(sessionId: string, command: MockMediaCommand) {
      const session = mock.mock.state().sessions.get(sessionId);
      if (!session || !validCommand(command, session.actions)) return;
      if (session.owner === 'napplet') { pushToWindow(mock, session.windowId, { type: 'media.command', sessionId, ...command } as NappletMessage); return; }
      applyShellCommand(session, command, (message) => pushToWindow(mock, session.windowId, message));
      startLoop();
    },
    retire: (sessionId: string, reason = 'preempted') => retire(sessionId, reason),
    removeTorrentJob(jobId: string) {
      const state = mock.mock.state();
      state.torrentJobs.delete(jobId);
      for (const session of [...state.sessions.values()]) if (session.torrentJobId === jobId) retire(session.sessionId, 'source-unavailable');
    },
  });
}

/** Registry row for the media mock. */
export const MEDIA_MOCK_ENTRY: MockDomainEntry = { domain: 'media', kind: 'service', spec: MEDIA_SPEC_REF, create: (o) => createMockMediaService(o) };
