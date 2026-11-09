import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { GAMEPAD_MOCK_ENTRY, GAMEPAD_SPEC_REF, MOCK_GAMEPADS, createMockGamepadService, standardGamepad } from './gamepad.js';

const NOW = 1_767_225_600_000;
const clock = { now: () => NOW };
const released = { value: 0, pressed: false, touched: false };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;
const neutralPads = () => MOCK_GAMEPADS.map((pad) => ({ ...pad, axes: [0, 0, 0, 0], buttons: pad.buttons.map(() => ({ ...released })) }));

describe('createMockGamepadService', () => {
  it('describes the service and seeds two standard pads', () => {
    const service = createMockGamepadService();
    expect(service.descriptor).toEqual({ name: 'gamepad', version: '1.0.0', description: 'Mock NAP-GAMEPAD focus-scoped controller snapshots' });
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['gamepad.subscribe', 'gamepad.unsubscribe']);
    expect(GAMEPAD_SPEC_REF).toEqual({ nap: 'NAP-GAMEPAD', status: 'draft', source: 'pr', pr: 130, sha: '0b28f77e3dfa', path: 'naps/NAP-GAMEPAD.md' });
    expect(GAMEPAD_MOCK_ENTRY).toMatchObject({ domain: 'gamepad', kind: 'service' });
    expect(MOCK_GAMEPADS.map((pad) => [pad.index, pad.id, pad.mapping, pad.axes.length, pad.buttons.length])).toEqual([
      [0, 'Example Wireless Controller (Vendor: 0000 Product: 0001)', 'standard', 4, 17],
      [1, 'Example Arcade Stick (Vendor: 0000 Product: 0002)', 'standard', 4, 17],
    ]);
  });

  it('sends a snapshot after subscribe; the first subscriber holds focus, others are neutral', () => {
    const service = createMockGamepadService({ clock });
    const w1 = sink();
    const w2 = sink();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), w1.send);
    service.handleMessage('w2', msg({ type: 'gamepad.subscribe' }), w2.send);
    expect(w1.sent).toEqual([{ type: 'gamepad.state', available: true, focused: true, pads: neutralPads() }]);
    expect(w2.sent).toEqual([{ type: 'gamepad.state', available: true, focused: false, pads: neutralPads() }]);
  });

  it('pushes live values only to the focused window and skips unchanged snapshots', () => {
    const service = createMockGamepadService({ clock });
    const w1 = sink();
    const w2 = sink();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), w1.send);
    service.handleMessage('w2', msg({ type: 'gamepad.subscribe' }), w2.send);
    service.press('w1', 0, 0);
    service.setAxes('w1', 0, [0.5, -2, 0, 0]);
    const live = w1.sent.at(-1) as unknown as { pads: Array<{ timestamp: number; axes: number[]; buttons: typeof released[] }> };
    expect(w1.sent).toHaveLength(3);
    expect(live.pads[0]).toMatchObject({ index: 0, timestamp: NOW, axes: [0.5, -1, 0, 0] });
    expect(live.pads[0]!.buttons[0]).toEqual({ value: 1, pressed: true, touched: true });
    expect(live.pads[0]!.buttons[1]).toEqual(released);
    expect(w2.sent).toHaveLength(1);
    service.release('w1', 0, 0);
    expect((w1.sent.at(-1) as unknown as typeof live).pads[0]!.buttons[0]).toEqual(released);
  });

  it('moves focus, reports connection changes to everyone, and reports unavailability', () => {
    const service = createMockGamepadService({ clock });
    const w1 = sink();
    const w2 = sink();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), w1.send);
    service.handleMessage('w2', msg({ type: 'gamepad.subscribe' }), w2.send);
    service.press('w1', 1, 2, 0.4);
    service.setFocus('w2');
    expect(w1.sent.at(-1)).toMatchObject({ focused: false, pads: neutralPads() });
    expect((w2.sent.at(-1) as unknown as { focused: boolean; pads: Array<{ buttons: typeof released[] }> }).pads[1]!.buttons[2]).toEqual({ value: 0.4, pressed: true, touched: true });
    service.disconnect(1);
    expect((w1.sent.at(-1) as unknown as { pads: unknown[] }).pads[1]).toBeNull();
    expect((w2.sent.at(-1) as unknown as { pads: unknown[] }).pads[1]).toBeNull();
    service.connect(standardGamepad(2, 'Example Flight Stick'));
    expect((w2.sent.at(-1) as unknown as { pads: Array<{ id: string } | null> }).pads.map((pad) => pad?.id ?? null)).toEqual([MOCK_GAMEPADS[0]!.id, null, 'Example Flight Stick']);

    const blocked = createMockGamepadService({ unavailable: 'blocked' });
    const w3 = sink();
    blocked.handleMessage('w3', msg({ type: 'gamepad.subscribe' }), w3.send);
    expect(w3.sent).toEqual([{ type: 'gamepad.state', available: false, reason: 'blocked', focused: false, pads: [] }]);
  });

  it('ignores envelopes with ids and stops pushing after unsubscribe', () => {
    const service = createMockGamepadService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe', id: 'x' }), send);
    expect(sent).toEqual([]);
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), send);
    service.handleMessage('w1', msg({ type: 'gamepad.unsubscribe' }), send);
    service.press('w1', 0, 0);
    expect(sent).toHaveLength(1);
    expect(service.mock.state().subscribers.size).toBe(0);
  });

  it('runs the autoplay idle loop through the scheduler and cancels it on reset and window destroy', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } };
    const service = createMockGamepadService({ clock, scheduler, autoplay: true, tickMs: 16 });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), send);
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect((sent.at(-1) as unknown as { pads: Array<{ axes: number[]; timestamp: number }> }).pads[0]).toMatchObject({ axes: [0, 0.05, 0, 0], timestamp: NOW });
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    expect(cancelled).toBe(1);
    expect(service.mock.state().focusedWindow).toBeNull();
    service.handleMessage('w1', msg({ type: 'gamepad.subscribe' }), send);
    service.mock.reset();
    expect(cancelled).toBe(2);
    expect(service.mock.state().subscribers.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
