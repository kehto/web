/**
 * outbox-service.test.ts — NAP-OUTBOX envelope-router service.
 *
 * Exercises createOutboxService against a mock OutboxRouter: getEvent/query/
 * publish/resolveRelays result marshalling, subscription event/closed
 * streaming, close + window-teardown cleanup, and structural validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOutboxService } from './outbox-service.js';
import type {
  OutboxRouter,
  OutboxEventResult,
  OutboxResult,
  OutboxPublishResult,
  OutboxRelayPlan,
  OutboxSubscriptionSink,
  OutboxRouterSubscription,
} from './outbox-service.js';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { RelayEventResult } from '@kehto/runtime';

const WINDOW = 'win-1';
const EVENT: NostrEvent = {
  id: 'e'.repeat(64),
  pubkey: 'a'.repeat(64),
  kind: 1,
  content: 'hello',
  tags: [],
  created_at: 1234567890,
  sig: 'f'.repeat(128),
};
const RESULT: RelayEventResult = {
  event: EVENT,
  sidecar: { relayHints: ['wss://r.test'] },
};

interface MockRouter extends OutboxRouter {
  lastSink: OutboxSubscriptionSink | null;
  subClose: ReturnType<typeof vi.fn>;
}

function mockRouter(overrides: Partial<OutboxRouter> = {}): MockRouter {
  const subClose = vi.fn();
  const router: MockRouter = {
    lastSink: null,
    subClose,
    getEvent: vi.fn(async (): Promise<OutboxEventResult> => ({ result: RESULT })),
    query: vi.fn(async (): Promise<OutboxResult> => ({ events: [RESULT] })),
    subscribe: vi.fn((_filters, _options, sink): OutboxRouterSubscription => {
      router.lastSink = sink;
      return { close: subClose };
    }),
    publish: vi.fn(async (): Promise<OutboxPublishResult> => ({ ok: true, event: EVENT, eventId: EVENT.id, relays: { 'wss://r.test': true } })),
    resolveRelays: vi.fn(async (): Promise<OutboxRelayPlan> => ({ relays: ['wss://r.test'], source: 'nip65' })),
    ...overrides,
  };
  return router;
}

function collector() {
  const sent: NappletMessage[] = [];
  return { sent, send: (m: NappletMessage) => { sent.push(m); } };
}

describe('createOutboxService', () => {
  it('throws when router is missing', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => createOutboxService({})).toThrow(/router is required/);
  });

  it('exposes the outbox descriptor', () => {
    const svc = createOutboxService({ router: mockRouter() });
    expect(svc.descriptor.name).toBe('outbox');
  });

  describe('outbox.getEvent', () => {
    it('passes event id and options to the router and returns getEvent.result', async () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();

      svc.handleMessage(WINDOW, {
        type: 'outbox.getEvent',
        id: 'e1',
        eventId: EVENT.id,
        options: { author: EVENT.pubkey, timeoutMs: 1000 },
      } as NappletMessage, c.send);
      await Promise.resolve();

      expect(router.getEvent).toHaveBeenCalledWith(EVENT.id, { author: EVENT.pubkey, timeoutMs: 1000 });
      expect(c.sent[0]).toEqual({
        type: 'outbox.getEvent.result',
        id: 'e1',
        result: RESULT,
      });
    });

    it('falls back to query when a router has not implemented getEvent yet', async () => {
      const router = mockRouter();
      delete router.getEvent;
      const svc = createOutboxService({ router });
      const c = collector();

      svc.handleMessage(WINDOW, {
        type: 'outbox.getEvent',
        id: 'e2',
        eventId: EVENT.id,
        options: { author: EVENT.pubkey, relays: ['wss://hint.test'], timeoutMs: 500 },
      } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();

      expect(router.query).toHaveBeenCalledWith(
        [{ ids: [EVENT.id], authors: [EVENT.pubkey] }],
        { limit: 1, authors: [EVENT.pubkey], relays: ['wss://hint.test'], timeoutMs: 500 },
      );
      expect(c.sent[0]).toMatchObject({
        type: 'outbox.getEvent.result',
        id: 'e2',
        result: RESULT,
      });
    });

    it('does not leak a router result whose event id does not match the request', async () => {
      const wrong = { ...EVENT, id: 'b'.repeat(64) };
      const router = mockRouter({
        getEvent: vi.fn(async () => ({ result: { event: wrong } })),
      });
      const svc = createOutboxService({ router });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'outbox.getEvent', id: 'e3', eventId: EVENT.id } as NappletMessage, c.send);
      await Promise.resolve();

      expect(c.sent[0]).toEqual({ type: 'outbox.getEvent.result', id: 'e3', error: 'not found' });
    });

    it('rejects a missing eventId as "invalid filter"', () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();

      svc.handleMessage(WINDOW, { type: 'outbox.getEvent', id: 'e4' } as NappletMessage, c.send);

      expect(router.getEvent).not.toHaveBeenCalled();
      expect(router.query).not.toHaveBeenCalled();
      expect(c.sent[0]).toEqual({ type: 'outbox.getEvent.result', id: 'e4', error: 'invalid filter' });
    });
  });

  describe('outbox.query', () => {
    let router: MockRouter;
    let svc: ReturnType<typeof createOutboxService>;
    let c: ReturnType<typeof collector>;

    beforeEach(() => {
      router = mockRouter();
      svc = createOutboxService({ router });
      c = collector();
    });

    it('normalizes a single filter to an array and returns query.result', async () => {
      svc.handleMessage(WINDOW, { type: 'outbox.query', id: 'q1', filters: { kinds: [1] } } as NappletMessage, c.send);
      await Promise.resolve();
      expect(router.query).toHaveBeenCalledWith([{ kinds: [1] }], undefined);
      expect(c.sent).toHaveLength(1);
      expect(c.sent[0]).toMatchObject({ type: 'outbox.query.result', id: 'q1', events: [RESULT] });
    });

    it('passes options through and forwards incomplete + error fields', async () => {
      router.query = vi.fn(async () => ({ events: [], incomplete: true, error: 'relay timeout' }));
      svc.handleMessage(WINDOW, {
        type: 'outbox.query',
        id: 'q2',
        filters: [{ authors: ['ab'] }],
        options: { authors: ['ab'], timeoutMs: 1000 },
      } as NappletMessage, c.send);
      await Promise.resolve();
      expect(router.query).toHaveBeenCalledWith([{ authors: ['ab'] }], { authors: ['ab'], timeoutMs: 1000 });
      expect(c.sent[0]).toMatchObject({ type: 'outbox.query.result', id: 'q2', incomplete: true, error: 'relay timeout' });
    });

    it('rejects a query with no usable filters as "invalid filter"', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.query', id: 'q3', filters: [] } as NappletMessage, c.send);
      expect(router.query).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.query.result', id: 'q3', events: [], error: 'invalid filter' });
    });

    it('surfaces a router rejection as an inline error (promise still resolves shell-side)', async () => {
      router.query = vi.fn(async () => { throw new Error('relay list unavailable'); });
      svc.handleMessage(WINDOW, { type: 'outbox.query', id: 'q4', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.query.result', id: 'q4', events: [], error: 'relay list unavailable' });
    });
  });

  describe('outbox.subscribe / event / close', () => {
    let router: MockRouter;
    let svc: ReturnType<typeof createOutboxService>;
    let c: ReturnType<typeof collector>;

    beforeEach(() => {
      router = mockRouter();
      svc = createOutboxService({ router });
      c = collector();
    });

    it('streams event results through the sink without outbox.eose', () => {
      svc.handleMessage(WINDOW, {
        type: 'outbox.subscribe',
        id: 's1',
        subId: 'sub-1',
        filters: [{ kinds: [1] }],
        options: { relays: ['wss://hint.test'] },
      } as NappletMessage, c.send);
      expect(router.subscribe).toHaveBeenCalledWith(
        [{ kinds: [1] }],
        { relays: ['wss://hint.test'] },
        expect.any(Object),
      );

      router.lastSink!.event(RESULT);

      expect(c.sent).toEqual([
        { type: 'outbox.event', subId: 'sub-1', result: RESULT },
      ]);
    });

    it('omits the sidecar when the router does not attribute one', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's2', subId: 'sub-2', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      router.lastSink!.event({ event: EVENT });
      expect(c.sent[0]).toEqual({ type: 'outbox.event', subId: 'sub-2', result: { event: EVENT } });
    });

    it('sends outbox.closed with reason on invalid subscribe filters', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's3', subId: 'sub-3', filters: 42 } as unknown as NappletMessage, c.send);
      expect(router.subscribe).not.toHaveBeenCalled();
      expect(c.sent[0]).toEqual({ type: 'outbox.closed', subId: 'sub-3', reason: 'invalid filter' });
    });

    it('ignores a subscribe without a subId', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's4', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      expect(router.subscribe).not.toHaveBeenCalled();
      expect(c.sent).toHaveLength(0);
    });

    it('outbox.close stops the router subscription and confirms with outbox.closed', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's5', subId: 'sub-5', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      svc.handleMessage(WINDOW, { type: 'outbox.close', id: 'c5', subId: 'sub-5' } as NappletMessage, c.send);
      expect(router.subClose).toHaveBeenCalledTimes(1);
      expect(c.sent.at(-1)).toEqual({ type: 'outbox.closed', subId: 'sub-5' });
    });

    it('a router-initiated closed() drops local tracking and forwards the reason', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's6', subId: 'sub-6', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      router.lastSink!.closed('upstream gone');
      expect(c.sent.at(-1)).toEqual({ type: 'outbox.closed', subId: 'sub-6', reason: 'upstream gone' });
      // A subsequent close() is a no-op (already untracked) but still acks.
      router.subClose.mockClear();
      svc.handleMessage(WINDOW, { type: 'outbox.close', id: 'c6', subId: 'sub-6' } as NappletMessage, c.send);
      expect(router.subClose).not.toHaveBeenCalled();
    });

    it('replacing a subId closes the prior subscription', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's7', subId: 'dup', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 's7b', subId: 'dup', filters: [{ kinds: [2] }] } as NappletMessage, c.send);
      expect(router.subClose).toHaveBeenCalledTimes(1);
      expect(router.subscribe).toHaveBeenCalledTimes(2);
    });

    it('onWindowDestroyed closes all of a window\'s subscriptions', () => {
      svc.handleMessage(WINDOW, { type: 'outbox.subscribe', id: 'a', subId: 's-a', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      svc.handleMessage('other', { type: 'outbox.subscribe', id: 'b', subId: 's-b', filters: [{ kinds: [1] }] } as NappletMessage, c.send);
      svc.onWindowDestroyed?.(WINDOW);
      expect(router.subClose).toHaveBeenCalledTimes(1); // only WINDOW's sub closed
    });
  });

  describe('outbox.publish', () => {
    it('marshals a successful publish result', async () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();
      const template = { kind: 1, content: 'hi', tags: [], created_at: 1 };
      svc.handleMessage(WINDOW, {
        type: 'outbox.publish',
        id: 'p1',
        event: template,
        options: { targetAuthors: [EVENT.pubkey] },
      } as NappletMessage, c.send);
      await Promise.resolve();
      expect(router.publish).toHaveBeenCalledWith(template, { targetAuthors: [EVENT.pubkey] });
      expect(c.sent[0]).toMatchObject({ type: 'outbox.publish.result', id: 'p1', ok: true, eventId: EVENT.id, relays: { 'wss://r.test': true } });
    });

    it('rejects a publish with no template as "invalid filter"', () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'outbox.publish', id: 'p2' } as NappletMessage, c.send);
      expect(router.publish).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.publish.result', id: 'p2', ok: false, error: 'invalid filter' });
    });

    it('surfaces a publish rejection as ok:false + error', async () => {
      const router = mockRouter({ publish: vi.fn(async () => { throw new Error('publish denied'); }) });
      const svc = createOutboxService({ router });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'outbox.publish', id: 'p3', event: { kind: 1, content: '', tags: [], created_at: 1 } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.publish.result', id: 'p3', ok: false, error: 'publish denied' });
    });
  });

  describe('outbox.resolveRelays', () => {
    it('returns the resolved plan', async () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();
      svc.handleMessage(WINDOW, {
        type: 'outbox.resolveRelays',
        id: 'r1',
        target: { pubkey: 'ab', direction: 'read' },
      } as NappletMessage, c.send);
      await Promise.resolve();
      expect(router.resolveRelays).toHaveBeenCalledWith({ pubkey: 'ab', direction: 'read' });
      expect(c.sent[0]).toEqual({ type: 'outbox.resolveRelays.result', id: 'r1', plan: { relays: ['wss://r.test'], source: 'nip65' } });
    });

    it('rejects a missing target as "invalid filter"', () => {
      const router = mockRouter();
      const svc = createOutboxService({ router });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'outbox.resolveRelays', id: 'r2' } as NappletMessage, c.send);
      expect(router.resolveRelays).not.toHaveBeenCalled();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.resolveRelays.result', id: 'r2', error: 'invalid filter' });
    });

    it('forwards a resolveRelays rejection as an error envelope (shim rejects on error)', async () => {
      const router = mockRouter({ resolveRelays: vi.fn(async () => { throw new Error('policy denied'); }) });
      const svc = createOutboxService({ router });
      const c = collector();
      svc.handleMessage(WINDOW, { type: 'outbox.resolveRelays', id: 'r3', target: { pubkey: 'ab' } } as NappletMessage, c.send);
      await Promise.resolve();
      await Promise.resolve();
      expect(c.sent[0]).toMatchObject({ type: 'outbox.resolveRelays.result', id: 'r3', error: 'policy denied' });
    });
  });

  it('silently ignores unknown outbox.* actions', () => {
    const router = mockRouter();
    const svc = createOutboxService({ router });
    const c = collector();
    expect(() => svc.handleMessage(WINDOW, { type: 'outbox.bogus', id: 'x' } as NappletMessage, c.send)).not.toThrow();
    expect(c.sent).toHaveLength(0);
  });
});
