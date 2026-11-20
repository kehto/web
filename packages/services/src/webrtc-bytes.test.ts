/**
 * NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0e6294e1837733d2af61931e3e114bd97)
 * byte payloads in the reference service: canonical padded base64 on the
 * wire, decoded bytes to the host, `maxPayloadBytes` for both `send` and
 * `sendBytes`, and `unsupported` for hosts without byte transport.
 */
import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, WebrtcEvent, WebrtcOpenResult } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { decodeWebrtcBytes, encodeWebrtcBytes } from './webrtc-bytes.js';
import { createWebrtcService, type WebrtcServiceOptions } from './webrtc-service.js';

const WINDOW = 'win-bytes';
const PEER = '7'.repeat(64);
const SESSION = 'bytes-session';
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const approveAll = { authorizeOperation: async (_w: string, _o: string, _r: readonly unknown[], run: (signal: ApprovalSignal) => unknown) =>
  ({ status: 'executed' as const, value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext;

/** Canonical and non-canonical `WebrtcBytes` vectors: [label, text, decoded bytes or undefined]. */
const VECTORS: ReadonlyArray<readonly [string, unknown, number[] | undefined]> = [
  ['empty', '', []],
  ['the NAP example 00 01 02 ff', 'AAEC/w==', [0, 1, 2, 255]],
  ['one byte', '/w==', [255]],
  ['two bytes', '//8=', [255, 255]],
  ['three bytes, no padding', '////', [255, 255, 255]],
  ['non-zero pad bits', 'AAEC/x==', undefined],
  ['missing padding', 'AAEC/w', undefined],
  ['embedded whitespace', 'AAEC /w==', undefined],
  ['trailing newline', 'AAEC/w==\n', undefined],
  ['URL-safe alphabet', 'AAEC_w==', undefined],
  ['URL-safe minus', '-w==', undefined],
  ['data-URL prefix', 'data:application/octet-stream;base64,AAEC/w==', undefined],
  ['padding in the middle', 'AA==AA==', undefined],
  ['not text', 42, undefined],
];

describe('WebrtcBytes codec', () => {
  it.each(VECTORS)('%s', (_label, text, bytes) => {
    const decoded = decodeWebrtcBytes(text);
    expect(decoded === undefined ? undefined : [...decoded]).toEqual(bytes);
    if (bytes) expect(encodeWebrtcBytes(new Uint8Array(bytes))).toBe(text);
  });

  it('round-trips every byte value and payloads larger than one encode chunk', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect([...decodeWebrtcBytes(encodeWebrtcBytes(all))!]).toEqual([...all]);
    const large = Uint8Array.from({ length: 100_000 }, (_, index) => (index * 31) % 256);
    expect(decodeWebrtcBytes(encodeWebrtcBytes(large))).toEqual(large);
  });
});

async function openSession(options: Partial<WebrtcServiceOptions>, session: Partial<WebrtcOpenResult['session']> = {}) {
  let emit!: (event: WebrtcEvent) => void;
  const service = createWebrtcService({
    planOpen: () => ({ signalingRelayUrls: [], iceEndpoints: [], resource: `peer:${PEER}` }),
    open: (request, context) => {
      emit = (event) => context.emit(event);
      return { session: { id: SESSION, scope: request.scope, channel: 'data', state: 'open', ...session } };
    },
    send: () => undefined,
    close: () => undefined,
    ...options,
  });
  service.onRegistered?.(approveAll);
  const sent: NappletMessage[] = [];
  const send = (message: NappletMessage): void => { sent.push(message); };
  service.handleMessage(WINDOW, { type: 'webrtc.open', id: 'open', request: { scope: { type: 'direct', pubkey: PEER } } } as NappletMessage, send);
  await flush();
  sent.length = 0;
  const call = async (message: Record<string, unknown>) => {
    service.handleMessage(WINDOW, message as unknown as NappletMessage, send);
    await flush();
    return sent.find((entry) => (entry as { id?: string }).id === message.id);
  };
  return { service, sent, call, emit: (event: WebrtcEvent) => emit(event) };
}

describe('webrtc.sendBytes in createWebrtcService', () => {
  it('hands the host the decoded bytes, never the base64 text, and answers ok', async () => {
    const sendBytes = vi.fn();
    const { call } = await openSession({ sendBytes });
    expect(await call({ type: 'webrtc.sendBytes', id: 'b1', sessionId: SESSION, bytes: 'AAEC/w==' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'b1' });
    expect(sendBytes).toHaveBeenCalledTimes(1);
    const [sessionId, bytes, context] = sendBytes.mock.calls[0]!;
    expect(sessionId).toBe(SESSION);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([...bytes]).toEqual([0, 1, 2, 255]);
    expect(context.windowId).toBe(WINDOW);
  });

  it('sends empty bytes ("" is valid WebrtcBytes)', async () => {
    const sendBytes = vi.fn();
    const { call } = await openSession({ sendBytes });
    expect(await call({ type: 'webrtc.sendBytes', id: 'b0', sessionId: SESSION, bytes: '' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'b0' });
    expect(sendBytes.mock.calls[0]?.[1]).toEqual(new Uint8Array(0));
  });

  it('rejects non-canonical text before the host sees it', async () => {
    const sendBytes = vi.fn();
    const { call } = await openSession({ sendBytes });
    for (const [index, bytes] of ['AAEC/x==', 'AAEC/w', 'AAEC_w==', undefined].entries()) {
      expect(await call({ type: 'webrtc.sendBytes', id: `bad-${index}`, sessionId: SESSION, bytes })).toEqual({ type: 'webrtc.sendBytes.result', id: `bad-${index}`, error: 'invalid request' });
    }
    expect(sendBytes).not.toHaveBeenCalled();
  });

  it('enforces maxPayloadBytes on decoded bytes for sendBytes', async () => {
    const sendBytes = vi.fn();
    const send = vi.fn();
    const { call } = await openSession({ sendBytes, send }, { maxPayloadBytes: 4 });
    expect(await call({ type: 'webrtc.sendBytes', id: 'fits', sessionId: SESSION, bytes: 'AAEC/w==' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'fits' });
    expect(await call({ type: 'webrtc.sendBytes', id: 'over', sessionId: SESSION, bytes: encodeWebrtcBytes(new Uint8Array(5)) }))
      .toEqual({ type: 'webrtc.sendBytes.result', id: 'over', error: 'payload too large' });
    expect(sendBytes).toHaveBeenCalledTimes(1);
  });

  it('leaves payload size to the host when the session reports no maxPayloadBytes', async () => {
    const sendBytes = vi.fn();
    const { call } = await openSession({ sendBytes });
    expect(await call({ type: 'webrtc.sendBytes', id: 'big', sessionId: SESSION, bytes: encodeWebrtcBytes(new Uint8Array(70_000)) })).toEqual({ type: 'webrtc.sendBytes.result', id: 'big' });
  });

  it('answers session not found for an unknown session and reports host failures', async () => {
    const { call } = await openSession({ sendBytes: () => { throw new Error('peer unavailable'); } });
    expect(await call({ type: 'webrtc.sendBytes', id: 'unknown', sessionId: 'nope', bytes: '' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'unknown', error: 'session not found' });
    expect(await call({ type: 'webrtc.sendBytes', id: 'fails', sessionId: SESSION, bytes: '' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'fails', error: 'peer unavailable' });
  });

  it('answers unsupported without a sendBytes hook, even for an open session', async () => {
    const { call } = await openSession({});
    expect(await call({ type: 'webrtc.sendBytes', id: 'u', sessionId: SESSION, bytes: 'AAEC/w==' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'u', error: 'unsupported' });
  });

  it('delivers canonical peer bytes as a bytes event and drops non-canonical ones', async () => {
    const { sent, emit } = await openSession({ sendBytes: vi.fn() });
    emit({ type: 'bytes', sessionId: SESSION, from: PEER, bytes: 'AAEC/w==' });
    emit({ type: 'bytes', sessionId: SESSION, from: PEER, bytes: 'AAEC/x==' });
    emit({ type: 'bytes', sessionId: SESSION, from: PEER, bytes: '' });
    expect(sent).toEqual([
      { type: 'webrtc.event', event: { type: 'bytes', sessionId: SESSION, from: PEER, bytes: 'AAEC/w==' } },
      { type: 'webrtc.event', event: { type: 'bytes', sessionId: SESSION, from: PEER, bytes: '' } },
    ]);
  });
});
