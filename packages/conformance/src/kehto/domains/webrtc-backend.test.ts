/**
 * The Kehto target's NAP-WEBRTC backend supports byte payloads, so the
 * fixture's `webrtc/sendBytes` case takes the success path on this target
 * (NAP-WEBRTC #59 @ fb4dd6f0e6294e1837733d2af61931e3e114bd97, Byte payloads).
 */
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { describe, expect, it } from 'vitest';
import { WEBRTC_BACKEND } from './webrtc.js';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('WebRTC conformance backend', () => {
  it('sends canonical bytes as decoded bytes and rejects non-canonical text', async () => {
    // The WebRTC backend reads nothing from its context.
    const backend = WEBRTC_BACKEND.create({} as Parameters<typeof WEBRTC_BACKEND.create>[0]);
    const service = backend.services!.webrtc!;
    service.onRegistered?.({ authorizeOperation: async (_w: string, _o: string, _r: readonly unknown[], run: (signal: ApprovalSignal) => unknown) =>
      ({ status: 'executed' as const, value: await run(new AbortController().signal) }) } as unknown as ServiceRuntimeContext);
    const sent: NappletMessage[] = [];
    const call = async (message: Record<string, unknown>) => {
      service.handleMessage('w1', message as unknown as NappletMessage, (reply) => sent.push(reply));
      await flush();
      return sent.find((reply) => (reply as { id?: string }).id === message.id);
    };
    const opened = await call({ type: 'webrtc.open', id: 'o', request: { scope: { type: 'room', room: 'conformance-room' }, channel: 'state' } }) as unknown as { session: { id: string } };
    expect(await call({ type: 'webrtc.sendBytes', id: 'b', sessionId: opened.session.id, bytes: 'AAEC/w==' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'b' });
    expect(await call({ type: 'webrtc.sendBytes', id: 'x', sessionId: opened.session.id, bytes: 'AAEC/x==' })).toEqual({ type: 'webrtc.sendBytes.result', id: 'x', error: 'invalid request' });
    const controls = backend.controls as Record<string, (payload?: unknown) => unknown>;
    expect(controls['webrtc.sent']!()).toEqual([{ sessionId: opened.session.id, bytes: 'AAEC/w==' }]);
  });
});
