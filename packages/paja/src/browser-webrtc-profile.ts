/** Explicit soy-rtc/1 interoperability profile. Provider selection belongs to host configuration. */
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import type { NostrEvent, WebrtcEvent, WebrtcOpenRequest, WebrtcOpenResult } from '@napplet/core';
import type { WebrtcServiceContext, WebrtcServiceOptions } from '@kehto/services';
import type { PajaWebrtcControllerOptions } from './browser-webrtc.js';

const PROFILE = 'soy-rtc/1';
const encoder = new TextEncoder();
const HEX = /^[0-9a-f]{64}$/u;
const MAX_BYTES = 16_384;
type Peer = {
  key: string; nonce: string; pc: RTCPeerConnection; channel?: RTCDataChannel;
  joined: boolean; chain: Promise<void>; queued: number; started: number;
  offer?: string; answer?: string;
};
type Session = {
  id: string; wire: string; nonce: string; request: WebrtcOpenRequest; channel: string;
  context: WebrtcServiceContext; peers: Map<string, Peer>; retired: Set<string>; seen: Set<string>;
  closeSubscription(): void; timer?: ReturnType<typeof setInterval>; open: boolean;
  signalWindow: number; signals: number;
};

/** Host-private inputs; the secret key is shared only with this window's CVM transport. */
export interface PajaWebrtcProfileOptions {
  secretKey: Uint8Array;
  namespace: string;
  relays: readonly string[];
  relay: PajaWebrtcControllerOptions['relay'];
  isCurrent(): boolean;
  /** Declared endpoints are approved by the service before this factory is used. */
  iceEndpoints?: readonly string[];
  createPeer?: () => RTCPeerConnection;
}

function validate(request: WebrtcOpenRequest): void {
  if (!request?.scope || !['room', 'direct'].includes(request.scope.type)) throw new Error('Invalid WebRTC scope');
  if (request.scope.type === 'room') {
    if (typeof request.scope.room !== 'string' || !request.scope.room || request.scope.room.length > 256) throw new Error('Invalid room');
    if (request.scope.peers && (!Array.isArray(request.scope.peers) || request.scope.peers.length > 8 || request.scope.peers.some(key => !HEX.test(key)))) throw new Error('Invalid peers');
  } else if (!HEX.test(request.scope.pubkey)) throw new Error('Invalid peer');
  if (request.channel !== undefined && (typeof request.channel !== 'string' || !request.channel || request.channel.length > 64)) throw new Error('Invalid channel');
  if (request.protocol !== undefined && (typeof request.protocol !== 'string' || request.protocol.length > 128)) throw new Error('Invalid protocol');
}

function reliable(body: Record<string, unknown>): boolean {
  if (body.realtime === undefined) return true;
  const rt = body.realtime as Record<string, unknown> | null;
  return !!rt && rt.profile === 'soy-rtc/realtime-1' && rt.ordered === true && rt.maxRetransmits === null;
}

function gather(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', changed); resolve(); };
    const changed = () => { if (pc.iceGatheringState === 'complete' || pc.connectionState === 'closed') finish(); };
    const timer = setTimeout(finish, 8_000);
    pc.addEventListener('icegatheringstatechange', changed);
  });
}

/**
 * Build reliable JSON WebRTC hooks for the documented soy-rtc/1 host profile.
 * @param options - Explicit namespace, relays, isolated key and lifecycle guard.
 * @returns Service hooks; requested transient delivery falls back to reported reliable delivery.
 */
export function createPajaWebrtcProfile(options: PajaWebrtcProfileOptions): WebrtcServiceOptions {
  const self = getPublicKey(options.secretKey);
  const sessions = new Map<string, Session>();
  const openings = new Set<string>();
  const live = (s: Session) => sessions.get(s.id) === s && options.isCurrent() && !s.context.signal?.aborted;
  const emit = (s: Session, event: WebrtcEvent) => { if (live(s)) s.context.emit(event); };
  const removePeer = (s: Session, p: Peer) => {
    if (s.peers.get(p.key) !== p) return;
    s.peers.delete(p.key);
    if (p.joined) emit(s, { type: 'peer', sessionId: s.id, pubkey: p.key, state: 'left' });
    p.channel?.close(); p.pc.close();
  };
  const close = (s: Session, reason?: string) => {
    if (!sessions.has(s.id)) return;
    emit(s, { type: 'closed', sessionId: s.id, ...(reason ? { reason } : {}) });
    sessions.delete(s.id); clearInterval(s.timer); s.closeSubscription();
    for (const p of s.peers.values()) removePeer(s, p);
  };
  const activePeer = (s: Session, p: Peer) => live(s) && s.peers.get(p.key) === p;
  const publish = async (s: Session, body: Record<string, unknown>, recipient?: string) => {
    if (!live(s)) return;
    const raw = JSON.stringify({ v: PROFILE, wire: s.wire, nonce: s.nonce, ...body });
    const content = recipient ? nip44.encrypt(raw, nip44.getConversationKey(options.secretKey, recipient)) : raw;
    const now = Math.floor(Date.now() / 1000);
    const event = finalizeEvent({ kind: 25050, created_at: now, content,
      tags: [['d', s.wire], ['expiration', String(now + 60)], ...(recipient ? [['p', recipient]] : [])],
    }, options.secretKey);
    if (live(s)) await options.relay.publish(options.relays, event);
  };
  const attach = (s: Session, p: Peer, channel: RTCDataChannel) => {
    if (!activePeer(s, p) || p.channel || channel.label !== s.channel || channel.protocol !== ''
      || !channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) { channel.close(); return; }
    p.channel = channel;
    channel.addEventListener('open', () => {
      if (!activePeer(s, p) || p.joined) return;
      p.joined = true;
      emit(s, { type: 'peer', sessionId: s.id, pubkey: p.key, state: 'joined' });
      if (!s.open) { s.open = true; emit(s, { type: 'state', sessionId: s.id, state: 'open' }); }
    });
    let received = 0, bytes = 0, since = Date.now();
    channel.addEventListener('message', event => {
      if (!activePeer(s, p) || !p.joined || typeof event.data !== 'string') return;
      const size = encoder.encode(event.data).length;
      if (Date.now() - since > 1000) { since = Date.now(); received = 0; bytes = 0; }
      if (size > MAX_BYTES || ++received > 240 || (bytes += size) > 524288) return;
      try { emit(s, { type: 'message', sessionId: s.id, from: p.key, payload: JSON.parse(event.data) }); } catch { /* Drop malformed peer data. */ }
    });
    channel.addEventListener('close', () => removePeer(s, p));
  };
  const queue = (s: Session, p: Peer, action: () => Promise<void>) => {
    if (p.queued >= 4) return;
    p.queued++;
    p.chain = p.chain.then(async () => { if (activePeer(s, p)) await action(); })
      .catch(() => removePeer(s, p)).finally(() => { p.queued--; });
  };
  const receive = async (s: Session, event: NostrEvent) => {
    if (!live(s)) return;
    if (Date.now() - s.signalWindow > 1000) { s.signalWindow = Date.now(); s.signals = 0; }
    if (++s.signals > 32 || event.kind !== 25050 || event.pubkey === self || event.content.length > 64000
      || Math.abs(Date.now() / 1000 - event.created_at) > 60 || s.seen.has(event.id)
      || !event.tags.some(tag => tag[0] === 'd' && tag[1] === s.wire) || !verifyEvent(event)) return;
    const scope = s.request.scope;
    if (scope.type === 'direct' ? event.pubkey !== scope.pubkey : scope.peers && !scope.peers.includes(event.pubkey)) return;
    const recipient = event.tags.find(tag => tag[0] === 'p')?.[1];
    if (recipient && recipient !== self) return;
    if (s.seen.size >= 2048) s.seen.delete(s.seen.values().next().value!);
    s.seen.add(event.id);
    const raw = recipient ? nip44.decrypt(event.content, nip44.getConversationKey(options.secretKey, event.pubkey)) : event.content;
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || body.v !== PROFILE || body.wire !== s.wire || typeof body.nonce !== 'string' || !body.nonce || body.nonce.length > 64
      || s.retired.has(`${event.pubkey}:${body.nonce}`) || !reliable(body)) return;
    if (recipient ? body.to !== s.nonce || !['offer', 'answer'].includes(String(body.type)) : body.type !== 'hello') return;
    let peer = s.peers.get(event.pubkey);
    if (body.type === 'hello') {
      if (peer && peer.nonce !== body.nonce) {
        // Bound incarnation tracking; close rather than forgetting retired nonces.
        if (s.retired.size >= 256) { close(s, 'Peer incarnation limit reached'); return; }
        s.retired.add(`${peer.key}:${peer.nonce}`); removePeer(s, peer); peer = undefined;
      }
      if (peer || s.peers.size >= 8) return;
      const pc = options.createPeer?.() ?? new RTCPeerConnection({ iceServers: [] });
      const p: Peer = { key: event.pubkey, nonce: body.nonce, pc, joined: false, chain: Promise.resolve(), queued: 0, started: Date.now() };
      s.peers.set(p.key, p);
      pc.addEventListener('datachannel', e => attach(s, p, e.channel));
      pc.addEventListener('connectionstatechange', () => { if (['closed', 'failed'].includes(pc.connectionState)) removePeer(s, p); });
      void publish(s, { type: 'hello' }).catch(() => {});
      if (self < p.key) queue(s, p, async () => {
        attach(s, p, pc.createDataChannel(s.channel, { ordered: true }));
        await pc.setLocalDescription(await pc.createOffer()); await gather(pc);
        if (!activePeer(s, p)) return;
        p.offer = pc.localDescription!.sdp;
        await publish(s, { type: 'offer', to: p.nonce, sdp: p.offer }, p.key);
      });
      return;
    }
    if (!peer || body.nonce !== peer.nonce || typeof body.sdp !== 'string' || body.sdp.length > 32000) return;
    const p = peer, sdp = body.sdp;
    queue(s, p, async () => {
      if (body.type === 'offer' && p.key < self) {
        if (!p.answer) {
          await p.pc.setRemoteDescription({ type: 'offer', sdp });
          if (!activePeer(s, p)) return;
          await p.pc.setLocalDescription(await p.pc.createAnswer()); await gather(p.pc);
          if (!activePeer(s, p)) return;
          p.answer = p.pc.localDescription!.sdp;
        }
        await publish(s, { type: 'answer', to: p.nonce, sdp: p.answer }, p.key);
      } else if (body.type === 'answer' && self < p.key && !p.pc.remoteDescription) await p.pc.setRemoteDescription({ type: 'answer', sdp });
    });
  };
  const requireSession = (id: string, context: WebrtcServiceContext) => {
    const s = sessions.get(id);
    if (!s || s.context.windowId !== context.windowId || !live(s)) throw new Error('session not found');
    return s;
  };
  const start = (s: Session) => {
    try {
          if (!live(s)) { close(s); return; }
          const sub = options.relay.subscribe(options.relays, [{ kinds: [25050], '#d': [s.wire], since: Math.floor(Date.now() / 1000) - 10 }], event => { void receive(s, event).catch(() => {}); });
          s.closeSubscription = () => sub.close();
          const tick = () => {
            if (!live(s)) { close(s); return; }
            void publish(s, { type: 'hello' }).catch(() => {});
            for (const p of s.peers.values()) {
              if (!p.joined && Date.now() - p.started > 45000) { removePeer(s, p); continue; }
              if (p.offer && !p.pc.remoteDescription) void publish(s, { type: 'offer', to: p.nonce, sdp: p.offer }, p.key).catch(() => {});
            }
          };
          tick(); s.timer = setInterval(tick, 2000);
    } catch { close(s, 'Signaling unavailable'); }
  };
  const retire = () => { for (const s of sessions.values()) close(s); };
  return {
    planOpen(request) {
      validate(request);
      return { signalingRelayUrls: options.relays, iceEndpoints: options.iceEndpoints ?? [], resource: request.scope.type === 'room' ? `room:${request.scope.room}` : `peer:${request.scope.pubkey}` };
    },
    open: (request, context) => openProfileSession(options, self, sessions, openings, request, context, start, close),
    send(id, payload, context) {
      const s = requireSession(id, context), json = JSON.stringify(payload);
      if (json === undefined || encoder.encode(json).length > MAX_BYTES) throw new Error('Payload exceeds 16 KiB JSON limit');
      const channels = [...s.peers.values()].filter(p => p.joined && p.channel?.readyState === 'open').map(p => p.channel!);
      if (!channels.length) throw new Error('peer unavailable');
      if (channels.some(c => c.bufferedAmount + encoder.encode(json).length > 262144)) throw new Error('QUEUE_FULL');
      for (const channel of channels) channel.send(json);
    },
    close(id, reason, context) { close(requireSession(id, context), reason); },
    destroyWindow: retire, revokeWindow: retire,
  };
}

async function openProfileSession(options: PajaWebrtcProfileOptions, self: string,
  sessions: Map<string, Session>, openings: Set<string>, request: WebrtcOpenRequest,
  context: WebrtcServiceContext, start: (session: Session) => void, close: (session: Session) => void,
): Promise<WebrtcOpenResult> {
      validate(request);
      if (!options.namespace || !options.isCurrent() || context.signal?.aborted) throw new Error('Multiplayer namespace unavailable');
      if (sessions.size + openings.size >= 4) throw new Error('session limit reached');
      if (request.scope.type === 'direct' && request.scope.pubkey === self) throw new Error('Cannot connect to self');
      const channel = request.channel ?? 'napplet';
      const scope = request.scope.type === 'room' ? ['room', request.scope.room] : ['direct', ...[self, request.scope.pubkey].sort()];
      const identity = JSON.stringify([PROFILE, options.namespace, scope, channel, request.protocol ?? '']);
      if (openings.has(identity)) throw new Error('Scope is opening');
      openings.add(identity);
      try {
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(identity));
        const wire = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (!options.isCurrent() || context.signal?.aborted) throw new Error('policy denied');
        if ([...sessions.values()].some(s => s.wire === wire)) throw new Error('Scope already open');
        const s: Session = { id: crypto.randomUUID(), wire, nonce: crypto.randomUUID(), request, channel, context, peers: new Map(), retired: new Set(), seen: new Set(), closeSubscription() { /* Assigned when signaling starts. */ }, open: false, signalWindow: Date.now(), signals: 0 };
        sessions.set(s.id, s);
        context.signal?.addEventListener('abort', () => close(s), { once: true });
        // Start after the correlated open result; subsequent events belong to this session.
        setTimeout(() => start(s), 0);
        const session = { id: s.id, scope: request.scope, channel, ...(request.protocol ? { protocol: request.protocol } : {}), state: 'connecting' as const, ordered: true, maxPayloadBytes: MAX_BYTES };
        return { session };
      } finally { openings.delete(identity); }
}
