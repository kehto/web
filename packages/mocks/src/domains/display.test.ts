import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { DISPLAY_MOCK_ENTRY, DISPLAY_SPEC_REF, MOCK_DISPLAYS, createMockDisplayService } from './display.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;
const push = (pixels: unknown, displayId = 'badge', id = 'd2') => msg({ type: 'display.push', id, displayId, pixels });

describe('createMockDisplayService', () => {
  it('describes the extension and publishes both routes', () => {
    const service = createMockDisplayService();
    expect(service.descriptor).toEqual({ name: 'display', version: '0.1.0', description: 'Mock NAP-DISPLAY runtime-controlled pixel displays' });
    expect(service.messageCapabilities).toEqual({ 'display.list': null, 'display.push': null });
    expect(service.mock.routes).toEqual(['display.list', 'display.push']);
    expect(DISPLAY_SPEC_REF).toEqual({ nap: 'NAP-DISPLAY', status: 'draft', source: 'pr', pr: 97, sha: '2c2e1b5ca384', path: 'naps/NAP-DISPLAY.md' });
    expect(DISPLAY_MOCK_ENTRY).toMatchObject({ domain: 'display', kind: 'extension' });
  });

  it('lists the seeded badge display', () => {
    const service = createMockDisplayService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'display.list', id: 'd1' }), send);
    expect(sent).toEqual([{ type: 'display.list.result', id: 'd1', displays: [{ id: 'badge', width: 32, height: 8, type: 'led-matrix' }] }]);
    expect(MOCK_DISPLAYS).toEqual([{ id: 'badge', width: 32, height: 8, type: 'led-matrix' }]);
  });

  it('applies a valid batch to the framebuffer', () => {
    const service = createMockDisplayService();
    const { sent, send } = sink();
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [255, 0, 0] }, { x: 1, y: 0, bytes: [0, 32, 255] }, { x: 31, y: 7, bytes: [7, 8, 9] }]), send);
    expect(sent).toEqual([{ type: 'display.push.result', id: 'd2' }]);
    expect(service.pixelAt('badge', 0, 0)).toEqual([255, 0, 0]);
    expect(service.pixelAt('badge', 1, 0)).toEqual([0, 32, 255]);
    expect(service.pixelAt('badge', 31, 7)).toEqual([7, 8, 9]);
    expect(service.pixelAt('badge', 2, 0)).toEqual([0, 0, 0]);
    expect(service.pixelAt('badge', 32, 0)).toBeUndefined();
    expect(service.pixelAt('nope', 0, 0)).toBeUndefined();
    expect(service.mock.state().batches.get('badge')).toBe(1);
    expect(service.mock.state().framebuffers.get('badge')?.byteLength).toBe(32 * 8 * 3);
  });

  it('rejects invalid batches atomically with NAP error codes', () => {
    const service = createMockDisplayService({ maxBatchPixels: 2, denied: ['desk'], unavailable: ['eink'], displays: [...MOCK_DISPLAYS, { id: 'desk', width: 4, height: 4, type: 'lcd' }, { id: 'eink', width: 4, height: 4, type: 'eink' }] });
    const { sent, send } = sink();
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }], 'missing', 'e1'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }], 'desk', 'e2'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }], 'eink', 'e3'), send);
    service.handleMessage('w1', push([], 'badge', 'e4'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }, { x: 32, y: 0, bytes: [1, 2, 3] }], 'badge', 'e5'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }, { x: 0, y: 0, bytes: [4, 5, 6] }], 'badge', 'e6'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2] }], 'badge', 'e7'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 256] }], 'badge', 'e8'), send);
    service.handleMessage('w1', push([{ x: 0.5, y: 0, bytes: [1, 2, 3] }], 'badge', 'e9'), send);
    service.handleMessage('w1', push([{ x: 0, y: 0, bytes: [1, 2, 3] }, { x: 1, y: 0, bytes: [1, 2, 3] }, { x: 2, y: 0, bytes: [1, 2, 3] }], 'badge', 'e10'), send);
    expect(sent).toEqual([
      { type: 'display.push.result', id: 'e1', error: 'not-found' },
      { type: 'display.push.result', id: 'e2', error: 'denied' },
      { type: 'display.push.result', id: 'e3', error: 'unavailable' },
      { type: 'display.push.result', id: 'e4', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e5', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e6', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e7', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e8', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e9', error: 'invalid-pixel' },
      { type: 'display.push.result', id: 'e10', error: 'too-large' },
    ]);
    expect(service.pixelAt('badge', 0, 0)).toEqual([0, 0, 0]);
    expect(service.mock.state().batches.size).toBe(0);
  });

  it('resets the framebuffer and tolerates window destruction', () => {
    const service = createMockDisplayService();
    const { send } = sink();
    service.handleMessage('w1', push([{ x: 3, y: 3, bytes: [9, 9, 9] }]), send);
    service.onWindowDestroyed?.('w1');
    expect(service.pixelAt('badge', 3, 3)).toEqual([9, 9, 9]);
    service.mock.reset();
    expect(service.pixelAt('badge', 3, 3)).toEqual([0, 0, 0]);
    expect(service.mock.state().batches.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
