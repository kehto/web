/**
 * domains/webrtc.ts — Mock NAP-WEBRTC service.
 *
 * Spec: naps/NAP-WEBRTC.md @ napplet/naps PR #59 head 69523e8cf44c (draft)
 * Routes: webrtc.open, webrtc.send, webrtc.close
 * Pushes: webrtc.event (state, peer, message, closed)
 * Spec gaps / decisions:
 * - Each window is given a fixture identity (alice, bob, … in order of first
 *   `open`, overridable with `identities`). Two windows pair when one opens
 *   `direct` to the other's identity (both directions) or both join the same
 *   `room`. Offer/answer/ICE are relayed shell-internally and logged in
 *   `state.signals`; nothing raw reaches the wire.
 * - A session with no counterpart gets a loopback peer: with `autoAnswer`
 *   (default) one scheduler tick later, else when `peerAnswer(sessionId)` is
 *   called. The loopback peer echoes every `send` back as a `message` event.
 * - Error strings beyond the draft's list: `invalid request` (malformed
 *   open) and `session not open` (send while connecting).
 * - `webrtc.close` on an owned, already closed session succeeds; the closer
 *   receives no `closed` event (its own call ended the session).
 */
import type { NappletMessage } from '@kehto/runtime';
import type { WebrtcEvent, WebrtcScope, WebrtcSession } from '@napplet/nap/webrtc/types';
import { DEFAULT_SCHEDULER, defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import { mockPubkey } from '../core/rng.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_ACCOUNTS, type MockAccount } from '../fixtures/nostr.js';

/**
 * NAP-WEBRTC draft the mock implements.
 *
 * @example
 * ```ts
 * WEBRTC_SPEC_REF.pr === 59;
 * ```
 */
export const WEBRTC_SPEC_REF: NapSpecRef = {
  nap: 'NAP-WEBRTC',
  status: 'draft',
  source: 'pr',
  pr: 59,
  sha: '69523e8cf44c',
  path: 'naps/NAP-WEBRTC.md',
};

/**
 * Pubkey of the loopback peer used when no second window exists.
 *
 * @example
 * ```ts
 * MOCK_WEBRTC_LOOPBACK_PUBKEY.length === 64;
 * ```
 */
export const MOCK_WEBRTC_LOOPBACK_PUBKEY = mockPubkey('webrtc:loopback');

/**
 * One shell-internal signaling step (never exposed on the wire).
 *
 * @example
 * ```ts
 * service.mock.state().signals.map((s) => s.kind); // ['offer', 'answer', 'ice', 'ice']
 * ```
 */
export interface MockWebrtcSignal {
  /** Signal kind. */
  kind: 'offer' | 'answer' | 'ice';
  /** Session the signal belongs to. */
  sessionId: string;
  /** Sender pubkey. */
  from: string;
  /** Recipient pubkey. */
  to: string;
}

/**
 * One session record.
 *
 * @example
 * ```ts
 * const record = service.mock.state().sessions.get('sess-0123abcd');
 * record?.session.state;
 * ```
 */
export interface MockWebrtcSessionRecord {
  /** Wire session. */
  session: WebrtcSession;
  /** Owning window. */
  windowId: string;
  /** Owner's pubkey. */
  identity: string;
  /** Joined peer pubkeys. */
  peers: Set<string>;
  /** Session ids of paired windows. */
  partners: Set<string>;
  /** Whether the loopback peer answered. */
  loopback: boolean;
  /** Pending scheduler cancels. */
  timers: Set<() => void>;
}

/**
 * In-memory state of the mock WebRTC service.
 *
 * @example
 * ```ts
 * service.mock.state().identities.get('win-1'); // alice's pubkey
 * ```
 */
export interface MockWebrtcState {
  /** Window → pubkey. */
  identities: Map<string, string>;
  /** Session id → record. */
  sessions: Map<string, MockWebrtcSessionRecord>;
  /** Shell-internal signaling log. */
  signals: MockWebrtcSignal[];
}

/**
 * Options for `createMockWebrtcService`.
 *
 * @example
 * ```ts
 * const webrtc = createMockWebrtcService({ autoAnswer: false });
 * ```
 */
export interface MockWebrtcOptions extends MockServiceOptions {
  /** Let a lone session be answered by the loopback peer after one tick. Default `true`. */
  autoAnswer?: boolean;
  /** Delay for loopback answers and echoes. Default 5. */
  tickMs?: number;
  /** Payload size ceiling in JSON characters. Default 65536. */
  maxPayloadBytes?: number;
  /** Fixed window → pubkey identities. */
  identities?: Record<string, string>;
}

/**
 * Mock WebRTC service with peer controls.
 *
 * @example
 * ```ts
 * const webrtc = createMockWebrtcService({ autoAnswer: false });
 * webrtc.peerAnswer('sess-0123abcd');
 * ```
 */
export type MockWebrtcService = MockService<MockWebrtcState> & {
  /** The remote side answers a connecting session; `false` when not connecting. */
  peerAnswer(sessionId: string): boolean;
  /** Deliver a peer payload to an open session. */
  peerMessage(sessionId: string, payload: unknown, from?: string): boolean;
  /** The remote side leaves: peer `left` then `closed`. */
  peerLeave(sessionId: string, reason?: string): boolean;
};

type Context = MockRouteContext<MockWebrtcState>;
type Emit = (record: MockWebrtcSessionRecord, event: WebrtcEvent) => void;

function signal(state: MockWebrtcState, kind: MockWebrtcSignal['kind'], sessionId: string, from: string, to: string): void {
  state.signals.push({ kind, sessionId, from, to });
}

/** A peer joined: open the session on first join, then announce the peer. */
function join(emit: Emit, record: MockWebrtcSessionRecord, peer: string): void {
  record.peers.add(peer);
  if (record.session.state === 'connecting') {
    record.session.state = 'open';
    emit(record, { type: 'state', sessionId: record.session.id, state: 'open' });
  }
  emit(record, { type: 'peer', sessionId: record.session.id, pubkey: peer, state: 'joined' });
}

/** Relay offer/answer/ICE between two windows' sessions and open both. */
function pair(emit: Emit, state: MockWebrtcState, record: MockWebrtcSessionRecord, other: MockWebrtcSessionRecord): void {
  signal(state, 'offer', record.session.id, record.identity, other.identity);
  signal(state, 'answer', other.session.id, other.identity, record.identity);
  signal(state, 'ice', record.session.id, record.identity, other.identity);
  signal(state, 'ice', other.session.id, other.identity, record.identity);
  record.partners.add(other.session.id);
  other.partners.add(record.session.id);
  join(emit, other, record.identity);
  join(emit, record, other.identity);
}

/** The loopback peer answers a connecting session. */
function answerLoopback(emit: Emit, state: MockWebrtcState, record: MockWebrtcSessionRecord): void {
  const sessionId = record.session.id;
  const peer = record.session.scope.type === 'direct' ? record.session.scope.pubkey : MOCK_WEBRTC_LOOPBACK_PUBKEY;
  signal(state, 'offer', sessionId, record.identity, peer);
  signal(state, 'answer', sessionId, peer, record.identity);
  signal(state, 'ice', sessionId, record.identity, peer);
  record.loopback = true;
  join(emit, record, peer);
}

/** Close a session, cancel its timers, and tell partners the peer left (direct partners close too). */
function closeRecord(emit: Emit, state: MockWebrtcState, record: MockWebrtcSessionRecord, reason: string, notifySelf: boolean): void {
  if (record.session.state === 'closed') return;
  record.session.state = 'closed';
  for (const cancel of record.timers) cancel();
  record.timers.clear();
  if (notifySelf) emit(record, { type: 'closed', sessionId: record.session.id, reason });
  for (const partnerId of record.partners) {
    const partner = state.sessions.get(partnerId);
    if (!partner || partner.session.state === 'closed') continue;
    partner.partners.delete(record.session.id);
    partner.peers.delete(record.identity);
    emit(partner, { type: 'peer', sessionId: partnerId, pubkey: record.identity, state: 'left' });
    if (partner.session.scope.type === 'direct') closeRecord(emit, state, partner, 'peer disconnected', true);
  }
  record.partners.clear();
}

function isScope(value: unknown): value is WebrtcScope {
  if (typeof value !== 'object' || value === null) return false;
  const scope = value as Record<string, unknown>;
  if (scope.type === 'direct') return typeof scope.pubkey === 'string' && scope.pubkey.length > 0;
  if (scope.type !== 'room' || typeof scope.room !== 'string' || scope.room.length === 0) return false;
  return scope.peers === undefined || (Array.isArray(scope.peers) && scope.peers.every((item) => typeof item === 'string'));
}

function identityFor(state: MockWebrtcState, windowId: string, fixed: Record<string, string> | undefined): string {
  const known = state.identities.get(windowId);
  if (known) return known;
  const pubkey = fixed?.[windowId] ?? (MOCK_ACCOUNTS[state.identities.size % MOCK_ACCOUNTS.length] as MockAccount).pubkey;
  state.identities.set(windowId, pubkey);
  return pubkey;
}

/** Sessions in other windows that this session should pair with. */
function counterparts(state: MockWebrtcState, record: MockWebrtcSessionRecord): MockWebrtcSessionRecord[] {
  const scope = record.session.scope;
  const out: MockWebrtcSessionRecord[] = [];
  for (const other of state.sessions.values()) {
    if (other.windowId === record.windowId || other.session.state === 'closed' || other.loopback) continue;
    const theirs = other.session.scope;
    if (scope.type === 'direct') {
      if (theirs.type === 'direct' && scope.pubkey === other.identity && theirs.pubkey === record.identity) out.push(other);
      continue;
    }
    if (theirs.type !== 'room' || theirs.room !== scope.room) continue;
    if (scope.peers && !scope.peers.includes(other.identity)) continue;
    if (theirs.peers && !theirs.peers.includes(record.identity)) continue;
    out.push(other);
  }
  return out;
}

/**
 * Create the mock NAP-WEBRTC service.
 *
 * @param options - Loopback behavior, limits and identities.
 * @returns A `ServiceHandler` for `runtime.registerService('webrtc', …)` with mock controls.
 * @example
 * ```ts
 * const webrtc = createMockWebrtcService();
 * webrtc.handleMessage('win-1', { type: 'webrtc.open', id: 'o1', request: { scope: { type: 'room', room: 'lab' } } }, console.log);
 * ```
 */
export function createMockWebrtcService(options: MockWebrtcOptions = {}): MockWebrtcService {
  const scheduler: MockScheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const tickMs = options.tickMs ?? 5;
  const autoAnswer = options.autoAnswer ?? true;
  const maxPayload = options.maxPayloadBytes ?? 65_536;

  const emit: Emit = (record, event) => {
    pushToWindow(service, record.windowId, { type: 'webrtc.event', event } as NappletMessage);
  };
  const later = (record: MockWebrtcSessionRecord, fn: () => void): void => {
    const cancel = scheduler.schedule(tickMs, () => { record.timers.delete(cancel); if (record.session.state !== 'closed') fn(); });
    record.timers.add(cancel);
  };
  const peerAnswer = (sessionId: string): boolean => {
    const state = base.mock.state();
    const record = state.sessions.get(sessionId);
    if (!record || record.session.state !== 'connecting') return false;
    answerLoopback(emit, state, record);
    return true;
  };
  const owned =(state: MockWebrtcState, windowId: string, sessionId: unknown): MockWebrtcSessionRecord | undefined => {
    const record = typeof sessionId === 'string' ? state.sessions.get(sessionId) : undefined;
    return record && record.windowId === windowId ? record : undefined;
  };

  const openRoute = ({ message, windowId, state, reply, fail, rng }: Context): void => {
    const request = message.request as Record<string, unknown> | undefined;
    if (typeof request !== 'object' || request === null) { fail('invalid request'); return; }
    if (typeof request.scope !== 'object' || request.scope === null) { fail('invalid request'); return; }
    if (!isScope(request.scope)) { fail('unsupported scope'); return; }
    if ((request.channel !== undefined && typeof request.channel !== 'string') || (request.protocol !== undefined && typeof request.protocol !== 'string')) { fail('invalid request'); return; }
    const scope = request.scope;
    const session: WebrtcSession = {
      id: `sess-${rng.hex(8)}`,
      scope: scope.type === 'direct' ? { type: 'direct', pubkey: scope.pubkey } : { type: 'room', room: scope.room, ...(scope.peers ? { peers: [...scope.peers] } : {}) },
      channel: typeof request.channel === 'string' ? request.channel : 'data',
      ...(typeof request.protocol === 'string' ? { protocol: request.protocol } : {}),
      state: 'connecting',
    };
    const record: MockWebrtcSessionRecord = {
      session, windowId, identity: identityFor(state, windowId, options.identities), peers: new Set(), partners: new Set(), loopback: false, timers: new Set(),
    };
    state.sessions.set(session.id, record);
    reply({ session: { ...session, scope: { ...session.scope } } });
    const others = counterparts(state, record);
    for (const other of others) pair(emit, state, record, other);
    if (others.length === 0 && autoAnswer) later(record, () => { peerAnswer(session.id); });
  };

  const sendRoute = ({ message, windowId, state, reply, fail }: Context): void => {
    const record = owned(state, windowId, message.sessionId);
    if (!record) { fail('session not found'); return; }
    if (record.session.state === 'closed') { fail('session closed'); return; }
    if (record.session.state === 'connecting') { fail('session not open'); return; }
    if (!Object.hasOwn(message, 'payload')) { fail('invalid request'); return; }
    const payload = message.payload;
    if ((JSON.stringify(payload) ?? '').length > maxPayload) { fail('payload too large'); return; }
    reply();
    for (const partnerId of record.partners) {
      const partner = state.sessions.get(partnerId);
      if (partner && partner.session.state === 'open') emit(partner, { type: 'message', sessionId: partnerId, from: record.identity, payload });
    }
    if (record.loopback) {
      const [peer] = record.peers;
      later(record, () => emit(record, { type: 'message', sessionId: record.session.id, from: peer ?? MOCK_WEBRTC_LOOPBACK_PUBKEY, payload }));
    }
  };

  const closeRoute = ({ message, windowId, state, reply, fail }: Context): void => {
    const record = owned(state, windowId, message.sessionId);
    if (!record) { fail('session not found'); return; }
    if (message.reason !== undefined && typeof message.reason !== 'string') { fail('invalid request'); return; }
    closeRecord(emit, state, record, typeof message.reason === 'string' ? message.reason : 'closed by napplet', false);
    reply();
  };

  const closeWindow = (state: MockWebrtcState, windowId: string, reason: string, notifySelf: boolean): void => {
    for (const record of state.sessions.values()) if (record.windowId === windowId) closeRecord(emit, state, record, reason, notifySelf);
  };

  const base = defineMockService<MockWebrtcState>({
    domain: 'webrtc',
    version: '1.0.0',
    description: 'Mock NAP-WEBRTC: shell-internal signaling between mock windows or a loopback peer',
    kind: 'service',
    initialState: () => ({ identities: new Map(), sessions: new Map(), signals: [] }),
    routes: { 'webrtc.open': openRoute, 'webrtc.send': sendRoute, 'webrtc.close': closeRoute },
    onWindowDestroyed: (windowId, state) => {
      closeWindow(state, windowId, 'endpoint destroyed', false);
      for (const [id, record] of state.sessions) if (record.windowId === windowId) state.sessions.delete(id);
      state.identities.delete(windowId);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null || capability.startsWith('webrtc')) closeWindow(state, windowId, 'policy denied', true);
    },
  }, options);

  const baseReset = base.mock.reset;
  base.mock.reset = () => {
    for (const record of base.mock.state().sessions.values()) for (const cancel of record.timers) cancel();
    baseReset();
  };

  const service: MockWebrtcService = Object.assign(base, {
    peerAnswer,
    peerMessage(sessionId: string, payload: unknown, from?: string): boolean {
      const record = base.mock.state().sessions.get(sessionId);
      if (!record || record.session.state !== 'open') return false;
      const [peer] = record.peers;
      emit(record, { type: 'message', sessionId, from: from ?? peer ?? MOCK_WEBRTC_LOOPBACK_PUBKEY, payload });
      return true;
    },
    peerLeave(sessionId: string, reason = 'peer disconnected'): boolean {
      const state = base.mock.state();
      const record = state.sessions.get(sessionId);
      if (!record || record.session.state !== 'open') return false;
      for (const peer of record.peers) emit(record, { type: 'peer', sessionId, pubkey: peer, state: 'left' });
      record.peers.clear();
      record.partners.clear();
      closeRecord(emit, state, record, reason, true);
      return true;
    },
  });
  return service;
}

/**
 * Registry row for the `webrtc` domain.
 *
 * @example
 * ```ts
 * WEBRTC_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'webrtc';
 * ```
 */
export const WEBRTC_MOCK_ENTRY: MockDomainEntry = {
  domain: 'webrtc',
  kind: 'service',
  spec: WEBRTC_SPEC_REF,
  create: (options) => createMockWebrtcService(options),
};
