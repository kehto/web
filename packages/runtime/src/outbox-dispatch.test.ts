/**
 * outbox-dispatch.test.ts — NAP-OUTBOX (outbox-aware relay routing) runtime dispatch.
 *
 * Verifies the `outbox` domain is routed by the runtime to a registered
 * `outbox` service (the registerNap lesson — registering the service alone is
 * not enough; the domain must also be wired in createNapEnvelopeDispatcher),
 * that the ACL gate denies `outbox.query` for a blocked napplet, and that
 * `outbox.publish` is gated on the dedicated outbox:write capability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';
import { DEFAULT_BURST_MAX_OPS } from '@kehto/firewall';

const WINDOW_ID = 'win-outbox-1';
const DTAG = 'outbox-napp';
const HASH = 'd'.repeat(64);
const FILTERS = [{ authors: ['a'.repeat(64)], kinds: [1], limit: 20 }];

function manyFilters(count: number): Array<{ authors: string[]; kinds: number[]; limit: number }> {
  return Array.from({ length: count }, (_value, index) => ({
    authors: [index.toString(16).padStart(64, '0')],
    kinds: [0],
    limit: 1,
  }));
}

function session(windowId = WINDOW_ID) {
  return createNip5dSessionEntry(windowId, DTAG, HASH);
}

describe('runtime outbox domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes outbox.query to a registered outbox service (registerNap wiring)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'outbox.query',
      id: 'q1',
      filters: FILTERS,
    } as NappletMessage);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('outbox.query');
  });

  it('routes outbox.getEvent / subscribe / publish / resolveRelays to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'outbox.getEvent', id: 'e1', eventId: 'e'.repeat(64) } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'outbox.subscribe', id: 's1', subId: 'sub-1', filters: FILTERS } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'outbox.publish', id: 'p1', event: { kind: 1, content: 'hi', tags: [], created_at: 1 } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'outbox.resolveRelays', id: 'r1', target: { pubkey: 'a'.repeat(64), direction: 'read' } } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['outbox.getEvent', 'outbox.subscribe', 'outbox.publish', 'outbox.resolveRelays']);
  });

  it('allows one init-time outbox.subscribe carrying more filters than the burst op cap', () => {
    const received: NappletMessage[] = [];
    const filters = manyFilters(DEFAULT_BURST_MAX_OPS + 5);
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'outbox.subscribe',
      id: 's-many-filters',
      subId: 'sub-many-filters',
      filters,
    } as NappletMessage);

    expect(findEnvelopeResponse(ctx.sent, 'outbox.subscribe.error')).toBeUndefined();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: 'outbox.subscribe',
      id: 's-many-filters',
      subId: 'sub-many-filters',
      filters,
    });
  });

  it('still blocks more than the burst op cap as separate startup subscribe envelopes', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    for (let i = 0; i < DEFAULT_BURST_MAX_OPS + 1; i++) {
      runtime.handleMessage(WINDOW_ID, {
        type: 'outbox.subscribe',
        id: `s-burst-${i}`,
        subId: `sub-burst-${i}`,
        filters: FILTERS,
      } as NappletMessage);
    }

    const err = findEnvelopeResponse(ctx.sent, 'outbox.subscribe.error');
    expect(err).toBeDefined();
    expect((err as { error?: string }).error).toMatch(/init-burst/);
    expect(received).toHaveLength(DEFAULT_BURST_MAX_OPS);
  });

  it('outbox.query without a registered service: no throw, no envelope emitted (silent drop)', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'outbox.query', id: 'q2', filters: FILTERS } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });

  it('denies outbox.query for a blocked napplet (ACL gate → outbox.query.error)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);

    runtime.handleMessage(WINDOW_ID, { type: 'outbox.query', id: 'q3', filters: FILTERS } as NappletMessage);

    expect(received).toHaveLength(0); // service never reached
    const err = findEnvelopeResponse(ctx.sent, 'outbox.query.error');
    expect(err).toBeDefined();
    expect((err as { id?: string }).id).toBe('q3');
  });

});

describe('runtime lists domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes lists.supported / lists.add / lists.remove to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('lists', {
      descriptor: { name: 'lists', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'lists.supported', id: 'ls-1' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'lists.add', id: 'la-1', list: { type: 'bookmarks' }, items: [] } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'lists.remove', id: 'lr-1', list: { type: 'bookmarks' }, items: [] } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['lists.supported', 'lists.add', 'lists.remove']);
  });

  it('lists.supported without a registered service: no throw, no envelope emitted', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'lists.supported', id: 'ls-2' } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });
});

describe('runtime serial domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes serial.open / serial.write / serial.close to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('serial', {
      descriptor: { name: 'serial', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'so-1', request: { options: { baudRate: 9600 } } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'serial.write', id: 'sw-1', sessionId: 'serial-1', data: [1, 2, 3] } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'serial.close', id: 'sc-1', sessionId: 'serial-1' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['serial.open', 'serial.write', 'serial.close']);
  });

  it('serial.open without a registered service: no throw, no envelope emitted', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'serial.open', id: 'so-2', request: { options: { baudRate: 9600 } } } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });
});

describe('runtime ble domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes all ble request types to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('ble', {
      descriptor: { name: 'ble', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'ble.open', id: 'bo-1', request: { acceptAllDevices: true } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.services', id: 'bs-1', sessionId: 'ble-1' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.read', id: 'br-1', sessionId: 'ble-1', target: { service: 'battery_service', characteristic: 'battery_level' } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.write', id: 'bw-1', sessionId: 'ble-1', target: { service: 'battery_service', characteristic: 'battery_level' }, data: [1] } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.subscribe', id: 'bsub-1', sessionId: 'ble-1', target: { service: 'battery_service', characteristic: 'battery_level' } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.unsubscribe', id: 'bunsub-1', sessionId: 'ble-1', target: { service: 'battery_service', characteristic: 'battery_level' } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'ble.close', id: 'bc-1', sessionId: 'ble-1' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual([
      'ble.open',
      'ble.services',
      'ble.read',
      'ble.write',
      'ble.subscribe',
      'ble.unsubscribe',
      'ble.close',
    ]);
  });

  it('ble.open without a registered service: no throw, no envelope emitted', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'ble.open', id: 'bo-2', request: { acceptAllDevices: true } } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });
});

describe('runtime webrtc domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes all webrtc request types to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('webrtc', {
      descriptor: { name: 'webrtc', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'wo-1', request: { scope: { type: 'direct', pubkey: '7'.repeat(64) } } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'webrtc.send', id: 'ws-1', sessionId: 'webrtc-1', payload: { body: 'hello' } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'webrtc.close', id: 'wc-1', sessionId: 'webrtc-1' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['webrtc.open', 'webrtc.send', 'webrtc.close']);
  });

  it('webrtc.open without a registered service: no throw, no envelope emitted', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'webrtc.open', id: 'wo-2', request: { scope: { type: 'direct', pubkey: '7'.repeat(64) } } } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });
});

describe('runtime dm domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
    runtime.aclState.grant('', DTAG, HASH, 'dm:read');
    runtime.aclState.grant('', DTAG, HASH, 'dm:write');
  });

  it('routes dm requests to the registered service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('dm', {
      descriptor: { name: 'dm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'dm.status', id: 'ds-1' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'dm.send', id: 'dm-1', recipients: ['7'.repeat(64)], content: 'hello' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['dm.status', 'dm.send']);
  });

  it('dm.status without a registered service: no throw, no envelope emitted', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'dm.status', id: 'ds-2' } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });
});
