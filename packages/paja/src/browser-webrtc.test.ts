import type { EventTemplate, NostrEvent, WebrtcEvent } from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import { describe, expect, it, vi } from 'vitest';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import {
  createPajaAdapter,
  type PajaSignerProvider,
} from './browser-adapter.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';
import {
  createPajaWebrtcController,
  PAJA_WEBRTC_SIGNAL_KIND,
} from './browser-webrtc.js';

class MemorySignalRelay {
  readonly events: NostrEvent[] = [];
  private readonly listeners = new Set<(event: NostrEvent) => void>();

  subscribe(_filters: unknown, onEvent: (event: NostrEvent) => void): { close(): void } {
    this.listeners.add(onEvent);
    return { close: () => this.listeners.delete(onEvent) };
  }

  async publish(event: NostrEvent): Promise<void> {
    this.events.push(event);
    for (const listener of this.listeners) listener(event);
  }
}

class FakeDataChannel {
  readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  readyState: RTCDataChannelState = 'connecting';
  bufferedAmount = 0;
  counterpart: FakeDataChannel | null = null;
  closed = false;

  constructor(readonly label: string, readonly protocol: string) {}

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (event: MessageEvent) => void);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    if (this.readyState !== 'open' || !this.counterpart) throw new Error('channel closed');
    this.counterpart.dispatch('message', { data } as MessageEvent);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 'closed';
    this.dispatch('close', {} as MessageEvent);
    this.counterpart?.close();
  }

  open(): void {
    this.readyState = 'open';
    this.dispatch('open', {} as MessageEvent);
  }

  private dispatch(type: string, event: MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeRtcNetwork {
  readonly offers = new Map<string, FakePeerConnection>();
  readonly answers = new Map<string, FakePeerConnection>();
  nextId = 1;

  create(): RTCPeerConnection {
    return new FakePeerConnection(this) as unknown as RTCPeerConnection;
  }
}

class FakePeerConnection {
  readonly id: string;
  readonly listeners = new Map<string, Set<(event: Event | RTCDataChannelEvent) => void>>();
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  iceGatheringState: RTCIceGatheringState = 'complete';
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  channel: FakeDataChannel | null = null;
  remoteOfferId: string | null = null;

  constructor(private readonly network: FakeRtcNetwork) {
    this.id = `rtc-${network.nextId++}`;
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (event: Event | RTCDataChannelEvent) => void);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as (event: Event | RTCDataChannelEvent) => void);
  }

  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    this.channel = new FakeDataChannel(label, options?.protocol ?? '');
    return this.channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const sdp = `offer:${this.id}`;
    this.network.offers.set(this.id, this);
    return { type: 'offer', sdp };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.remoteOfferId) throw new Error('missing offer');
    this.network.answers.set(this.remoteOfferId, this);
    return { type: 'answer', sdp: `answer:${this.remoteOfferId}` };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = sessionDescription(description);
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = sessionDescription(description);
    if (description.type === 'offer') {
      this.remoteOfferId = description.sdp?.replace('offer:', '') ?? null;
      return;
    }
    const offerId = description.sdp?.replace('answer:', '') ?? '';
    const responder = this.network.answers.get(offerId);
    if (!responder || !this.channel) throw new Error('missing answer peer');
    const remote = new FakeDataChannel(this.channel.label, this.channel.protocol);
    this.channel.counterpart = remote;
    remote.counterpart = this.channel;
    responder.channel = remote;
    responder.dispatch('datachannel', { channel: remote } as unknown as RTCDataChannelEvent);
    this.signalingState = 'stable';
    this.connectionState = 'connected';
    responder.connectionState = 'connected';
    queueMicrotask(() => {
      this.channel?.open();
      remote.open();
    });
  }

  close(): void {
    if (this.connectionState === 'closed') return;
    this.connectionState = 'closed';
    this.channel?.close();
    this.dispatch('connectionstatechange', new Event('connectionstatechange'));
  }

  private dispatch(type: string, event: Event | RTCDataChannelEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function sessionDescription(value: RTCSessionDescriptionInit): RTCSessionDescription {
  return {
    type: value.type,
    sdp: value.sdp ?? '',
    toJSON: () => ({ type: value.type, sdp: value.sdp ?? '' }),
  } as RTCSessionDescription;
}

function signalingSigner(secret: Uint8Array): Signer {
  const pubkey = getPublicKey(secret);
  return {
    getPublicKey: () => pubkey,
    signEvent: async (template) => finalizeEvent(template as EventTemplate, secret) as NostrEvent,
    nip44: {
      encrypt: async (peer, plaintext) => nip44.encrypt(plaintext, nip44.getConversationKey(secret, peer)),
      decrypt: async (peer, ciphertext) => nip44.decrypt(ciphertext, nip44.getConversationKey(secret, peer)),
    },
  };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

describe('Paja browser WebRTC controller', () => {
  it('uses encrypted Nostr signaling and real data-channel payload delivery', async () => {
    const relay = new MemorySignalRelay();
    const network = new FakeRtcNetwork();
    const signerA = signalingSigner(new Uint8Array(32).fill(1));
    const signerB = signalingSigner(new Uint8Array(32).fill(2));
    const pubkeyA = await signerA.getPublicKey!();
    const pubkeyB = await signerB.getPublicKey!();
    const eventsA: WebrtcEvent[] = [];
    const eventsB: WebrtcEvent[] = [];
    const confirmA = vi.fn(async () => true);
    const confirmB = vi.fn(async () => true);
    const controllerA = createPajaWebrtcController({
      relay,
      getSigner: () => signerA,
      getPubkey: () => pubkeyA,
      getIdentity: () => ({ dTag: 'caller-a', aggregateHash: 'hash-a' }),
      confirm: confirmA,
      createPeerConnection: () => network.create(),
      crypto: globalThis.crypto,
    })!;
    const controllerB = createPajaWebrtcController({
      relay,
      getSigner: () => signerB,
      getPubkey: () => pubkeyB,
      getIdentity: () => ({ dTag: 'caller-b', aggregateHash: 'hash-b' }),
      confirm: confirmB,
      createPeerConnection: () => network.create(),
      crypto: globalThis.crypto,
    })!;

    expect(controllerA.refreshAvailability()).toBe(true);
    expect(controllerB.refreshAvailability()).toBe(true);
    const openedA = await controllerA.serviceOptions.open!({
      scope: { type: 'direct', pubkey: pubkeyB },
      channel: 'chat',
      protocol: 'chat:1',
    }, { windowId: 'window-a', emit: (event) => eventsA.push(event) });
    const openedB = await controllerB.serviceOptions.open!({
      scope: { type: 'direct', pubkey: pubkeyA },
      channel: 'chat',
      protocol: 'chat:1',
    }, { windowId: 'window-b', emit: (event) => eventsB.push(event) });
    await settle();

    expect(confirmA).toHaveBeenCalledWith(expect.objectContaining({ action: 'webrtc', windowId: 'window-a' }));
    expect(confirmB).toHaveBeenCalledWith(expect.objectContaining({ action: 'webrtc', windowId: 'window-b' }));
    expect(eventsA).toContainEqual({ type: 'state', sessionId: openedA.session.id, state: 'open' });
    expect(eventsB).toContainEqual({ type: 'state', sessionId: openedB.session.id, state: 'open' });
    expect(relay.events.every((event) => event.kind === PAJA_WEBRTC_SIGNAL_KIND)).toBe(true);
    expect(relay.events.filter((event) => ['offer', 'answer'].includes(event.tags[0]?.[1] ?? '')))
      .toSatisfy((events: NostrEvent[]) => events.every((event) => !event.content.includes('offer:')));

    controllerA.serviceOptions.send!(openedA.session.id, { body: 'hello over RTC' }, {
      windowId: 'window-a',
      emit: (event) => eventsA.push(event),
    });
    await settle();
    expect(eventsB).toContainEqual({
      type: 'message',
      sessionId: openedB.session.id,
      from: pubkeyA,
      payload: { body: 'hello over RTC' },
    });
    expect(eventsB.filter((event) => event.type === 'message')).toHaveLength(1);
    expect(relay.events.some((event) => event.content.includes('hello over RTC'))).toBe(false);

    await controllerA.serviceOptions.close!(openedA.session.id, 'done', { windowId: 'window-a', emit: () => {} });
    expect(eventsA).toContainEqual({ type: 'closed', sessionId: openedA.session.id, reason: 'done' });
  });

  it('fails closed without a NIP-44 signer or browser peer connection', () => {
    const relay = new MemorySignalRelay();
    const controller = createPajaWebrtcController({
      relay,
      getSigner: () => ({ getPublicKey: () => '1'.repeat(64), signEvent: async () => ({} as NostrEvent) }),
      getPubkey: () => '1'.repeat(64),
      getIdentity: () => ({ dTag: 'test', aggregateHash: 'hash' }),
      confirm: () => true,
      createPeerConnection: () => ({} as RTCPeerConnection),
      crypto: globalThis.crypto,
    });
    expect(controller).not.toBeNull();
    expect(controller!.refreshAvailability()).toBe(false);
  });

  it('advertises WebRTC only while a NIP-44 signer is connected', () => {
    vi.stubGlobal('RTCPeerConnection', class {});
    const listeners = new Set<() => void>();
    let signer: Signer | null = null;
    let pubkey: string | null = null;
    const signerProvider: PajaSignerProvider = {
      getSigner: () => signer,
      getMethod: () => signer ? 'dev' : 'none',
      getPubkey: () => pubkey,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: ['wss://relay.example'] },
      upload: { mode: 'disabled' },
    });
    const environmentChanged = vi.fn();
    const adapter = createPajaAdapter(
      {
        version: 1,
        window: { id: 'window-a', dTag: 'caller', aggregateHash: 'hash' },
      } as PajaHostConfig,
      () => simulation,
      () => {},
      () => {},
      () => true,
      signerProvider,
      undefined,
      environmentChanged,
    );

    expect(adapter.services?.webrtc).toBeUndefined();
    expect(adapter.webrtc?.isAvailable()).toBe(false);

    signer = signalingSigner(new Uint8Array(32).fill(3));
    pubkey = getPublicKey(new Uint8Array(32).fill(3));
    for (const listener of listeners) listener();
    expect(adapter.services?.webrtc?.descriptor.name).toBe('webrtc');
    expect(adapter.webrtc?.isAvailable()).toBe(true);
    expect(environmentChanged).toHaveBeenCalledTimes(1);

    signer = null;
    pubkey = null;
    for (const listener of listeners) listener();
    expect(adapter.services?.webrtc).toBeUndefined();
    expect(adapter.webrtc?.isAvailable()).toBe(false);
    expect(environmentChanged).toHaveBeenCalledTimes(2);

    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
    vi.unstubAllGlobals();
  });
});
