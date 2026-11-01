import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { CAPTURE_MOCK_ENTRY, CAPTURE_SPEC_REF, MOCK_CAPTURE_INFO, createMockCaptureService, selectCaptureMimeType } from './capture.js';

const START = 1_767_225_600_000;
const ROUTES = ['capture.info', 'capture.start', 'capture.status', 'capture.stop', 'capture.cancel', 'capture.release'];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;

function recording(options: Parameters<typeof createMockCaptureService>[0] = {}) {
  let now = START;
  const service = createMockCaptureService({ clock: { now: () => now }, ...options });
  const { sent, send } = sink();
  service.handleMessage('w1', msg({ type: 'capture.start', id: 's1', request: { source: 'microphone' } }), send);
  return { service, sent, send, advance: (ms: number) => { now += ms; } };
}

describe('createMockCaptureService', () => {
  it('describes the extension and publishes every route', () => {
    const service = createMockCaptureService();
    expect(service.descriptor).toEqual({ name: 'capture', version: '0.1.0', description: 'Mock NAP-CAPTURE microphone recordings' });
    expect(Object.keys(service.messageCapabilities!)).toEqual(ROUTES);
    expect(Object.values(service.messageCapabilities!)).toEqual(ROUTES.map(() => null));
    expect(CAPTURE_SPEC_REF).toEqual({ nap: 'NAP-CAPTURE', status: 'draft', source: 'pr', pr: 94, sha: '438b37612cd3', path: 'naps/NAP-CAPTURE.md' });
    expect(CAPTURE_MOCK_ENTRY).toMatchObject({ domain: 'capture', kind: 'extension' });
  });

  it('reports finite info and matches MIME types case-insensitively with parameter equality', () => {
    const service = createMockCaptureService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'capture.info', id: 'i1' }), send);
    expect(sent).toEqual([{ type: 'capture.info.result', id: 'i1', info: { ...MOCK_CAPTURE_INFO } }]);
    expect(selectCaptureMimeType(MOCK_CAPTURE_INFO.mimeTypes, ['AUDIO/MP4'])).toBe('audio/mp4');
    expect(selectCaptureMimeType(MOCK_CAPTURE_INFO.mimeTypes, ['audio/webm; codecs="opus"'])).toBe('audio/webm;codecs=opus');
    expect(selectCaptureMimeType(MOCK_CAPTURE_INFO.mimeTypes, ['audio/webm;codecs=vorbis'])).toBeUndefined();
    expect(selectCaptureMimeType(MOCK_CAPTURE_INFO.mimeTypes, ['audio/webm;codecs=opus;codecs=opus'])).toBe('invalid');
  });

  it('starts a session and completes it on stop with a placeholder artifact', () => {
    const { service, sent, send, advance } = recording();
    expect(sent).toEqual([{ type: 'capture.start.result', id: 's1', session: { captureId: 'capture-1', source: 'microphone', mimeType: 'audio/webm;codecs=opus', maxDurationMs: 600_000, maxBytes: 52_428_800, retentionMs: 300_000 } }]);
    service.handleMessage('w1', msg({ type: 'capture.status', id: 'st1', captureId: 'capture-1' }), send);
    expect(sent.at(-1)).toEqual({ type: 'capture.status.result', id: 'st1', status: { captureId: 'capture-1', state: 'recording' } });
    advance(2410);
    service.handleMessage('w1', msg({ type: 'capture.stop', id: 'sp1', captureId: 'capture-1' }), send);
    expect(sent.at(-2)).toEqual({ type: 'capture.changed', event: { captureId: 'capture-1', state: 'completed' } });
    const result = sent.at(-1) as unknown as { type: string; id: string; artifact: { data: Uint8Array; size: number } };
    expect(result).toMatchObject({ type: 'capture.stop.result', id: 'sp1', artifact: { captureId: 'capture-1', mimeType: 'audio/webm;codecs=opus', size: 14464, durationMs: 2410, truncated: false, reason: 'requested' } });
    expect(result.artifact.data).toBeInstanceOf(Uint8Array);
    expect(result.artifact.data.byteLength).toBe(14464);
    expect([...result.artifact.data.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    service.handleMessage('w1', msg({ type: 'capture.stop', id: 'sp2', captureId: 'capture-1' }), send);
    expect((sent.at(-1) as unknown as { artifact: { data: Uint8Array } }).artifact.data).toBe(result.artifact.data);
    service.handleMessage('w1', msg({ type: 'capture.status', id: 'st2', captureId: 'capture-1' }), send);
    expect(sent.at(-1)).toMatchObject({ type: 'capture.status.result', id: 'st2', status: { captureId: 'capture-1', state: 'completed', expiresAt: START + 2410 + 300_000 } });
    service.handleMessage('w1', msg({ type: 'capture.release', id: 'r1', captureId: 'capture-1' }), send);
    service.handleMessage('w1', msg({ type: 'capture.release', id: 'r2', captureId: 'capture-1' }), send);
    expect(sent.slice(-2)).toEqual([
      { type: 'capture.release.result', id: 'r1', captureId: 'capture-1' },
      { type: 'capture.release.result', id: 'r2', error: { code: 'capture-not-found' } },
    ]);
  });

  it('cancels a recording, refuses stop afterwards, and returns retained status on repeat cancel', () => {
    const { service, sent, send } = recording();
    service.handleMessage('w1', msg({ type: 'capture.cancel', id: 'c1', captureId: 'capture-1' }), send);
    service.handleMessage('w1', msg({ type: 'capture.cancel', id: 'c2', captureId: 'capture-1' }), send);
    service.handleMessage('w1', msg({ type: 'capture.stop', id: 'sp', captureId: 'capture-1' }), send);
    expect(sent.slice(1)).toEqual([
      { type: 'capture.changed', event: { captureId: 'capture-1', state: 'cancelled', reason: 'requested' } },
      { type: 'capture.cancel.result', id: 'c1', status: { captureId: 'capture-1', state: 'cancelled', reason: 'requested', expiresAt: START + 300_000 } },
      { type: 'capture.cancel.result', id: 'c2', status: { captureId: 'capture-1', state: 'cancelled', reason: 'requested', expiresAt: START + 300_000 } },
      { type: 'capture.stop.result', id: 'sp', error: { code: 'invalid-state' } },
    ]);
  });

  it('rejects malformed, unsupported, busy, foreign, and denied requests before any session exists', () => {
    const { service, sent, send } = recording();
    const other = sink();
    service.handleMessage('w1', msg({ type: 'capture.start', id: 'e1', request: { source: 'microphone' } }), send);
    service.handleMessage('w1', msg({ type: 'capture.release', id: 'e2', captureId: 'capture-1' }), send);
    service.handleMessage('w2', msg({ type: 'capture.status', id: 'e3', captureId: 'capture-1' }), other.send);
    service.handleMessage('w2', msg({ type: 'capture.start', id: 'e4' }), other.send);
    service.handleMessage('w2', msg({ type: 'capture.start', id: 'e5', request: { source: 'camera' } }), other.send);
    service.handleMessage('w2', msg({ type: 'capture.start', id: 'e6', request: { source: 'microphone', mimeTypes: ['video/webm'] } }), other.send);
    service.handleMessage('w2', msg({ type: 'capture.start', id: 'e7', request: { source: 'microphone', mimeTypes: ['not a mime'] } }), other.send);
    expect(sent.slice(1)).toEqual([
      { type: 'capture.start.result', id: 'e1', error: { code: 'busy' } },
      { type: 'capture.release.result', id: 'e2', error: { code: 'invalid-state' } },
    ]);
    expect(other.sent).toEqual([
      { type: 'capture.status.result', id: 'e3', error: { code: 'capture-not-found' } },
      { type: 'capture.start.result', id: 'e4', error: { code: 'invalid-request' } },
      { type: 'capture.start.result', id: 'e5', error: { code: 'unsupported-source' } },
      { type: 'capture.start.result', id: 'e6', error: { code: 'unsupported-format' } },
      { type: 'capture.start.result', id: 'e7', error: { code: 'invalid-request', message: 'malformed MIME type' } },
    ]);
    const denied = recording({ consent: 'deny' });
    expect(denied.sent).toEqual([{ type: 'capture.start.result', id: 's1', error: { code: 'user-cancelled' } }]);
    const blocked = recording({ permission: 'denied' });
    expect(blocked.sent).toEqual([{ type: 'capture.start.result', id: 's1', error: { code: 'permission-denied' } }]);
  });

  it('applies byte and duration limits, trusted controls, device loss, and revocation', () => {
    const limited = recording({ info: { maxBytes: 100 } });
    limited.advance(1000);
    limited.service.userStop('capture-1');
    expect(limited.sent.at(-1)).toEqual({ type: 'capture.changed', event: { captureId: 'capture-1', state: 'completed' } });
    expect(limited.service.mock.state().captures.get('capture-1')?.status.artifact).toMatchObject({ size: 100, truncated: true, reason: 'limit', durationMs: 1000 });

    const stopped = recording();
    stopped.advance(500);
    stopped.service.userStop('capture-1');
    expect(stopped.service.mock.state().captures.get('capture-1')?.status.artifact).toMatchObject({ size: 3004, truncated: false, reason: 'user' });

    const discarded = recording();
    discarded.service.userDiscard('capture-1');
    expect(discarded.sent.at(-1)).toEqual({ type: 'capture.changed', event: { captureId: 'capture-1', state: 'cancelled', reason: 'user' } });
    discarded.service.userDiscard('capture-1');
    expect(discarded.service.mock.state().captures.size).toBe(0);

    const lost = recording();
    lost.service.loseDevice('capture-1');
    expect(lost.sent.at(-1)).toEqual({ type: 'capture.changed', event: { captureId: 'capture-1', state: 'failed', error: { code: 'device-unavailable', message: 'microphone lost' } } });

    const revoked = recording();
    revoked.service.onCapabilityRevoked?.('w1', null);
    expect(revoked.sent.at(-1)).toEqual({ type: 'capture.changed', event: { captureId: 'capture-1', state: 'cancelled', reason: 'revoked' } });
  });

  it('erases retained state at expiry through the scheduler and on window destroy; reset cancels timers', () => {
    const queued: Array<{ ms: number; fn: () => void }> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (ms, fn) => { queued.push({ ms, fn }); return () => { cancelled += 1; }; } };
    const { service, sent, send } = recording({ scheduler });
    service.handleMessage('w1', msg({ type: 'capture.stop', id: 'sp', captureId: 'capture-1' }), send);
    expect(queued).toEqual([{ ms: 300_000, fn: expect.any(Function) }]);
    queued[0]!.fn();
    service.handleMessage('w1', msg({ type: 'capture.status', id: 'st', captureId: 'capture-1' }), send);
    expect(sent.at(-1)).toEqual({ type: 'capture.status.result', id: 'st', error: { code: 'capture-not-found' } });

    service.handleMessage('w1', msg({ type: 'capture.start', id: 's2', request: { source: 'microphone' } }), send);
    service.handleMessage('w1', msg({ type: 'capture.cancel', id: 'c', captureId: 'capture-2' }), send);
    service.onWindowDestroyed?.('w1');
    expect(cancelled).toBe(1);
    expect(service.mock.state().captures.size).toBe(0);

    service.handleMessage('w1', msg({ type: 'capture.start', id: 's3', request: { source: 'microphone' } }), send);
    service.expire('capture-3');
    expect(service.mock.state().captures.has('capture-3')).toBe(true);
    service.handleMessage('w1', msg({ type: 'capture.cancel', id: 'c3', captureId: 'capture-3' }), send);
    service.mock.reset();
    expect(cancelled).toBe(2);
    expect(service.mock.state()).toMatchObject({ captures: new Map(), counter: 0 });
    expect(service.mock.sent).toEqual([]);
  });
});
