import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MOTION_MOCK_ENTRY, MOTION_SPEC_REF, createMockMotionService, motionSampleAt } from './motion.js';

const NOW = 1_767_225_600_000;
const clock = { now: () => NOW };
const ROUTES = ['motion.subscribe', 'motion.unsubscribe', 'motion.permission'];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;

describe('createMockMotionService', () => {
  it('describes the extension and publishes every route', () => {
    const service = createMockMotionService();
    expect(service.descriptor).toEqual({ name: 'motion', version: '0.1.0', description: 'Mock NAP-MOTION device motion and orientation' });
    expect(Object.keys(service.messageCapabilities!)).toEqual(ROUTES);
    expect(MOTION_SPEC_REF).toEqual({ nap: 'NAP-MOTION', status: 'draft', source: 'pr', pr: 124, sha: '3069a945271f', path: 'naps/NAP-MOTION.md' });
    expect(MOTION_MOCK_ENTRY).toMatchObject({ domain: 'motion', kind: 'extension' });
  });

  it('snapshots on subscribe, grants on request, and delivers deterministic samples to the focused window', () => {
    const service = createMockMotionService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'motion.subscribe', frequency: 60 }), send);
    expect(sent).toEqual([{ type: 'motion.state', available: true, permission: 'prompt', absolute: false, focused: false, frequency: 0 }]);
    expect(service.emitSample()).toBe(false);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm1', absolute: true }), send);
    expect(sent.slice(1)).toEqual([
      { type: 'motion.permission.result', id: 'm1', permission: 'granted', absolute: true },
      { type: 'motion.state', available: true, permission: 'granted', absolute: true, focused: true, frequency: 60 },
    ]);
    expect(service.emitSample()).toBe(true);
    expect(sent.at(-1)).toEqual({
      type: 'motion.sample', timestamp: NOW, interval: 16.7,
      acceleration: { x: 0, y: 0.2, z: 0 },
      accelerationIncludingGravity: { x: 0, y: 0.2, z: 9.8 },
      rotationRate: { alpha: 1.5, beta: 0, gamma: 0 },
      orientation: { alpha: 110, beta: 3, gamma: -1.2, absolute: true },
    });
    expect(sent.at(-1)).toEqual({ type: 'motion.sample', ...motionSampleAt(0, NOW, 16.7, true) });
    service.emitSample();
    expect(sent.at(-1)).toMatchObject({ acceleration: { x: 0, y: 0.2, z: 0 }, rotationRate: { alpha: 1.5, beta: 0, gamma: 0 } });
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm2' }), send);
    expect(sent.at(-1)).toEqual({ type: 'motion.permission.result', id: 'm2', permission: 'granted', absolute: true });
  });

  it('grants relative-only orientation, denies, and caps the requested rate', () => {
    const relative = createMockMotionService({ clock, grant: 'relative-only' });
    const { sent, send } = sink();
    relative.handleMessage('w1', msg({ type: 'motion.subscribe', frequency: 120 }), send);
    relative.handleMessage('w1', msg({ type: 'motion.permission', id: 'm1', absolute: true }), send);
    expect(sent.slice(1)).toEqual([
      { type: 'motion.permission.result', id: 'm1', permission: 'granted', absolute: false },
      { type: 'motion.state', available: true, permission: 'granted', absolute: false, focused: true, frequency: 60 },
    ]);
    relative.emitSample();
    expect(sent.at(-1)).toMatchObject({ interval: 16.7, orientation: { alpha: 112.4, absolute: false } });

    const denied = createMockMotionService({ grant: 'denied' });
    const other = sink();
    denied.handleMessage('w1', msg({ type: 'motion.subscribe' }), other.send);
    denied.handleMessage('w1', msg({ type: 'motion.permission', id: 'm2' }), other.send);
    expect(other.sent.slice(-2)).toEqual([
      { type: 'motion.permission.result', id: 'm2', permission: 'denied', absolute: false },
      { type: 'motion.state', available: true, permission: 'denied', absolute: false, focused: false, frequency: 0 },
    ]);
    expect(denied.emitSample()).toBe(false);
  });

  it('reports unavailability and malformed permission requests as errors', () => {
    const service = createMockMotionService({ unavailable: 'blocked' });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'motion.subscribe' }), send);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm1' }), send);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm2', absolute: 'yes' }), send);
    expect(sent).toEqual([
      { type: 'motion.state', available: false, reason: 'blocked', permission: 'prompt', absolute: false, focused: false, frequency: 0 },
      { type: 'motion.permission.result', id: 'm1', permission: 'prompt', absolute: false, error: 'blocked' },
      { type: 'motion.permission.result', id: 'm2', permission: 'prompt', absolute: false, error: 'invalid request' },
    ]);
  });

  it('stops samples on focus loss, revocation, and unsubscribe without resending unchanged state', () => {
    const service = createMockMotionService({ clock });
    const w1 = sink();
    const w2 = sink();
    service.handleMessage('w1', msg({ type: 'motion.subscribe' }), w1.send);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'a' }), w1.send);
    service.handleMessage('w2', msg({ type: 'motion.subscribe' }), w2.send);
    service.handleMessage('w2', msg({ type: 'motion.permission', id: 'b' }), w2.send);
    expect(w2.sent.slice(-2)).toEqual([
      { type: 'motion.permission.result', id: 'b', permission: 'granted', absolute: false },
      { type: 'motion.state', available: true, permission: 'granted', absolute: false, focused: false, frequency: 0 },
    ]);
    service.setFocus('w2');
    expect(w1.sent.at(-1)).toEqual({ type: 'motion.state', available: true, permission: 'granted', absolute: false, focused: false, frequency: 0 });
    expect(w2.sent.at(-1)).toEqual({ type: 'motion.state', available: true, permission: 'granted', absolute: false, focused: true, frequency: 60 });
    const before = w1.sent.length;
    service.setFocus('w2');
    expect(w1.sent).toHaveLength(before);
    service.revoke('w2');
    expect(w2.sent.at(-1)).toEqual({ type: 'motion.state', available: true, permission: 'prompt', absolute: false, focused: false, frequency: 0 });
    expect(service.emitSample()).toBe(false);
    service.handleMessage('w1', msg({ type: 'motion.unsubscribe' }), w1.send);
    service.setFocus('w1');
    expect(w1.sent).toHaveLength(before);
    service.handleMessage('w1', msg({ type: 'motion.subscribe', id: 'x' }), w1.send);
    expect(w1.sent).toHaveLength(before);
  });

  it('runs the autoplay loop through the scheduler and cancels it on reset and window destroy', () => {
    const queued: Array<{ ms: number; fn: () => void }> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (ms, fn) => { queued.push({ ms, fn }); return () => { cancelled += 1; }; } };
    const service = createMockMotionService({ clock, scheduler, autoplay: true });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'motion.subscribe', frequency: 50 }), send);
    expect(queued).toEqual([]);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm1' }), send);
    expect(queued).toEqual([{ ms: 20, fn: expect.any(Function) }]);
    queued.shift()!.fn();
    expect(sent.at(-1)).toMatchObject({ type: 'motion.sample', interval: 20 });
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    expect(cancelled).toBe(1);
    expect(service.mock.state().windows.size).toBe(0);
    expect(service.mock.state().focusedWindow).toBeNull();
    service.handleMessage('w1', msg({ type: 'motion.subscribe' }), send);
    service.handleMessage('w1', msg({ type: 'motion.permission', id: 'm2' }), send);
    service.mock.reset();
    expect(cancelled).toBe(2);
    expect(service.mock.state().sampleIndex).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
