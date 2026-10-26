import { describe, expect, it, vi } from 'vitest';
import { createGamepadService, type GamepadPadSample } from './gamepad-service.js';
import type { ServiceRuntimeContext } from '@kehto/runtime';

// NAP-GAMEPAD Wire Protocol's connected controller example.
const pad: GamepadPadSample = {
  index: 1, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true,
  timestamp: 18235.4, axes: [0, -1, 0, 0],
  buttons: [{ value: 1, pressed: true, touched: true }, { value: 0, pressed: false, touched: false }],
};

describe('host-owned GAMEPAD service', () => {
  it('authorizes host gamepad input before the first native read', async () => {
    let approve!: () => void;
    const gate = new Promise<void>((resolve) => { approve = resolve; });
    const readGamepads = vi.fn(() => [pad]);
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute) => {
      await gate;
      await execute(new AbortController().signal);
      return { status: 'executed' as const, value: undefined };
    });
    const service = createGamepadService({ readGamepads, getFocusedWindow: () => 'one' });
    service.onRegistered?.({ authorizeOperation, sendToEligibleNapplet: (_windowId: string, message: unknown) => {
      send(message); return true;
    } } as unknown as ServiceRuntimeContext);
    const send = vi.fn();
    service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    await vi.waitFor(() => expect(authorizeOperation).toHaveBeenCalledTimes(1));
    expect(authorizeOperation.mock.calls[0]?.slice(0, 3)).toEqual(['one', 'gamepad.subscribe', [
      { category: 'resource', domain: 'gamepad', operation: 'gamepad.subscribe', scope: { kind: 'exact', value: 'gamepad:input' } },
    ]]);
    expect(readGamepads).not.toHaveBeenCalled();
    approve();
    await vi.waitFor(() => expect(readGamepads).toHaveBeenCalledTimes(1));
  });

  it('reports blocked state without reading or polling after denied approval', async () => {
    const readGamepads = vi.fn(() => [pad]);
    const authorizeOperation = vi.fn(async () => ({ status: 'denied' as const }));
    const service = createGamepadService({ readGamepads });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const send = vi.fn();
    service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'gamepad.state', available: false, reason: 'blocked', focused: false, pads: [],
    }));
    expect(readGamepads).not.toHaveBeenCalled();
  });

  it('drops a late approval after revocation and never starts its native reader', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readGamepads = vi.fn(() => [pad]);
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute: (signal: AbortSignal) => void) => {
      await gate;
      execute(new AbortController().signal);
      return { status: 'executed' as const, value: undefined };
    });
    const service = createGamepadService({ readGamepads });
    service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
    const send = vi.fn();
    service.handleMessage('one', { type: 'gamepad.subscribe' }, send);
    await vi.waitFor(() => expect(authorizeOperation).toHaveBeenCalledTimes(1));
    service.onPermissionRevoked?.('one');
    release();
    await Promise.resolve();
    expect(readGamepads).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('warns once on retained host-only subscriptions while canonical approval stays quiet', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const legacy = createGamepadService({ readGamepads: () => [] });
      const send = vi.fn();
      legacy.handleMessage('one', { type: 'gamepad.subscribe' }, send);
      legacy.handleMessage('one', { type: 'gamepad.subscribe' }, send);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0]?.[0]).toMatch(/FW-GAMEPAD-LEGACY-001.*RuntimeAdapter.permissions.*once per service instance/);
      warning.mockClear();
      const canonical = createGamepadService({ readGamepads: () => [] });
      canonical.onRegistered?.({
        authorizeOperation: async (_windowId: string, _operation: string, _requirements: unknown,
          execute: (signal: AbortSignal) => void) => {
          execute(new AbortController().signal);
          return { status: 'executed' as const, value: undefined };
        },
        sendToEligibleNapplet: () => true,
      } as unknown as ServiceRuntimeContext);
      canonical.handleMessage('one', { type: 'gamepad.subscribe' }, send);
      await vi.waitFor(() => expect(warning).not.toHaveBeenCalled());
    } finally { warning.mockRestore(); }
  });
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
