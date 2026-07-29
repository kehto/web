/**
 * intent-dispatch.test.ts — NAP-INTENT (archetype intent dispatch) runtime dispatch.
 *
 * Verifies the `intent` domain is routed by the runtime to a registered
 * `intent` service (the registerNap lesson — registering the service alone is
 * not enough; the domain must also be wired in createNapEnvelopeDispatcher),
 * and that the ACL gate denies `intent.available` for a blocked napplet.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler, ServiceRuntimeContext } from './types.js';

const WINDOW_ID = 'win-intent-1';
const DTAG = 'intent-napp';
const HASH = 'e'.repeat(64);
const REQUEST = {
  archetype: 'note',
  action: 'open',
  convention: 'napplet:note/open',
  payload: { target: 'abc' },
};
const TARGET_WINDOW_ID = 'win-intent-target';
const TARGET_DTAG = 'intent-target';
const TARGET_HASH = 'f'.repeat(64);

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

  describe('service runtime context', () => {
    it('attaches both adapter and dynamic services to narrow current runtime access', () => {
      let adapterContext: ServiceRuntimeContext | undefined;
      let dynamicContext: ServiceRuntimeContext | undefined;
      const adapterService: ServiceHandler = {
        descriptor: { name: 'adapter', version: '1.0.0' },
        handleMessage() {},
        onRegistered(context) {
          adapterContext = context;
        },
      };
      const dynamicService: ServiceHandler = {
        descriptor: { name: 'dynamic', version: '1.0.0' },
        handleMessage() {},
        onRegistered(context) {
          dynamicContext = context;
        },
      };
      const localCtx = createMockRuntimeAdapter({ services: { adapter: adapterService } });
      const localRuntime = createRuntime(localCtx.hooks);
      localRuntime.sessionRegistry.register(WINDOW_ID, session());

      expect(adapterContext).toBeDefined();
      expect(Object.isFrozen(adapterContext)).toBe(true);
      expect(adapterContext?.resolveDTag(WINDOW_ID)).toBe(DTAG);
      expect(adapterContext?.resolveDTag('missing')).toBeUndefined();
      expect(adapterContext?.listWindowIds()).toEqual([WINDOW_ID]);
      expect(Object.isFrozen(adapterContext?.listWindowIds())).toBe(true);
      expect(adapterContext).not.toHaveProperty('hooks');
      expect(adapterContext).not.toHaveProperty('sessionRegistry');
      expect(adapterContext).not.toHaveProperty('aclState');
      expect(adapterContext).not.toHaveProperty('sendToNapplet');

      localRuntime.registerService('dynamic', dynamicService);
      expect(dynamicContext).toBeDefined();
      expect(dynamicContext).toBe(adapterContext);
    });

    it('sends only recipient-mapped messages to a live domain-and-ACL-eligible target', () => {
      let context: ServiceRuntimeContext | undefined;
      let intentDomainAllowed = true;
      const service: ServiceHandler = {
        descriptor: { name: 'tracer', version: '1.0.0' },
        handleMessage() {},
        onRegistered(value) {
          context = value;
        },
      };
      const localCtx = createMockRuntimeAdapter({
        isDomainAllowed: (_windowId, domain) => domain === 'intent' && intentDomainAllowed,
      });
      const localRuntime = createRuntime(localCtx.hooks);
      localRuntime.sessionRegistry.register(WINDOW_ID, session());
      localRuntime.sessionRegistry.register(
        TARGET_WINDOW_ID,
        createNip5dSessionEntry(TARGET_WINDOW_ID, TARGET_DTAG, TARGET_HASH),
      );
      localRuntime.registerService('tracer', service);
      const changed = {
        type: 'intent.changed',
        availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
      } as NappletMessage;

      expect(context?.sendToEligibleNapplet(TARGET_WINDOW_ID, changed)).toBe(true);
      expect(localCtx.sent).toEqual([{ windowId: TARGET_WINDOW_ID, message: changed }]);

      localCtx.sent.length = 0;
      expect(context?.sendToEligibleNapplet('missing', changed)).toBe(false);
      expect(
        context?.sendToEligibleNapplet(
          TARGET_WINDOW_ID,
          { type: 'intent.invoke', id: 'source-only', request: REQUEST } as NappletMessage,
        ),
      ).toBe(false);
      expect(localCtx.sent).toHaveLength(0);

      intentDomainAllowed = false;
      expect(context?.sendToEligibleNapplet(TARGET_WINDOW_ID, changed)).toBe(false);
      expect(localCtx.sent).toHaveLength(0);

      intentDomainAllowed = true;
      localRuntime.aclState.revoke('', TARGET_DTAG, TARGET_HASH, 'intent:read');
      expect(context?.sendToEligibleNapplet(TARGET_WINDOW_ID, changed)).toBe(false);
      expect(localCtx.sent).toHaveLength(0);
    });

    it('detaches replaced, unregistered, and remaining services exactly once', () => {
      const initialRegistered = vi.fn();
      const initialUnregistered = vi.fn();
      const replacementRegistered = vi.fn();
      const replacementUnregistered = vi.fn();
      const remainingUnregistered = vi.fn();
      const initial: ServiceHandler = {
        descriptor: { name: 'initial', version: '1.0.0' },
        handleMessage() {},
        onRegistered: initialRegistered,
        onUnregistered: initialUnregistered,
      };
      const replacement: ServiceHandler = {
        descriptor: { name: 'replacement', version: '1.0.0' },
        handleMessage() {},
        onRegistered: replacementRegistered,
        onUnregistered: replacementUnregistered,
      };
      const remaining: ServiceHandler = {
        descriptor: { name: 'remaining', version: '1.0.0' },
        handleMessage() {},
        onUnregistered: remainingUnregistered,
      };
      const localCtx = createMockRuntimeAdapter({ services: { intent: initial } });
      const localRuntime = createRuntime(localCtx.hooks);

      expect(initialRegistered).toHaveBeenCalledOnce();
      localRuntime.registerService('intent', replacement);
      expect(initialUnregistered).toHaveBeenCalledOnce();
      expect(replacementRegistered).toHaveBeenCalledOnce();

      localRuntime.unregisterService('intent');
      localRuntime.unregisterService('intent');
      expect(replacementUnregistered).toHaveBeenCalledOnce();

      localRuntime.registerService('remaining', remaining);
      localRuntime.destroy();
      localRuntime.destroy();
      expect(remainingUnregistered).toHaveBeenCalledOnce();
    });
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

  it('returns canonical unavailable results when no intent service is registered', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, { type: 'intent.invoke', id: 'i2', request: REQUEST } as NappletMessage);
    }).not.toThrow();
    runtime.handleMessage(WINDOW_ID, { type: 'intent.available', id: 'a2', archetype: 'note' } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'intent.handlers', id: 'h2' } as NappletMessage);
    expect(ctx.sent).toEqual([
      {
        windowId: WINDOW_ID,
        message: {
          type: 'intent.invoke.result',
          id: 'i2',
          result: { ok: false, archetype: 'note', action: 'open', handled: false, error: 'no handler' },
        },
      },
      {
        windowId: WINDOW_ID,
        message: {
          type: 'intent.available.result',
          id: 'a2',
          availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
        },
      },
      { windowId: WINDOW_ID, message: { type: 'intent.handlers.result', id: 'h2', handlers: [] } },
    ]);
  });

  it('shapes ACL-denied intent.invoke as one fixed structured result', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.revoke('', DTAG, HASH, 'intent:write');

    runtime.handleMessage(
      WINDOW_ID,
      { type: 'intent.invoke', id: 'i-denied', request: REQUEST } as NappletMessage,
    );

    expect(received).toHaveLength(0);
    expect(ctx.sent).toEqual([{
      windowId: WINDOW_ID,
      message: {
        type: 'intent.invoke.result',
        id: 'i-denied',
        result: { ok: false, archetype: 'note', action: 'open', handled: false, error: 'invoke rejected' },
      },
    }]);
  });

  it('shapes firewall-denied intent.invoke identically without policy detail', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.firewallState.setPolicy(DTAG, 'deny');

    runtime.handleMessage(
      WINDOW_ID,
      { type: 'intent.invoke', id: 'i-firewall', request: REQUEST } as NappletMessage,
    );

    expect(received).toHaveLength(0);
    expect(ctx.sent).toEqual([{
      windowId: WINDOW_ID,
      message: {
        type: 'intent.invoke.result',
        id: 'i-firewall',
        result: { ok: false, archetype: 'note', action: 'open', handled: false, error: 'invoke rejected' },
      },
    }]);
  });

  it('uses sanctioned result envelopes for denied availability and handlers', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.revoke('', DTAG, HASH, 'intent:read');

    runtime.handleMessage(
      WINDOW_ID,
      { type: 'intent.available', id: 'a-denied', archetype: 'note' } as NappletMessage,
    );
    runtime.handleMessage(
      WINDOW_ID,
      { type: 'intent.handlers', id: 'h-denied' } as NappletMessage,
    );

    expect(received).toHaveLength(0);
    expect(ctx.sent).toEqual([
      {
        windowId: WINDOW_ID,
        message: {
          type: 'intent.available.result',
          id: 'a-denied',
          error: 'intent request denied',
        },
      },
      {
        windowId: WINDOW_ID,
        message: {
          type: 'intent.handlers.result',
          id: 'h-denied',
          error: 'intent request denied',
        },
      },
    ]);
  });

  it('silently drops source-sent intent pushes, results, and unknown actions', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('intent', {
      descriptor: { name: 'intent', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    const sourceMessages = [
      { type: 'intent.changed', availability: {} },
      { type: 'intent.invoke.result', id: 'i', result: { ok: false, error: 'forged' } },
      { type: 'intent.available.result', id: 'a', availability: {} },
      { type: 'intent.handlers.result', id: 'h', handlers: [] },
      { type: 'intent.unknown', id: 'u' },
    ] as unknown as NappletMessage[];

    for (const message of sourceMessages) runtime.handleMessage(WINDOW_ID, message);

    expect(received).toHaveLength(0);
    expect(ctx.sent).toHaveLength(0);
  });
});
