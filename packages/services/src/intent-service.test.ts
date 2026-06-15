/**
 * intent-service.test.ts — NAP-INTENT envelope-router service.
 *
 * Exercises createIntentService against a mock IntentResolver: invoke/available/
 * handlers result marshalling, structural validation, error surfacing, and the
 * intent.changed broadcast fan-out across served windows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIntentService } from './intent-service.js';
import type { IntentResolver } from './intent-service.js';
import type { IntentAvailability, IntentResult } from './intent-types.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW = 'win-1';

const RESULT: IntentResult = {
  ok: true,
  archetype: 'note',
  action: 'open',
  handled: true,
  handler: 'noteview',
  windowId: 'win-12',
  protocol: 'NAP-4',
};

const AVAILABILITY: IntentAvailability = {
  archetype: 'note',
  available: true,
  candidates: [{ dTag: 'noteview', title: 'Note', actions: ['open'], protocols: ['NAP-4'], isDefault: true }],
  hasDefault: true,
};

interface MockResolver extends IntentResolver {
  emitChanged: (availability: IntentAvailability) => void;
}

function mockResolver(overrides: Partial<IntentResolver> = {}): MockResolver {
  let changeListener: ((a: IntentAvailability) => void) | null = null;
  const resolver: MockResolver = {
    invoke: vi.fn(async (): Promise<IntentResult> => RESULT),
    available: vi.fn(async (): Promise<IntentAvailability> => AVAILABILITY),
    handlers: vi.fn(async (): Promise<IntentAvailability[]> => [AVAILABILITY]),
    onChanged: vi.fn((listener: (a: IntentAvailability) => void) => {
      changeListener = listener;
      return () => { changeListener = null; };
    }),
    emitChanged: (a) => changeListener?.(a),
    ...overrides,
  };
  return resolver;
}

function collector() {
  const sent: NappletMessage[] = [];
  return { sent, send: (m: NappletMessage) => { sent.push(m); } };
}

describe('createIntentService', () => {
  it('throws when resolver is missing', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createIntentService({})).toThrow(/resolver is required/);
  });

  it('exposes the intent descriptor', () => {
    const svc = createIntentService({ resolver: mockResolver() });
    expect(svc.descriptor.name).toBe('intent');
  });

  describe('intent.invoke', () => {
    let resolver: MockResolver;
    let svc: ReturnType<typeof createIntentService>;
    let c: ReturnType<typeof collector>;

    beforeEach(() => {
      resolver = mockResolver();
      svc = createIntentService({ resolver });
      c = collector();
    });

    it('forwards the request (with caller windowId) and returns invoke.result', async () => {
      const request = { archetype: 'note', action: 'open', payload: { target: 'abc' } };
      svc.handleMessage(WINDOW, { type: 'intent.invoke', id: 'i1', request } as NappletMessage, c.send);
      await Promise.resolve();
      expect(resolver.invoke).toHaveBeenCalledWith(request, { windowId: WINDOW });
      expect(c.sent).toHaveLength(1);
      expect(c.sent[0]).toMatchObject({ type: 'intent.invoke.result', id: 'i1', result: RESULT });
    });

    it('rejects a request with no archetype as "invalid request"', () => {
      svc.handleMessage(WINDOW, { type: 'intent.invoke', id: 'i2', request: { action: 'open' } } as NappletMessage, c.send);
      expect(resolver.invoke).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'intent.invoke.result', id: 'i2', error: 'invalid request' });
    });

    it('rejects a missing request as "invalid request"', () => {
      svc.handleMessage(WINDOW, { type: 'intent.invoke', id: 'i3' } as NappletMessage, c.send);
      expect(resolver.invoke).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'intent.invoke.result', id: 'i3', error: 'invalid request' });
    });

    it('surfaces a resolver rejection as a top-level error (no result)', async () => {
      resolver.invoke = vi.fn(async () => { throw new Error('window manager unavailable'); });
      svc.handleMessage(WINDOW, { type: 'intent.invoke', id: 'i4', request: { archetype: 'note' } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'intent.invoke.result', id: 'i4', error: 'window manager unavailable' });
      expect(c.sent[0]).not.toHaveProperty('result');
    });

    it('carries a structured ok:false result through the result field', async () => {
      resolver.invoke = vi.fn(async (): Promise<IntentResult> => ({ ok: false, archetype: 'note', action: 'open', handled: false, error: 'no handler' }));
      svc.handleMessage(WINDOW, { type: 'intent.invoke', id: 'i5', request: { archetype: 'note' } } as NappletMessage, c.send);
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'intent.invoke.result', id: 'i5', result: { ok: false, error: 'no handler' } });
    });
  });

  describe('intent.available', () => {
    let resolver: MockResolver;
    let svc: ReturnType<typeof createIntentService>;
    let c: ReturnType<typeof collector>;

    beforeEach(() => {
      resolver = mockResolver();
      svc = createIntentService({ resolver });
      c = collector();
    });

    it('returns availability for an archetype', async () => {
      svc.handleMessage(WINDOW, { type: 'intent.available', id: 'a1', archetype: 'note' } as NappletMessage, c.send);
      await Promise.resolve();
      expect(resolver.available).toHaveBeenCalledWith('note');
      expect(c.sent[0]).toEqual({ type: 'intent.available.result', id: 'a1', availability: AVAILABILITY });
    });

    it('rejects a missing archetype as "invalid archetype"', () => {
      svc.handleMessage(WINDOW, { type: 'intent.available', id: 'a2' } as NappletMessage, c.send);
      expect(resolver.available).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'intent.available.result', id: 'a2', error: 'invalid archetype' });
    });

    it('surfaces a resolver rejection as an error', async () => {
      resolver.available = vi.fn(async () => { throw new Error('catalog unavailable'); });
      svc.handleMessage(WINDOW, { type: 'intent.available', id: 'a3', archetype: 'note' } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'intent.available.result', id: 'a3', error: 'catalog unavailable' });
    });
  });

  describe('intent.handlers', () => {
    it('returns availability for every archetype', async () => {
      const resolver = mockResolver();
      const svc = createIntentService({ resolver });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'intent.handlers', id: 'h1' } as NappletMessage, c.send);
      await Promise.resolve();
      expect(resolver.handlers).toHaveBeenCalled();
      expect(c.sent[0]).toEqual({ type: 'intent.handlers.result', id: 'h1', handlers: [AVAILABILITY] });
    });

    it('surfaces a resolver rejection as an error', async () => {
      const resolver = mockResolver({ handlers: vi.fn(async () => { throw new Error('boom'); }) });
      const svc = createIntentService({ resolver });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'intent.handlers', id: 'h2' } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'intent.handlers.result', id: 'h2', error: 'boom' });
    });
  });

  describe('intent.changed broadcast', () => {
    it('fans a resolver change out to every served window', () => {
      const resolver = mockResolver();
      const svc = createIntentService({ resolver });
      const a = collector();
      const b = collector();
      // Two windows interact with the intent domain → both are served.
      svc.handleMessage('win-a', { type: 'intent.handlers', id: 'h' } as NappletMessage, a.send);
      svc.handleMessage('win-b', { type: 'intent.handlers', id: 'h' } as NappletMessage, b.send);

      resolver.emitChanged(AVAILABILITY);

      expect(a.sent.at(-1)).toEqual({ type: 'intent.changed', availability: AVAILABILITY });
      expect(b.sent.at(-1)).toEqual({ type: 'intent.changed', availability: AVAILABILITY });
    });

    it('stops pushing to a destroyed window', () => {
      const resolver = mockResolver();
      const svc = createIntentService({ resolver });
      const a = collector();
      svc.handleMessage('win-a', { type: 'intent.handlers', id: 'h' } as NappletMessage, a.send);
      svc.onWindowDestroyed?.('win-a');

      resolver.emitChanged(AVAILABILITY);

      expect(a.sent.some((m) => m.type === 'intent.changed')).toBe(false);
    });
  });

  it('silently ignores unknown intent.* actions', () => {
    const svc = createIntentService({ resolver: mockResolver() });
    const c = collector();
    expect(() => svc.handleMessage(WINDOW, { type: 'intent.bogus', id: 'x' } as NappletMessage, c.send)).not.toThrow();
    expect(c.sent).toHaveLength(0);
  });
});
