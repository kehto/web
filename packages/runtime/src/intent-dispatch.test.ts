/**
 * intent-dispatch.test.ts — NAP-INTENT (archetype intent dispatch) runtime dispatch.
 *
 * Verifies the `intent` domain is routed by the runtime to a registered
 * `intent` service (the registerNap lesson — registering the service alone is
 * not enough; the domain must also be wired in createNapEnvelopeDispatcher),
 * and that the ACL gate denies `intent.available` for a blocked napplet.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW_ID = 'win-intent-1';
const DTAG = 'intent-napp';
const HASH = 'e'.repeat(64);
const REQUEST = { archetype: 'note', action: 'open', payload: { target: 'abc' } };

function session(windowId = WINDOW_ID) {
  return createNip5dSessionEntry(windowId, DTAG, HASH);
}

describe('runtime intent domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes intent.invoke to a registered intent service (registerNap wiring)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'intent.invoke',
      id: 'i1',
      request: REQUEST,
    } as NappletMessage);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('intent.invoke');
  });

  it('routes intent.available / intent.handlers to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'intent.available', id: 'a1', archetype: 'note' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'intent.handlers', id: 'h1' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['intent.available', 'intent.handlers']);
  });

  it('intent.invoke without a registered service: no throw, no envelope emitted (silent drop)', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'intent.invoke', id: 'i2', request: REQUEST } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });

  it('denies intent.available for a blocked napplet (ACL gate → intent.available.error)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);

    runtime.handleMessage(WINDOW_ID, { type: 'intent.available', id: 'a2', archetype: 'note' } as NappletMessage);

    expect(received).toHaveLength(0); // service never reached
    const err = findEnvelopeResponse(ctx.sent, 'intent.available.error');
    expect(err).toBeDefined();
    expect((err as { id?: string }).id).toBe('a2');
  });

});
