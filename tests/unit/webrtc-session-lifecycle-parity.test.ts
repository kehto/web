/**
 * NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0e6294e1837733d2af61931e3e114bd97): the
 * reference WebRTC service and the `@kehto/mocks` WebRTC mock answer the same
 * session lifecycle the same way, so a napplet sees the same outcome whichever
 * one Paja or a test host wires in.
 *
 * - Error Handling: "The shell SHOULD send a webrtc.event with type: "closed"
 *   when an established session ends because a peer disconnects, ICE fails,
 *   signaling expires, or policy revokes the capability."
 * - Wire Protocol: the shell "MUST NOT deliver messages for an unknown
 *   `sessionId`". An ended session is unknown, so `send` and `close` on it
 *   answer `session not found`. The draft lists `session closed` too without
 *   saying when it applies; both implementations pick `session not found`.
 * - A napplet's own close gets its `webrtc.close.result` and no `closed` event
 *   (the draft's `closed` triggers don't include it).
 * - Byte payloads: `sendBytes` takes canonical padded base64 ("Receivers MUST
 *   reject non-canonical encodings"; both answer `invalid request`) and peer
 *   bytes arrive as a `bytes` event. Limits: `maxPayloadBytes` "counts decoded
 *   bytes for `sendBytes` and serialized payload bytes for `send`. A larger
 *   payload fails with "payload too large"."
 */
import { describe, expect, it } from 'vitest';
import type { NappletMessage, WebrtcEvent } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { createWebrtcService } from '../../packages/services/src/webrtc-service.js';
import { createMockWebrtcService, mockCanonicalBase64Length } from '../../packages/mocks/src/domains/webrtc.js';
import { decodeWebrtcBytes, encodeWebrtcBytes } from '../../packages/services/src/webrtc-bytes.js';

const WINDOW = 'win';
const PEER = '7'.repeat(64);
/** The mock's default `maxPayloadBytes`; the reference host reports the same. */
const MAX_PAYLOAD = 65_536;
const OVERSIZED_BYTES = encodeWebrtcBytes(new Uint8Array(MAX_PAYLOAD + 1));
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Napplet-visible outcome: the error text, `ok`, or the `closed` events (with reasons) the napplet received. */
type Outcome = string;

interface Host {
  /** Open a session and return its id. */
  open(): Promise<string>;
  /** Send one request and return its outcome. */
  call(message: Record<string, unknown>): Promise<Outcome>;
  /** The backend ends the session (the peer leaves). */
  peerLeaves(sessionId: string): void;
  /** Policy revokes the window's WebRTC capability. */
  revoke(): void;
  /** `closed` events received since the last call, as `closed:<reason>`. */
  closedEvents(): string[];
  /** The peer sends canonical bytes on the session. */
  peerBytes(sessionId: string, bytes: string): void;
  /** `bytes` events the napplet received, as `bytes:<base64>`. */
  bytesEvents(): string[];
}

function recorder() {
  const sent: NappletMessage[] = [];
  let seen = 0;
  const send = (message: NappletMessage): void => { sent.push(message); };
  const reply = (id: string): Outcome => {
    const result = sent.find((message) => (message as { id?: string }).id === id) as { error?: string } | undefined;
    return result ? result.error ?? 'ok' : 'no result';
  };
  const closedEvents = (): string[] => {
    const fresh = sent.slice(seen);
    seen = sent.length;
    return fresh.flatMap((message) => {
      const event = (message as { event?: { type: string; reason?: string } }).event;
      return message.type === 'webrtc.event' && event?.type === 'closed' ? [`closed:${event.reason ?? ''}`] : [];
    });
  };
  const bytesEvents = (): string[] => sent.flatMap((message) => {
    const event = (message as { event?: { type: string; bytes?: string } }).event;
    return message.type === 'webrtc.event' && event?.type === 'bytes' ? [`bytes:${event.bytes}`] : [];
  });
  return { sent, send, reply, closedEvents, bytesEvents };
}

function referenceHost(): Host {
  const approveAll = { authorizeOperation: async (_w: string, _o: string, _r: readonly unknown[], run: (signal: ApprovalSignal) => unknown) =>
    ({ status: 'executed' as const, value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext;
  const emits = new Map<string, (event: WebrtcEvent) => void>();
  let opened = 0;
  const service = createWebrtcService({
    planOpen: () => ({ signalingRelayUrls: [], iceEndpoints: [], resource: `peer:${PEER}` }),
    open: (request, context) => {
      opened += 1;
      const id = `session-${opened}`;
      emits.set(id, (event) => context.emit(event));
      return { session: { id, scope: request.scope, channel: 'data', state: 'open', maxPayloadBytes: MAX_PAYLOAD } };
    },
    send: () => undefined,
    sendBytes: () => undefined,
    close: () => undefined,
  });
  service.onRegistered?.(approveAll);
  const { sent, send, reply, closedEvents, bytesEvents } = recorder();
  return {
    async open() {
      const id = `open-${sent.length}`;
      service.handleMessage(WINDOW, { type: 'webrtc.open', id, request: { scope: { type: 'direct', pubkey: PEER } } } as NappletMessage, send);
      await flush();
      const result = sent.find((message) => (message as { id?: string }).id === id) as { session: { id: string } };
      return result.session.id;
    },
    async call(message) {
      service.handleMessage(WINDOW, message as NappletMessage, send);
      await flush();
      return reply(message.id as string);
    },
    peerLeaves(sessionId) {
      const emit = emits.get(sessionId)!;
      emit({ type: 'peer', sessionId, pubkey: PEER, state: 'left' });
      emit({ type: 'closed', sessionId, reason: 'peer disconnected' });
    },
    revoke() { service.onPermissionRevoked?.(WINDOW); },
    closedEvents,
    peerBytes(sessionId, bytes) { emits.get(sessionId)!({ type: 'bytes', sessionId, from: PEER, bytes }); },
    bytesEvents,
  };
}

function mockHost(): Host {
  // The mock's loopback peer echoes what the napplet sends one scheduler tick
  // later. The reference service has no loopback, so the echo is held back
  // (never scheduled) and only what a real peer sends is compared.
  const mock = createMockWebrtcService({ autoAnswer: false, scheduler: { schedule: () => () => undefined } });
  const { sent, send, reply, closedEvents, bytesEvents } = recorder();
  return {
    async open() {
      const id = `open-${sent.length}`;
      mock.handleMessage(WINDOW, { type: 'webrtc.open', id, request: { scope: { type: 'direct', pubkey: PEER } } } as unknown as NappletMessage, send);
      const result = sent.find((message) => (message as { id?: string }).id === id) as unknown as { session: { id: string } };
      mock.peerAnswer(result.session.id);
      return result.session.id;
    },
    async call(message) {
      mock.handleMessage(WINDOW, message as unknown as NappletMessage, send);
      await flush();
      return reply(message.id as string);
    },
    peerLeaves(sessionId) { mock.peerLeave(sessionId, 'peer disconnected'); },
    revoke() { mock.onPermissionRevoked?.(WINDOW); },
    closedEvents,
    peerBytes(sessionId, bytes) { mock.peerBytes(sessionId, bytes, PEER); },
    bytesEvents,
  };
}

/** One lifecycle, step by step. */
async function run(host: Host): Promise<Array<readonly [string, Outcome | string[]]>> {
  const rows: Array<readonly [string, Outcome | string[]]> = [];
  const step = async (label: string, message: Record<string, unknown>) => { rows.push([label, await host.call(message)]); };
  const events = (label: string) => { rows.push([label, host.closedEvents()]); };
  const send = (id: string, sessionId: string) => ({ type: 'webrtc.send', id, sessionId, payload: { n: 1 } });
  const close = (id: string, sessionId: string) => ({ type: 'webrtc.close', id, sessionId });
  const sendBytes = (id: string, sessionId: string, bytes = 'AAEC/w==') => ({ type: 'webrtc.sendBytes', id, sessionId, bytes });

  const first = await host.open();
  events('opening sends no closed');
  await step('send on an open session', send('a', first));
  await step('sendBytes on an open session', sendBytes('a1', first));
  await step('sendBytes of empty bytes', sendBytes('a2', first, ''));
  await step('sendBytes with non-zero pad bits', sendBytes('a3', first, 'AAEC/x=='));
  await step('sendBytes without padding', sendBytes('a4', first, 'AAEC/w'));
  await step('sendBytes over maxPayloadBytes', sendBytes('a5', first, OVERSIZED_BYTES));
  host.peerBytes(first, 'AAEC/w==');
  host.peerBytes(first, '');
  rows.push(['peer bytes', host.bytesEvents()]);
  host.peerLeaves(first);
  events('peer leaves');
  await step('send after the peer left', send('b', first));
  await step('sendBytes after the peer left', sendBytes('b1', first));
  await step('close after the peer left', close('c', first));

  const second = await host.open();
  await step('napplet close', close('d', second));
  events('napplet close sends no closed');
  await step('second close', close('e', second));
  await step('send after napplet close', send('f', second));
  await step('sendBytes after napplet close', sendBytes('f1', second));

  const third = await host.open();
  host.closedEvents();
  host.revoke();
  events('revocation');
  await step('send after revocation', send('g', third));
  await step('sendBytes after revocation', sendBytes('g1', third));
  await step('close after revocation', close('h', third));
  await step('send on a session never opened', send('i', 'no-such-session'));
  await step('sendBytes on a session never opened', sendBytes('j', 'no-such-session'));
  return rows;
}

describe('NAP-WEBRTC session lifecycle: services and mocks agree', () => {
  it('answers the same lifecycle with the same outcomes', async () => {
    const reference = await run(referenceHost());
    expect(reference).toEqual([
      ['opening sends no closed', []],
      ['send on an open session', 'ok'],
      ['sendBytes on an open session', 'ok'],
      ['sendBytes of empty bytes', 'ok'],
      ['sendBytes with non-zero pad bits', 'invalid request'],
      ['sendBytes without padding', 'invalid request'],
      ['sendBytes over maxPayloadBytes', 'payload too large'],
      ['peer bytes', ['bytes:AAEC/w==', 'bytes:']],
      ['peer leaves', ['closed:peer disconnected']],
      ['send after the peer left', 'session not found'],
      ['sendBytes after the peer left', 'session not found'],
      ['close after the peer left', 'session not found'],
      ['napplet close', 'ok'],
      ['napplet close sends no closed', []],
      ['second close', 'session not found'],
      ['send after napplet close', 'session not found'],
      ['sendBytes after napplet close', 'session not found'],
      ['revocation', ['closed:policy denied']],
      ['send after revocation', 'session not found'],
      ['sendBytes after revocation', 'session not found'],
      ['close after revocation', 'session not found'],
      ['send on a session never opened', 'session not found'],
      ['sendBytes on a session never opened', 'session not found'],
    ]);
    expect(await run(mockHost())).toEqual(reference);
  });
});

describe('NAP-WEBRTC WebrtcBytes: services and mocks judge canonical text alike', () => {
  const vectors: ReadonlyArray<readonly [unknown, number | undefined]> = [
    ['', 0], ['AAEC/w==', 4], ['/w==', 1], ['//8=', 2], ['////', 3],
    ['AAEC/x==', undefined], ['AAEC/w', undefined], ['AAEC /w==', undefined], ['AAEC/w==\n', undefined],
    ['AAEC_w==', undefined], ['-w==', undefined], ['data:application/octet-stream;base64,AAEC/w==', undefined],
    ['AA==AA==', undefined], [42, undefined],
  ];
  it.each(vectors)('%j', (text, length) => {
    expect(decodeWebrtcBytes(text)?.byteLength).toBe(length);
    expect(mockCanonicalBase64Length(text)).toBe(length);
  });
});
