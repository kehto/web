import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { LOCATION_MOCK_ENTRY, LOCATION_SPEC_REF, MOCK_ROUTE, coarsenPosition, createMockLocationService } from './location.js';

const NOW = 1_767_225_600_000;
const ROUTES = ['location.subscribe', 'location.unsubscribe', 'location.permission', 'location.current'];
const FIX_0 = { latitude: 52.5145, longitude: 13.3501, accuracy: 12, altitude: 34, altitudeAccuracy: 8, heading: 61.3, speed: 1.4, timestamp: NOW, precise: true };
const COARSE_0 = { latitude: 52.51, longitude: 13.35, accuracy: 1304, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: NOW, precise: false };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;

function ticking(options: Parameters<typeof createMockLocationService>[0] = {}) {
  let now = NOW;
  return { service: createMockLocationService({ clock: { now: () => now }, ...options }), advance: (ms: number) => { now += ms; } };
}

describe('createMockLocationService', () => {
  it('describes the extension and publishes every route', () => {
    const service = createMockLocationService();
    expect(service.descriptor).toEqual({ name: 'location', version: '0.1.0', description: 'Mock NAP-LOCATION shell-mediated geolocation' });
    expect(Object.keys(service.messageCapabilities!)).toEqual(ROUTES);
    expect(LOCATION_SPEC_REF).toEqual({ nap: 'NAP-LOCATION', status: 'draft', source: 'pr', pr: 125, sha: '24d2039cf2d1', path: 'naps/NAP-LOCATION.md' });
    expect(LOCATION_MOCK_ENTRY).toMatchObject({ domain: 'location', kind: 'extension' });
    expect(MOCK_ROUTE).toHaveLength(8);
  });

  it('snapshots on subscribe, grants precise position, and pushes route fixes while active', () => {
    const { service } = ticking();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'location.subscribe' }), send);
    expect(sent).toEqual([{ type: 'location.state', available: true, permission: 'prompt', precise: false, background: false, active: false }]);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'l1', precise: true }), send);
    expect(sent.slice(1)).toEqual([
      { type: 'location.permission.result', id: 'l1', permission: 'granted', precise: true, background: false },
      { type: 'location.state', available: true, permission: 'granted', precise: true, background: false, active: true },
    ]);
    expect(service.advance()).toEqual(FIX_0);
    expect(sent.at(-1)).toEqual({ type: 'location.position', ...FIX_0 });
    service.advance();
    expect(sent.at(-1)).toMatchObject({ type: 'location.position', latitude: 52.5152, longitude: 13.3522, precise: true });
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'l2' }), send);
    expect(sent.at(-1)).toEqual({ type: 'location.permission.result', id: 'l2', permission: 'granted', precise: true, background: false });
  });

  it('coarsens positions by grid snapping without a precise grant', () => {
    const { service } = ticking({ grant: 'coarse-only' });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'location.subscribe' }), send);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'l1', precise: true, background: true }), send);
    expect(sent.at(-2)).toEqual({ type: 'location.permission.result', id: 'l1', permission: 'granted', precise: false, background: false });
    service.advance();
    expect(sent.at(-1)).toEqual({ type: 'location.position', ...COARSE_0 });
    expect(coarsenPosition(FIX_0)).toEqual(COARSE_0);
    expect(coarsenPosition({ ...FIX_0, latitude: 52.5139, longitude: 13.3571 })).toEqual(COARSE_0);
  });

  it('answers location.current with cached, fresh, denied, inactive, timeout, and unavailable outcomes', () => {
    const { service, advance } = ticking({ fixLatencyMs: 500 });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c0' }), send);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'p', precise: true }), send);
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c1', maximumAge: 60_000, timeout: 10_000 }), send);
    advance(30_000);
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c2', maximumAge: 60_000 }), send);
    advance(60_000);
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c3', maximumAge: 60_000, timeout: 100 }), send);
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c4' }), send);
    service.setVisible('w1', false);
    service.handleMessage('w1', msg({ type: 'location.current', id: 'c5' }), send);
    expect(sent).toEqual([
      { type: 'location.current.result', id: 'c0', error: 'denied' },
      { type: 'location.permission.result', id: 'p', permission: 'granted', precise: true, background: false },
      { type: 'location.current.result', id: 'c1', position: FIX_0 },
      { type: 'location.current.result', id: 'c2', position: FIX_0 },
      { type: 'location.current.result', id: 'c3', error: 'timeout' },
      { type: 'location.current.result', id: 'c4', position: { ...FIX_0, latitude: 52.5152, longitude: 13.3522, heading: expect.any(Number), timestamp: NOW + 90_000 } },
      { type: 'location.current.result', id: 'c5', error: 'inactive' },
    ]);

    const blocked = createMockLocationService({ unavailable: 'unavailable' });
    const other = sink();
    blocked.handleMessage('w1', msg({ type: 'location.permission', id: 'p1' }), other.send);
    blocked.handleMessage('w1', msg({ type: 'location.permission', id: 'p2', precise: 'yes' }), other.send);
    expect(other.sent).toEqual([
      { type: 'location.permission.result', id: 'p1', permission: 'prompt', precise: false, background: false, error: 'unavailable' },
      { type: 'location.permission.result', id: 'p2', permission: 'prompt', precise: false, background: false, error: 'invalid request' },
    ]);
    const denied = createMockLocationService({ grant: 'denied' });
    denied.handleMessage('w1', msg({ type: 'location.permission', id: 'd1' }), other.send);
    denied.handleMessage('w1', msg({ type: 'location.current', id: 'd2' }), other.send);
    expect(other.sent.slice(-2)).toEqual([
      { type: 'location.permission.result', id: 'd1', permission: 'denied', precise: false, background: false },
      { type: 'location.current.result', id: 'd2', error: 'denied' },
    ]);
  });

  it('stops positions when hidden without a background grant, on revocation, and after unsubscribe', () => {
    const { service } = ticking();
    const w1 = sink();
    const w2 = sink();
    service.handleMessage('w1', msg({ type: 'location.subscribe' }), w1.send);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'a' }), w1.send);
    service.handleMessage('w2', msg({ type: 'location.subscribe', highAccuracy: true }), w2.send);
    service.handleMessage('w2', msg({ type: 'location.permission', id: 'b', background: true }), w2.send);
    service.setVisible('w1', false);
    service.setVisible('w2', false);
    expect(w1.sent.at(-1)).toEqual({ type: 'location.state', available: true, permission: 'granted', precise: false, background: false, active: false });
    expect(w2.sent.at(-1)).toEqual({ type: 'location.state', available: true, permission: 'granted', precise: false, background: true, active: true });
    const before = w1.sent.length;
    service.advance();
    expect(w1.sent).toHaveLength(before);
    expect(w2.sent.at(-1)).toMatchObject({ type: 'location.position', precise: false });
    service.revoke('w2');
    expect(w2.sent.at(-1)).toEqual({ type: 'location.state', available: true, permission: 'prompt', precise: false, background: false, active: false });
    service.handleMessage('w1', msg({ type: 'location.unsubscribe' }), w1.send);
    service.setVisible('w1', true);
    expect(w1.sent).toHaveLength(before);
  });

  it('runs the autoplay loop through the scheduler and cancels it on reset and window destroy', () => {
    const queued: Array<{ ms: number; fn: () => void }> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (ms, fn) => { queued.push({ ms, fn }); return () => { cancelled += 1; }; } };
    const service = createMockLocationService({ clock: { now: () => NOW }, scheduler, autoplay: true, tickMs: 1000 });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'location.subscribe' }), send);
    expect(queued).toEqual([]);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'l1', precise: true }), send);
    expect(queued).toEqual([{ ms: 1000, fn: expect.any(Function) }]);
    queued.shift()!.fn();
    expect(sent.at(-1)).toEqual({ type: 'location.position', ...FIX_0 });
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    expect(cancelled).toBe(1);
    expect(service.mock.state().windows.size).toBe(0);
    service.handleMessage('w1', msg({ type: 'location.subscribe' }), send);
    service.handleMessage('w1', msg({ type: 'location.permission', id: 'l2' }), send);
    service.mock.reset();
    expect(cancelled).toBe(2);
    expect(service.mock.state().routeIndex).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
