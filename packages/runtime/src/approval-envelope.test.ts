import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { snapshotApprovalEnvelope } from './approval-envelope.js';

describe('approval envelope snapshot', () => {
  it('detaches and freezes nested JSON including harmless prototype-named keys', () => {
    const input = JSON.parse('{"type":"example.run","id":"one","payload":{"__proto__":{"safe":true},"items":[1,null,false]}}');
    const result = snapshotApprovalEnvelope(input) as unknown as typeof input;
    input.payload.items[0] = 999;
    expect(result.payload.items).toEqual([1, null, false]);
    expect(Object.hasOwn(result.payload, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result.payload)).toBe(Object.prototype);
    expect(Object.isFrozen(result.payload.items)).toBe(true);
  });

  it('refuses accessors without invoking them', () => {
    const read = vi.fn(() => 'secret');
    const input = { type: 'example.run', payload: Object.defineProperty({}, 'value', { enumerable: true, get: read }) };
    expect(snapshotApprovalEnvelope(input as NappletMessage)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it.each([undefined, Infinity, NaN, () => {}, new Date(), new Map(), new Set(), [undefined], Array(2)])('rejects non-JSON payload %s', (payload) => {
    expect(snapshotApprovalEnvelope({ type: 'example.run', payload } as NappletMessage)).toBeUndefined();
  });

  it('bounds text, nesting, collections, and cyclic inputs', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    let nested: unknown = 0;
    for (let i = 0; i < 34; i++) nested = { nested };
    for (const payload of [cyclic, nested, 'x'.repeat(1024 * 1024), Array(8193).fill(0)]) {
      expect(snapshotApprovalEnvelope({ type: 'example.run', payload } as NappletMessage)).toBeUndefined();
    }
  });
});
