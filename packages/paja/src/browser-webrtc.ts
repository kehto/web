import type {
  EventTemplate,
  NostrEvent,
  NostrFilter,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';
import type {
  WebrtcServiceContext,
  WebrtcServiceOptions,
} from '@kehto/services';
import type { Signer } from '@kehto/runtime';
import { verifyEvent } from 'nostr-tools/pure';
import type {
  PajaConfirmationHandler,
  PajaIdentityProvider,
} from './browser-adapter.js';

/** Ephemeral signaling kind proposed by the NIP-100 draft. */
export const PAJA_WEBRTC_SIGNAL_KIND = 25_050;
export const PAJA_WEBRTC_MAX_PAYLOAD_BYTES = 64 * 1024;
export const PAJA_WEBRTC_MAX_SESSIONS_PER_WINDOW = 4;
export const PAJA_WEBRTC_MAX_PEERS = 8;
const SIGNAL_MAX_AGE_SECONDS = 5 * 60;
const ICE_GATHER_TIMEOUT_MS = 8_000;
const BUFFERED_AMOUNT_LIMIT = 1024 * 1024;

interface PajaWebrtcRelay {
  subscribe(filters: NostrFilter[], onEvent: (event: NostrEvent) => void): { close(): void };
  publish(event: NostrEvent): Promise<void>;
}

/** Host dependencies for Paja's real Nostr-signaled WebRTC controller. */
export interface PajaWebrtcControllerOptions {
  readonly relay: PajaWebrtcRelay;
  readonly getSigner: () => Signer | null;
  readonly getPubkey: () => string | null;
  readonly getIdentity: PajaIdentityProvider;
  readonly confirm: PajaConfirmationHandler;
  readonly createPeerConnection?: () => RTCPeerConnection;
  readonly crypto?: Crypto;
}

/** Stateful WebRTC backend whose availability follows the active signer. */
export interface PajaWebrtcController {
  readonly serviceOptions: WebrtcServiceOptions;
  /** Re-evaluate signer support and close sessions if identity changed. */
  refreshAvailability(): boolean;
  /** Close all relay subscriptions, peer connections, and data channels. */
  dispose(): void;
}

interface SignalPayload {
  readonly version: 1;
  readonly signalId: string;
  readonly channel: string;
  readonly protocol?: string;
  readonly description: RTCSessionDescriptionInit;
}

interface PeerState {
  readonly pubkey: string;
  readonly connection: RTCPeerConnection;
  readonly signalId: string;
  channel: RTCDataChannel | null;
  joined: boolean;
}

interface SessionState {
  readonly id: string;
  readonly windowId: string;
  readonly request: WebrtcOpenRequest;
  readonly localPubkey: string;
  readonly channel: string;
  readonly protocol?: string;
  readonly roomHash?: string;
  readonly allowedPeers: Set<string> | null;
  readonly context: WebrtcServiceContext;
  readonly peers: Map<string, PeerState>;
  readonly acknowledgedPeers: Set<string>;
  readonly seenSignals: Set<string>;
  subscription: { close(): void } | null;
  state: 'connecting' | 'open' | 'closed';
  closing: boolean;
}

/**
 * Create Paja's browser-backed NAP-WEBRTC controller.
 *
 * The controller is unavailable unless WebRTC, secure randomness, a live
 * signaling relay, and a signer with NIP-44 are all present. Application
 * payloads travel only through RTCDataChannel; Nostr carries encrypted SDP.
 *
 * @param options - Browser, signer, consent, identity, and relay boundaries.
 * @returns Complete WebRTC service hooks, or null when the real backend is unavailable.
 */
export function createPajaWebrtcController(
  options: PajaWebrtcControllerOptions,
): PajaWebrtcController | null {
  const crypto = options.crypto ?? globalThis.crypto;
  const createPeerConnection = options.createPeerConnection ?? defaultPeerConnectionFactory();
  if (!crypto?.subtle || !createPeerConnection) return null;
  return new BrowserWebrtcController(options, crypto, createPeerConnection);
}

class BrowserWebrtcController implements PajaWebrtcController {
  private readonly sessions = new Map<string, SessionState>();
  private readonly encoder = new TextEncoder();
  private activePubkey: string | null = null;

  constructor(
    private readonly options: PajaWebrtcControllerOptions,
    private readonly crypto: Crypto,
    private readonly createPeerConnection: () => RTCPeerConnection,
  ) {}

  readonly serviceOptions: WebrtcServiceOptions = {
    open: (request, context) => this.open(request, context),
    send: (sessionId, payload, context) => this.send(sessionId, payload, context),
    close: (sessionId, reason, context) => this.close(sessionId, reason, context),
    destroyWindow: (windowId) => this.destroyWindow(windowId),
  };

  refreshAvailability(): boolean {
    const signer = this.options.getSigner();
    const nextPubkey = isSignalingSigner(signer) ? normalizePubkey(this.options.getPubkey()) : null;
    if (this.activePubkey !== nextPubkey) {
      this.dispose();
      this.activePubkey = nextPubkey;
    }
    return nextPubkey !== null;
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.closing = true;
      this.disposeSession(session, undefined, false);
    }
  }

  private async open(
    request: WebrtcOpenRequest,
    context: WebrtcServiceContext,
  ): Promise<WebrtcOpenResult> {
    if (!this.refreshAvailability()) throw new Error('signaling unavailable');
    validateOpenRequest(request);
    if (this.windowSessionCount(context.windowId) >= PAJA_WEBRTC_MAX_SESSIONS_PER_WINDOW) {
      throw new Error('session limit reached');
    }
    const signer = this.requireSigner();
    const localPubkey = normalizePubkey(await signer.getPublicKey!());
    if (!localPubkey || localPubkey !== normalizePubkey(this.options.getPubkey())) throw new Error('signaling unavailable');
    const identity = this.options.getIdentity(context.windowId);
    const allowed = await this.options.confirm({
      action: 'webrtc',
      windowId: context.windowId,
      napplet: identity,
      scope: describeScope(request),
      warning: 'WebRTC reveals network metadata to connected peers.',
    });
    if (!allowed) throw new Error('policy denied');

    const id = this.crypto.randomUUID();
    const channel = request.channel ?? 'default';
    const roomHash = request.scope.type === 'room' ? await hashRoom(this.crypto, request.scope.room) : undefined;
    const allowedPeers = request.scope.type === 'direct'
      ? new Set([normalizePubkey(request.scope.pubkey)!])
      : request.scope.peers && request.scope.peers.length > 0
        ? new Set(request.scope.peers.map((peer) => normalizePubkey(peer)!))
        : null;
    const session: SessionState = {
      id,
      windowId: context.windowId,
      request,
      localPubkey,
      channel,
      ...(request.protocol ? { protocol: request.protocol } : {}),
      ...(roomHash ? { roomHash } : {}),
      allowedPeers,
      context,
      peers: new Map(),
      acknowledgedPeers: new Set(),
      seenSignals: new Set(),
      subscription: null,
      state: 'connecting',
      closing: false,
    };
    this.sessions.set(id, session);
    try {
      session.subscription = this.options.relay.subscribe(signalFilters(session), (event) => {
        void this.handleSignal(session, event).catch(() => {
          // A remote peer cannot fail the host event loop with malformed signaling.
        });
      });
      await this.publishPresence(session, 'connect');
    } catch (cause) {
      this.disposeSession(session, undefined, false);
      throw cause;
    }
    return {
      session: {
        id,
        scope: request.scope,
        channel,
        ...(request.protocol ? { protocol: request.protocol } : {}),
        state: 'connecting',
      },
    };
  }

  private send(sessionId: string, payload: unknown, context: WebrtcServiceContext): void {
    const session = this.requireSession(sessionId, context.windowId);
    if (session.state === 'closed') throw new Error('session closed');
    const serialized = serializePayload(payload, this.encoder);
    const channels = [...session.peers.values()]
      .map((peer) => peer.channel)
      .filter((channel): channel is RTCDataChannel => channel?.readyState === 'open');
    if (channels.length === 0) throw new Error('peer unavailable');
    for (const channel of channels) {
      if (channel.bufferedAmount > BUFFERED_AMOUNT_LIMIT) throw new Error('peer unavailable');
      channel.send(serialized);
    }
  }

  private async close(
    sessionId: string,
    reason: string | undefined,
    context: WebrtcServiceContext,
  ): Promise<void> {
    const session = this.requireSession(sessionId, context.windowId);
    session.closing = true;
    try {
      await this.publishPresence(session, 'disconnect');
    } finally {
      this.disposeSession(session, reason, true);
    }
  }

  private destroyWindow(windowId: string): void {
    for (const session of this.sessions.values()) {
      if (session.windowId !== windowId) continue;
      session.closing = true;
      void this.publishPresence(session, 'disconnect').catch(() => {});
      this.disposeSession(session, undefined, false);
    }
  }

  private async handleSignal(session: SessionState, event: NostrEvent): Promise<void> {
    if (!this.acceptSignal(session, event)) return;
    const type = tagValue(event.tags, 'type');
    if (type === 'connect') {
      await this.handleConnect(session, event.pubkey);
      return;
    }
    if (type === 'disconnect') {
      this.removePeer(session, event.pubkey, true);
      return;
    }
    if (type !== 'offer' && type !== 'answer') return;
    const payload = await this.decryptSignal(session, event);
    if (!payload || payload.description.type !== type) return;
    if (type === 'offer') await this.acceptOffer(session, event.pubkey, payload);
    else await this.acceptAnswer(session, event.pubkey, payload);
  }

  private acceptSignal(session: SessionState, event: NostrEvent): boolean {
    if (session.state === 'closed' || event.kind !== PAJA_WEBRTC_SIGNAL_KIND || !verifyEvent(event)) return false;
    if (event.pubkey === session.localPubkey || session.seenSignals.has(event.id)) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - event.created_at) > SIGNAL_MAX_AGE_SECONDS) return false;
    if (!scopeAllowsPeer(session, event.pubkey)) return false;
    if (session.roomHash && tagValue(event.tags, 'r') !== session.roomHash) return false;
    const recipients = tagValues(event.tags, 'p');
    if (recipients.length > 0 && !recipients.includes(session.localPubkey)) return false;
    session.seenSignals.add(event.id);
    if (session.seenSignals.size > 256) session.seenSignals.delete(session.seenSignals.values().next().value!);
    return true;
  }

  private async handleConnect(session: SessionState, peerPubkey: string): Promise<void> {
    if (session.peers.has(peerPubkey) || session.peers.size >= PAJA_WEBRTC_MAX_PEERS) return;
    if (session.localPubkey < peerPubkey) {
      await this.createOffer(session, peerPubkey);
      return;
    }
    if (session.acknowledgedPeers.has(peerPubkey)) return;
    session.acknowledgedPeers.add(peerPubkey);
    await this.publishPresence(session, 'connect', peerPubkey);
  }

  private async createOffer(session: SessionState, peerPubkey: string): Promise<void> {
    const peer = this.createPeer(session, peerPubkey, this.crypto.randomUUID());
    const channel = peer.connection.createDataChannel(session.channel, {
      ...(session.protocol ? { protocol: session.protocol } : {}),
      ordered: true,
    });
    this.attachChannel(session, peer, channel);
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    await waitForIceGathering(peer.connection);
    if (!peer.connection.localDescription) throw new Error('peer unavailable');
    await this.publishDescription(session, peer, 'offer', peer.connection.localDescription);
  }

  private async acceptOffer(
    session: SessionState,
    peerPubkey: string,
    payload: SignalPayload,
  ): Promise<void> {
    if (session.peers.has(peerPubkey) || session.peers.size >= PAJA_WEBRTC_MAX_PEERS) return;
    const peer = this.createPeer(session, peerPubkey, payload.signalId);
    await peer.connection.setRemoteDescription(payload.description);
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    await waitForIceGathering(peer.connection);
    if (!peer.connection.localDescription) throw new Error('peer unavailable');
    await this.publishDescription(session, peer, 'answer', peer.connection.localDescription);
  }

  private async acceptAnswer(
    session: SessionState,
    peerPubkey: string,
    payload: SignalPayload,
  ): Promise<void> {
    const peer = session.peers.get(peerPubkey);
    if (!peer || peer.signalId !== payload.signalId || peer.connection.signalingState !== 'have-local-offer') return;
    await peer.connection.setRemoteDescription(payload.description);
  }

  private createPeer(session: SessionState, pubkey: string, signalId: string): PeerState {
    const connection = this.createPeerConnection();
    const peer: PeerState = { pubkey, connection, signalId, channel: null, joined: false };
    session.peers.set(pubkey, peer);
    connection.addEventListener('datachannel', (event) => {
      if (event.channel.label !== session.channel || event.channel.protocol !== (session.protocol ?? '')) {
        event.channel.close();
        return;
      }
      this.attachChannel(session, peer, event.channel);
    });
    connection.addEventListener('connectionstatechange', () => {
      if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
        this.removePeer(session, pubkey, true);
      }
    });
    return peer;
  }

  private attachChannel(session: SessionState, peer: PeerState, channel: RTCDataChannel): void {
    peer.channel = channel;
    channel.addEventListener('open', () => {
      if (session.state === 'closed' || peer.joined) return;
      peer.joined = true;
      this.emit(session, { type: 'peer', sessionId: session.id, pubkey: peer.pubkey, state: 'joined' });
      if (session.state !== 'open') {
        session.state = 'open';
        this.emit(session, { type: 'state', sessionId: session.id, state: 'open' });
      }
    });
    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || this.encoder.encode(event.data).byteLength > PAJA_WEBRTC_MAX_PAYLOAD_BYTES) return;
      try {
        const payload = JSON.parse(event.data) as unknown;
        this.emit(session, { type: 'message', sessionId: session.id, from: peer.pubkey, payload });
      } catch {
        // Malformed peer payloads never cross the NAP boundary.
      }
    });
    channel.addEventListener('close', () => this.removePeer(session, peer.pubkey, true));
  }

  private async publishPresence(
    session: SessionState,
    type: 'connect' | 'disconnect',
    recipient?: string,
  ): Promise<void> {
    const tags = [['type', type]];
    if (recipient) tags.push(['p', recipient]);
    else if (session.request.scope.type === 'direct') tags.push(['p', normalizePubkey(session.request.scope.pubkey)!]);
    else if (session.allowedPeers) {
      for (const peer of session.allowedPeers) tags.push(['p', peer]);
    }
    if (session.roomHash) tags.push(['r', session.roomHash]);
    await this.signAndPublish(session, tags, '');
  }

  private async publishDescription(
    session: SessionState,
    peer: PeerState,
    type: 'offer' | 'answer',
    description: RTCSessionDescription,
  ): Promise<void> {
    const signer = this.requireSessionSigner(session);
    const payload: SignalPayload = {
      version: 1,
      signalId: peer.signalId,
      channel: session.channel,
      ...(session.protocol ? { protocol: session.protocol } : {}),
      description: description.toJSON(),
    };
    const content = await signer.nip44!.encrypt(peer.pubkey, JSON.stringify(payload));
    const tags = [['type', type], ['p', peer.pubkey]];
    if (session.roomHash) tags.push(['r', session.roomHash]);
    await this.signAndPublish(session, tags, content);
  }

  private async signAndPublish(session: SessionState, tags: string[][], content: string): Promise<void> {
    const signer = this.requireSessionSigner(session);
    const event = await signer.signEvent!({
      kind: PAJA_WEBRTC_SIGNAL_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    } as EventTemplate);
    if (event.pubkey !== session.localPubkey || event.kind !== PAJA_WEBRTC_SIGNAL_KIND || !verifyEvent(event)) {
      throw new Error('signaling unavailable');
    }
    await this.options.relay.publish(event);
  }

  private async decryptSignal(session: SessionState, event: NostrEvent): Promise<SignalPayload | null> {
    try {
      const signer = this.requireSessionSigner(session);
      const plaintext = await signer.nip44!.decrypt(event.pubkey, event.content);
      const value = JSON.parse(plaintext) as unknown;
      if (!isSignalPayload(value, session)) return null;
      return value;
    } catch {
      return null;
    }
  }

  private requireSession(sessionId: string, windowId: string): SessionState {
    const session = this.sessions.get(sessionId);
    if (!session || session.windowId !== windowId) throw new Error('session not found');
    return session;
  }

  private requireSigner(): Required<Pick<Signer, 'getPublicKey' | 'signEvent' | 'nip44'>> & Signer {
    const signer = this.options.getSigner();
    if (!isSignalingSigner(signer)) throw new Error('signaling unavailable');
    return signer;
  }

  private requireSessionSigner(session: SessionState): ReturnType<BrowserWebrtcController['requireSigner']> {
    const signer = this.requireSigner();
    if (normalizePubkey(this.options.getPubkey()) !== session.localPubkey) throw new Error('signaling unavailable');
    return signer;
  }

  private removePeer(session: SessionState, pubkey: string, notify: boolean): void {
    const peer = session.peers.get(pubkey);
    if (!peer) return;
    session.peers.delete(pubkey);
    peer.channel?.close();
    peer.connection.close();
    if (notify && peer.joined) {
      this.emit(session, { type: 'peer', sessionId: session.id, pubkey, state: 'left' });
    }
    if (notify && !session.closing && session.request.scope.type === 'direct' && session.state !== 'closed') {
      this.disposeSession(session, 'peer disconnected', true);
    }
  }

  private disposeSession(session: SessionState, reason: string | undefined, notify: boolean): void {
    if (session.state === 'closed') return;
    session.state = 'closed';
    this.sessions.delete(session.id);
    session.subscription?.close();
    session.subscription = null;
    for (const peer of session.peers.values()) {
      peer.channel?.close();
      peer.connection.close();
    }
    session.peers.clear();
    if (notify) {
      this.emit(session, { type: 'state', sessionId: session.id, state: 'closed' });
      this.emit(session, { type: 'closed', sessionId: session.id, ...(reason ? { reason } : {}) });
    }
  }

  private emit(session: SessionState, event: WebrtcEvent): void {
    if (session.state !== 'closed' || event.type === 'closed' || event.type === 'state') session.context.emit(event);
  }

  private windowSessionCount(windowId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) if (session.windowId === windowId) count += 1;
    return count;
  }
}

function validateOpenRequest(request: WebrtcOpenRequest): void {
  if (!request || typeof request !== 'object' || !request.scope || typeof request.scope !== 'object') {
    throw new Error('unsupported scope');
  }
  if (request.scope.type === 'direct') {
    if (!normalizePubkey(request.scope.pubkey)) throw new Error('unsupported scope');
  } else if (request.scope.type === 'room') {
    if (typeof request.scope.room !== 'string' || request.scope.room.length < 8 || request.scope.room.length > 128) {
      throw new Error('unsupported scope');
    }
    if (request.scope.peers && (
      request.scope.peers.length > PAJA_WEBRTC_MAX_PEERS
      || request.scope.peers.some((peer) => !normalizePubkey(peer))
    )) throw new Error('unsupported scope');
  } else {
    throw new Error('unsupported scope');
  }
  if (request.channel !== undefined && (request.channel.length < 1 || request.channel.length > 64)) {
    throw new Error('unsupported channel');
  }
  if (request.protocol !== undefined && request.protocol.length > 64) throw new Error('unsupported protocol');
}

function signalFilters(session: SessionState): NostrFilter[] {
  const base = { kinds: [PAJA_WEBRTC_SIGNAL_KIND], since: Math.floor(Date.now() / 1000) - 60 };
  return session.roomHash
    ? [{ ...base, '#r': [session.roomHash] } as NostrFilter]
    : [{ ...base, '#p': [session.localPubkey] } as NostrFilter];
}

function scopeAllowsPeer(session: SessionState, pubkey: string): boolean {
  return normalizePubkey(pubkey) !== null
    && pubkey !== session.localPubkey
    && (session.allowedPeers === null || session.allowedPeers.has(pubkey));
}

function isSignalPayload(value: unknown, session: SessionState): value is SignalPayload {
  if (!isRecord(value) || value.version !== 1 || typeof value.signalId !== 'string') return false;
  if (value.channel !== session.channel || value.protocol !== session.protocol || !isRecord(value.description)) return false;
  return (value.description.type === 'offer' || value.description.type === 'answer')
    && typeof value.description.sdp === 'string';
}

function isSignalingSigner(
  signer: Signer | null,
): signer is Required<Pick<Signer, 'getPublicKey' | 'signEvent' | 'nip44'>> & Signer {
  return typeof signer?.getPublicKey === 'function'
    && typeof signer.signEvent === 'function'
    && typeof signer.nip44?.encrypt === 'function'
    && typeof signer.nip44.decrypt === 'function';
}

function normalizePubkey(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value) ? value.toLowerCase() : null;
}

function describeScope(request: WebrtcOpenRequest): string {
  return request.scope.type === 'direct'
    ? `direct peer ${request.scope.pubkey}`
    : `room ${request.scope.room} with ${request.scope.peers?.length ?? 'discovered'} peers`;
}

function serializePayload(payload: unknown, encoder: TextEncoder): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error('payload is not JSON-serializable');
  }
  if (serialized === undefined) throw new Error('payload is not JSON-serializable');
  if (encoder.encode(serialized).byteLength > PAJA_WEBRTC_MAX_PAYLOAD_BYTES) throw new Error('payload too large');
  return serialized;
}

async function hashRoom(crypto: Crypto, room: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(room));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name && typeof tag[1] === 'string').map((tag) => tag[1]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultPeerConnectionFactory(): (() => RTCPeerConnection) | null {
  return typeof globalThis.RTCPeerConnection === 'function'
    ? () => new globalThis.RTCPeerConnection()
    : null;
}

function waitForIceGathering(connection: RTCPeerConnection): Promise<void> {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(finish, ICE_GATHER_TIMEOUT_MS);
    function finish(): void {
      clearTimeout(timeout);
      connection.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    function check(): void {
      if (connection.iceGatheringState === 'complete') finish();
    }
    connection.addEventListener('icegatheringstatechange', check);
  });
}
