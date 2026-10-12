import { describe, expect, it, vi } from 'vitest';
import { createGamepadService, type GamepadPadSample } from './gamepad-service.js';

// NAP-GAMEPAD Wire Protocol's connected controller example.
const pad: GamepadPadSample = {
  index: 1, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true,
  timestamp: 18235.4, axes: [0, -1, 0, 0],
  buttons: [{ value: 1, pressed: true, touched: true }, { value: 0, pressed: false, touched: false }],
};

describe('host-owned GAMEPAD service', () => {
  it('isolates live values, neutralizes immediately on focus loss and hides timing', () => {
    let owner: string | null = 'one';
    let active = true;
    let current = pad;
    const one = vi.fn(); const two = vi.fn();
    const service = createGamepadService({ readGamepads: () => [null, current], getFocusedWindow: () => owner, isHostActive: () => active });
    service.handleMessage('one', { type: 'gamepad.subscribe' }, one);
    service.handleMessage('two', { type: 'gamepad.subscribe' }, two);
    expect(one.mock.lastCall?.[0]).toEqual({ type: 'gamepad.state', available: true, focused: true, pads: [null, pad] });
    const neutral = { ...pad, timestamp: 0, axes: [0, 0, 0, 0], buttons: [{ value: 0, pressed: false, touched: false }, { value: 0, pressed: false, touched: false }] };
    expect(two.mock.lastCall?.[0]).toEqual({ type: 'gamepad.state', available: true, focused: false, pads: [null, neutral] });
    current = { ...pad, timestamp: 18236.4, axes: [1, 0, 0, 0] };
    service.refresh();
    expect(one).toHaveBeenCalledTimes(2);
    expect(two).toHaveBeenCalledTimes(1);
    owner = 'two'; service.refresh();
    expect(one.mock.lastCall?.[0].focused).toBe(false);
    expect(one.mock.lastCall?.[0].pads[1]).toEqual(neutral);
    expect(two.mock.lastCall?.[0].focused).toBe(true);
    active = false; service.refresh();
    expect(two.mock.lastCall?.[0].pads[1]).toEqual(neutral);
    expect(two.mock.lastCall?.[0].focused).toBe(false);
  });

  it('reports connection changes to every subscriber and replies to each valid subscribe', () => {
    let pads: readonly (GamepadPadSample | null)[] = [null, pad];
    const one = vi.fn(); const two = vi.fn();
    const service = createGamepadService({ readGamepads: () => pads });
    service.handleMessage('one', { type: 'gamepad.subscribe' }, one);
    service.handleMessage('one', { type: 'gamepad.subscribe' }, one);
    service.handleMessage('two', { type: 'gamepad.subscribe' }, two);
    expect(one).toHaveBeenCalledTimes(2);
    pads = [null, null]; service.refresh();
    expect(one.mock.lastCall?.[0].pads).toEqual([null, null]);
    expect(two.mock.lastCall?.[0].pads).toEqual([null, null]);
    service.refresh();
    expect(one).toHaveBeenCalledTimes(3);
    expect(two).toHaveBeenCalledTimes(2);
  });

  it('reports missing and policy-blocked native APIs without invented results', () => {
    const send = vi.fn();
    createGamepadService().handleMessage('one', { type: 'gamepad.subscribe' }, send);
    expect(send).toHaveBeenLastCalledWith({ type: 'gamepad.state', available: false, reason: 'unavailable', focused: false, pads: [] });
    const requestFrame = vi.fn();
    const blocked = createGamepadService({ readGamepads: () => { throw new DOMException('Denied', 'SecurityError'); }, requestFrame });
    blocked.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    expect(send).toHaveBeenLastCalledWith({ type: 'gamepad.state', available: false, reason: 'blocked', focused: false, pads: [] });
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('polls once per frame and stops on unsubscribe, destruction and service detach', () => {
    const frames = new Map<number, () => void>();
    let sequence = 0;
    const read = vi.fn(() => [pad]);
    const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
    const send = vi.fn();
    const service = createGamepadService({ readGamepads: read, requestFrame: (callback) => { frames.set(++sequence, callback); return sequence; }, cancelFrame });
    service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    service.handleMessage('two', { type: 'gamepad.subscribe' }, send);
    expect(frames.size).toBe(1);
    const old = frames.get(1)!;
    service.handleMessage('one', { type: 'gamepad.unsubscribe' }, send);
    service.onWindowDestroyed!('two');
    expect(frames.size).toBe(0);
    service.handleMessage('three', { type: 'gamepad.subscribe' }, send);
    const reads = read.mock.calls.length;
    old();
    expect(read).toHaveBeenCalledTimes(reads);
    expect(frames.size).toBe(1);
    service.onUnregistered!();
    expect(frames.size).toBe(0);
    service.refresh();
    expect(read).toHaveBeenCalledTimes(reads);
  });

  it('clamps values, retains future mappings and supplies pressed as the no-touch fallback', () => {
    const send = vi.fn();
    const service = createGamepadService({ readGamepads: () => [{ ...pad, mapping: 'future-layout', axes: [-2, 2, NaN], buttons: [{ value: 2, pressed: true }, { value: -1, pressed: false }] }], getFocusedWindow: () => 'one' });
    service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    expect(send.mock.lastCall?.[0].pads[0]).toMatchObject({ index: 1, mapping: 'future-layout', axes: [-1, 1, 0], buttons: [{ value: 1, pressed: true, touched: true }, { value: 0, pressed: false, touched: false }] });
  });

  it('ignores ids, unsupported messages and excessive subscribes while always honoring unsubscribe', () => {
    const send = vi.fn();
    const service = createGamepadService({ readGamepads: () => [], now: () => 0 });
    service.handleMessage('one', { type: 'gamepad.subscribe', id: 'not-defined' } as never, send);
    service.handleMessage('one', { type: 'gamepad.getGamepads' }, send);
    expect(send).not.toHaveBeenCalled();
    for (let count = 0; count < 100; count++) service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    expect(send).toHaveBeenCalledTimes(32);
    service.handleMessage('one', { type: 'gamepad.unsubscribe' }, send);
    service.refresh();
    expect(send).toHaveBeenCalledTimes(32);
  });
});
