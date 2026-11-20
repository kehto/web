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
 *
 * `sendBytes` is left out: the reference service answers it `unsupported`.
 */
import { describe, expect, it } from 'vitest';
import type { NappletMessage, WebrtcEvent } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { createWebrtcService } from '../../packages/services/src/webrtc-service.js';
import { createMockWebrtcService } from '../../packages/mocks/src/domains/webrtc.js';

const WINDOW = 'win';
const PEER = '7'.repeat(64);
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
  return { sent, send, reply, closedEvents };
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
      return { session: { id, scope: request.scope, channel: 'data', state: 'open' } };
    },
    send: () => undefined,
    close: () => undefined,
  });
  service.onRegistered?.(approveAll);
  const { sent, send, reply, closedEvents } = recorder();
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
  };
}

function mockHost(): Host {
  const mock = createMockWebrtcService({ autoAnswer: false });
  const { sent, send, reply, closedEvents } = recorder();
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
  };
}

/** One lifecycle, step by step. */
async function run(host: Host): Promise<Array<readonly [string, Outcome | string[]]>> {
  const rows: Array<readonly [string, Outcome | string[]]> = [];
  const step = async (label: string, message: Record<string, unknown>) => { rows.push([label, await host.call(message)]); };
  const events = (label: string) => { rows.push([label, host.closedEvents()]); };
  const send = (id: string, sessionId: string) => ({ type: 'webrtc.send', id, sessionId, payload: { n: 1 } });
  const close = (id: string, sessionId: string) => ({ type: 'webrtc.close', id, sessionId });

  const first = await host.open();
  events('opening sends no closed');
  await step('send on an open session', send('a', first));
  host.peerLeaves(first);
  events('peer leaves');
  await step('send after the peer left', send('b', first));
  await step('close after the peer left', close('c', first));

  const second = await host.open();
  await step('napplet close', close('d', second));
  events('napplet close sends no closed');
  await step('second close', close('e', second));
  await step('send after napplet close', send('f', second));

  const third = await host.open();
  host.closedEvents();
  host.revoke();
  events('revocation');
  await step('send after revocation', send('g', third));
  await step('close after revocation', close('h', third));
  await step('send on a session never opened', send('i', 'no-such-session'));
  return rows;
}

describe('NAP-WEBRTC session lifecycle: services and mocks agree', () => {
  it('answers the same lifecycle with the same outcomes', async () => {
    const reference = await run(referenceHost());
    expect(reference).toEqual([
      ['opening sends no closed', []],
      ['send on an open session', 'ok'],
      ['peer leaves', ['closed:peer disconnected']],
      ['send after the peer left', 'session not found'],
      ['close after the peer left', 'session not found'],
      ['napplet close', 'ok'],
      ['napplet close sends no closed', []],
      ['second close', 'session not found'],
      ['send after napplet close', 'session not found'],
      ['revocation', ['closed:policy denied']],
      ['send after revocation', 'session not found'],
      ['close after revocation', 'session not found'],
      ['send on a session never opened', 'session not found'],
    ]);
    expect(await run(mockHost())).toEqual(reference);
  });
});
