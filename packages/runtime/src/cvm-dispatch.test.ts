/**
 * cvm-dispatch.test.ts — NAP-CVM (ContextVM bridge) runtime dispatch.
 *
 * Verifies the `cvm` domain is routed by the runtime to a registered `cvm`
 * service (the registerNap lesson — registering the service alone is not
 * enough; the domain must also be wired in createNapEnvelopeDispatcher), and
 * that the ACL gate denies every NAP-CVM request on its matching `.result`.
 *
 * NAP-CVM napplet/naps#31 @ 28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f, Error
 * Handling: "There are no `cvm.*.error` messages; ACL denial returns the
 * matching `.result` with `error: "policy denied"`. On a shell error, success
 * payload fields MUST be omitted." and "Truly unknown message types retain the
 * silent-ignore behavior defined by NIP-5D."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import { createDenialResponse } from './legacy-firewall-gate.js';
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

  const REQUESTS: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['cvm.discover', {}],
    ['cvm.request', { server: SERVER, message: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }],
    ['cvm.close', { server: SERVER }],
    ['cvm.registry.list', {}],
    ['cvm.registry.has', { selector: { family: 'relatr' } }],
    ['cvm.registry.describe', { selector: { family: 'relatr' } }],
    ['cvm.registry.call', { selector: { family: 'relatr' }, tool: 'score' }],
  ];

  it.each(REQUESTS)('denies %s for a blocked napplet on its matching .result', (type, payload) => {
    const received: NappletMessage[] = [];
    runtime.registerService('cvm', {
      descriptor: { name: 'cvm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);

    runtime.handleMessage(WINDOW_ID, { type, id: 'denied-1', ...payload } as NappletMessage);

    expect(received).toHaveLength(0); // service never reached
    // Exactly one reply, with no success payload (`has`, `servers`, …).
    expect(ctx.sent.map((sent) => sent.message)).toEqual([
      { type: `${type}.result`, id: 'denied-1', error: 'policy denied' },
    ]);
  });

  it('stays silent when an unknown cvm.* type is denied', () => {
    runtime.aclState.block('', DTAG, HASH);
    runtime.handleMessage(WINDOW_ID, { type: 'cvm.bogus', id: 'x' } as NappletMessage);
    expect(ctx.sent).toEqual([]);
  });

  it.each(REQUESTS)('projects a legacy Firewall rejection of %s the same way', (type, payload) => {
    expect(createDenialResponse({ type, id: 'fw-1', ...payload } as NappletMessage, 'firewall: rate limited'))
      .toEqual({ type: `${type}.result`, id: 'fw-1', error: 'policy denied' });
  });
});
