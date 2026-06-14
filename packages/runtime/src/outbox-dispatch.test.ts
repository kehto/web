/**
 * outbox-dispatch.test.ts — NAP-OUTBOX (outbox-aware relay routing) runtime dispatch.
 *
 * Verifies the `outbox` domain is routed by the runtime to a registered
 * `outbox` service (the registerNub lesson — registering the service alone is
 * not enough; the domain must also be wired in createNubEnvelopeDispatcher),
 * that the ACL gate denies `outbox.query` for a blocked napplet, and that
 * `outbox.publish` is gated on the dedicated outbox:write capability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW_ID = 'win-outbox-1';
const DTAG = 'outbox-napp';
const HASH = 'd'.repeat(64);
const FILTERS = [{ authors: ['a'.repeat(64)], kinds: [1], limit: 20 }];

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

  it('routes outbox.query to a registered outbox service (registerNub wiring)', () => {
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

  it('routes outbox.subscribe / outbox.publish / outbox.resolveRelays to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'outbox.subscribe', id: 's1', subId: 'sub-1', filters: FILTERS } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'outbox.publish', id: 'p1', event: { kind: 1, content: 'hi', tags: [], created_at: 1 } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'outbox.resolveRelays', id: 'r1', target: { pubkey: 'a'.repeat(64), direction: 'read' } } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['outbox.subscribe', 'outbox.publish', 'outbox.resolveRelays']);
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

  it('denies outbox.publish for a class-2 napplet (outbox:write is class-1 only)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.sessionRegistry.register(WINDOW_ID, { ...session(), class: 'class-2' });

    runtime.handleMessage(WINDOW_ID, {
      type: 'outbox.publish',
      id: 'p2',
      event: { kind: 1, content: 'hi', tags: [], created_at: 1 },
    } as NappletMessage);

    expect(received).toHaveLength(0); // class pre-filter refuses before service
    const err = findEnvelopeResponse(ctx.sent, 'outbox.publish.error');
    expect(err).toBeDefined();
    expect((err as { id?: string }).id).toBe('p2');
  });

  it('allows outbox.query for a class-2 napplet (outbox:read is permitted)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('outbox', {
      descriptor: { name: 'outbox', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.sessionRegistry.register(WINDOW_ID, { ...session(), class: 'class-2' });

    runtime.handleMessage(WINDOW_ID, { type: 'outbox.query', id: 'q4', filters: FILTERS } as NappletMessage);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('outbox.query');
  });
});
