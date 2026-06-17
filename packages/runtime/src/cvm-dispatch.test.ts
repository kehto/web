/**
 * cvm-dispatch.test.ts — NAP-CVM (ContextVM bridge) runtime dispatch.
 *
 * Verifies the `cvm` domain is routed by the runtime to a registered `cvm`
 * service (the registerNap lesson — registering the service alone is not
 * enough; the domain must also be wired in createNapEnvelopeDispatcher), and
 * that the ACL gate denies `cvm.request` for a blocked napplet.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW_ID = 'win-cvm-1';
const DTAG = 'cvm-napp';
const HASH = 'c'.repeat(64);
const SERVER = { pubkey: 'a'.repeat(64), relays: ['wss://relay.test'] };

function session(windowId = WINDOW_ID) {
  return createNip5dSessionEntry(windowId, DTAG, HASH);
}

describe('runtime cvm domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes cvm.request to a registered cvm service (registerNap wiring)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('cvm', {
      descriptor: { name: 'cvm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'cvm.request',
      id: 'r1',
      server: SERVER,
      message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    } as NappletMessage);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('cvm.request');
  });

  it('routes cvm.discover to the registered cvm service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('cvm', {
      descriptor: { name: 'cvm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'cvm.discover', id: 'd1' } as NappletMessage);
    expect(received.map((m) => m.type)).toEqual(['cvm.discover']);
  });

  it('cvm.request without a registered service: no throw, no envelope emitted (silent drop)', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'cvm.request',
        id: 'r2',
        server: SERVER,
        message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });

  it('denies cvm.request for a blocked napplet (ACL gate → cvm.request.error)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('cvm', {
      descriptor: { name: 'cvm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);

    runtime.handleMessage(WINDOW_ID, {
      type: 'cvm.request',
      id: 'r3',
      server: SERVER,
      message: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    } as NappletMessage);

    expect(received).toHaveLength(0); // service never reached
    const err = findEnvelopeResponse(ctx.sent, 'cvm.request.error');
    expect(err).toBeDefined();
    expect((err as { id?: string }).id).toBe('r3');
  });
});
