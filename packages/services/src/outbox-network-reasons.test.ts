/**
 * outbox-network-reasons.test.ts — relay failures are never denials (kehto/web#460).
 *
 * Authority: NAP-OUTBOX draft napplet/naps#32 at
 * `8865f73d52a4864afee145f28d26520476273927`. Error Handling lists
 * `"relay list unavailable"`, `"relay timeout"`, `"policy denied"`, and
 * `"publish denied"`, and says partial relay failure SHOULD set
 * `incomplete: true` and still return events. Shell Behavior: the shell
 * SHOULD fall back to configured relays when NIP-65 data is unreachable.
 */

import { describe, expect, it, vi } from 'vitest';
import type { EventTemplate, NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';
import { createOutboxService, type OutboxSubscriptionSink, type StreamingOutboxRouter } from './outbox-service.js';
import { createRelayPoolOutboxRouter, type OutboxRelayPool } from './relay-pool-outbox-router.js';

const PK = 'a'.repeat(64);
const event: NostrEvent = { id: 'e'.repeat(64), pubkey: PK, kind: 1, tags: [], content: 'hi', created_at: 1, sig: 'f'.repeat(128) };
const PLAN = { relays: ['wss://one.test'], source: 'nip65' as const };

type Authorize = NonNullable<ServiceRuntimeContext['authorizeOperation']>;
const executed: Authorize = (async (_w: string, _op: string, _req: unknown, execute: (signal: ApprovalSignal) => unknown) =>
  ({ status: 'executed', value: await execute(new AbortController().signal) })) as unknown as Authorize;
const denied = vi.fn(async () => ({ status: 'denied' })) as unknown as Authorize;

function router(overrides: Partial<StreamingOutboxRouter> = {}): StreamingOutboxRouter {
  return {
    query: vi.fn(async () => ({ events: [] })),
    subscribe: vi.fn(() => ({ close: vi.fn() })),
    publish: vi.fn(async () => ({ ok: true })),
    resolveRelays: vi.fn(async () => PLAN),
    queryStream: vi.fn(() => ({ result: Promise.resolve({ events: [] }), close: vi.fn() })),
    planRead: vi.fn(async () => PLAN),
    queryWithPlan: vi.fn(async () => ({ events: [{ event }] })),
    subscribeWithPlan: vi.fn(() => ({ close: vi.fn() })),
    planPublish: vi.fn(async () => PLAN),
    publishWithPlan: vi.fn(async () => ({ ok: true, eventId: event.id })),
    ...overrides,
  };
}

function serve(backend: StreamingOutboxRouter, authorize: Authorize) {
  const service = createOutboxService({ router: backend });
  service.onRegistered?.({ authorizeOperation: authorize } as ServiceRuntimeContext);
  const sent: NappletMessage[] = [];
  const send = (message: NappletMessage): void => { sent.push(message); };
  return { service, sent, send };
}

const subscribe = { type: 'outbox.subscribe', id: 's', subId: 'feed', filters: [{ authors: [PK] }] } as NappletMessage;
const query = { type: 'outbox.query', id: 'q', filters: [{ authors: [PK] }] } as NappletMessage;
const getEvent = { type: 'outbox.getEvent', id: 'g', eventId: event.id } as NappletMessage;
const publish = { type: 'outbox.publish', id: 'p', event: { kind: 1, content: 'x', tags: [], created_at: 1 } } as NappletMessage;

describe('outbox service: planning failures are network reasons', () => {
  it.each([
    ['a transport error', new Error('WebSocket connection failed'), 'relay list unavailable'],
    ['a router that names relay timeout', new Error('relay timeout'), 'relay timeout'],
    ['a router that calls discovery a denial', new Error('policy denied'), 'relay list unavailable'],
  ])('maps a planRead rejection from %s and never asks for approval', async (_label, failure, reason) => {
    const authorize = vi.fn(executed);
    const backend = router({ planRead: vi.fn(async () => { throw failure; }) });
    const { service, sent, send } = serve(backend, authorize as unknown as Authorize);
    service.handleMessage('w', subscribe, send);
    service.handleMessage('w', query, send);
    service.handleMessage('w', getEvent, send);
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent).toEqual(expect.arrayContaining([
      { type: 'outbox.closed', subId: 'feed', reason },
      { type: 'outbox.query.result', id: 'q', events: [], incomplete: true, error: reason },
      { type: 'outbox.getEvent.result', id: 'g', incomplete: true, error: reason },
    ]));
    expect(authorize).not.toHaveBeenCalled();
  });

  it('keeps policy denied for an approval outcome that did not execute', async () => {
    const backend = router();
    const { service, sent, send } = serve(backend, denied);
    service.handleMessage('w', subscribe, send);
    service.handleMessage('w', query, send);
    service.handleMessage('w', publish, send);
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent).toEqual(expect.arrayContaining([
      { type: 'outbox.closed', subId: 'feed', reason: 'policy denied' },
      { type: 'outbox.query.result', id: 'q', events: [], error: 'policy denied' },
      { type: 'outbox.publish.result', id: 'p', ok: false, error: 'policy denied' },
    ]));
    expect(backend.subscribeWithPlan).not.toHaveBeenCalled();
    expect(backend.queryWithPlan).not.toHaveBeenCalled();
    expect(backend.publishWithPlan).not.toHaveBeenCalled();
  });

  it('maps a transport throw inside the approved callback to a network reason', async () => {
    const backend = router({
      subscribeWithPlan: vi.fn(() => { throw new Error('relay socket closed'); }),
      queryWithPlan: vi.fn(async () => { throw new Error('relay socket closed'); }),
      publishWithPlan: vi.fn(async () => { throw new Error('relay socket closed'); }),
    });
    const { service, sent, send } = serve(backend, executed);
    service.handleMessage('w', subscribe, send);
    service.handleMessage('w', query, send);
    service.handleMessage('w', publish, send);
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(sent).toEqual(expect.arrayContaining([
      { type: 'outbox.closed', subId: 'feed', reason: 'relay list unavailable' },
      { type: 'outbox.query.result', id: 'q', events: [], incomplete: true, error: 'relay list unavailable' },
      { type: 'outbox.publish.result', id: 'p', ok: false, error: 'relay timeout' },
    ]));
  });

  it('keeps a consent refusal from the publish transport as publish denied', async () => {
    const backend = router({ publishWithPlan: vi.fn(async () => { throw new Error('publish denied'); }) });
    const { service, sent, send } = serve(backend, executed);
    service.handleMessage('w', publish, send);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ type: 'outbox.publish.result', id: 'p', ok: false, error: 'publish denied' });
  });

  it('sends one closed and never re-registers a stream the router closed while opening', async () => {
    const close = vi.fn();
    const backend = router({
      subscribeWithPlan: vi.fn((_filters: NostrFilter[], _plan, sink: OutboxSubscriptionSink) => {
        sink.closed('relay list unavailable');
        return { close };
      }),
    });
    const { service, sent, send } = serve(backend, executed);
    service.handleMessage('w', subscribe, send);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await Promise.resolve();
    expect(sent).toEqual([{ type: 'outbox.closed', subId: 'feed', reason: 'relay list unavailable' }]);
    service.onWindowDestroyed?.('w');
    expect(close).not.toHaveBeenCalled();
  });

  it('releases a stream opened before a late cancellation and reports policy denied once', async () => {
    const close = vi.fn();
    const backend = router({ subscribeWithPlan: vi.fn(() => ({ close })) });
    const cancelledAfterExecute = (async (_w: string, _op: string, _req: unknown, execute: (signal: ApprovalSignal) => unknown) => {
      await execute(new AbortController().signal);
      return { status: 'cancelled' };
    }) as unknown as Authorize;
    const { service, sent, send } = serve(backend, cancelledAfterExecute);
    service.handleMessage('w', subscribe, send);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent).toEqual([{ type: 'outbox.closed', subId: 'feed', reason: 'policy denied' }]);
    expect(close).toHaveBeenCalled();
    close.mockClear();
    service.onWindowDestroyed?.('w');
    expect(close).not.toHaveBeenCalled();
  });
});

interface FakeSub { relay: string; cb: (item: NostrEvent | 'EOSE') => void; closed: boolean }

function pool(failing: string[] = []) {
  const subs: FakeSub[] = [];
  const value = {
    subs,
    publishImpl: (() => undefined) as (event: NostrEvent, relays: string[]) => Record<string, boolean> | void,
    isAvailable: () => true,
    subscribe(_filters: NostrFilter[], relays: string[], cb: (item: NostrEvent | 'EOSE') => void) {
      if (failing.includes(relays[0]!)) throw new Error(`connect ${relays[0]} failed`);
      const sub = { relay: relays[0]!, cb, closed: false };
      subs.push(sub);
      return { unsubscribe() { sub.closed = true; } };
    },
    publish(published: NostrEvent, relays: string[]) { return value.publishImpl(published, relays); },
    emit(relay: string, item: NostrEvent | 'EOSE') {
      for (const sub of subs) if (sub.relay === relay && !sub.closed) sub.cb(item);
    },
  };
  return value as OutboxRelayPool & typeof value;
}

const TWO = { relays: ['wss://up.test', 'wss://down.test'], source: 'nip65' as const };

describe('relay-pool outbox router: discovery and partial relay failure', () => {
  it('falls back instead of rejecting when the relay-list loader fails', async () => {
    const backend = createRelayPoolOutboxRouter({
      relayPool: pool(), fallbackRelays: ['wss://fallback.test'],
      loadRelayLists: () => Promise.reject(new Error('every relay failed')),
    });
    const expected = { relays: ['wss://fallback.test'], source: 'fallback', missingAuthors: [PK] };
    await expect(backend.planRead!([{ authors: [PK] }])).resolves.toEqual(expected);
    await expect(backend.resolveRelays({ pubkey: PK })).resolves.toEqual(expected);
  });

  it('reports a required inbox whose relay list cannot load as relay list unavailable', async () => {
    const backend = createRelayPoolOutboxRouter({
      relayPool: pool(), fallbackRelays: ['wss://fallback.test'],
      loadRelayLists: () => { throw new Error('every relay failed'); },
      signEvent: async (template: EventTemplate) => ({ ...event, ...template }),
    });
    const result = await backend.publish({ kind: 1, content: 'x', tags: [], created_at: 1 }, { toOutbox: false, toInboxes: [PK] });
    expect(result).toMatchObject({ ok: false, error: 'relay list unavailable' });
  });

  it('returns what the reachable relay found, marked incomplete, when another relay fails', async () => {
    const relays = pool(['wss://down.test']);
    const backend = createRelayPoolOutboxRouter({ relayPool: relays, fallbackRelays: [], loadRelayLists: () => new Map(), defaultTimeoutMs: 10_000 });
    const result = backend.queryWithPlan!([{ authors: [PK] }], undefined, TWO);
    relays.emit('wss://up.test', event);
    relays.emit('wss://up.test', 'EOSE');
    await expect(result).resolves.toEqual({ events: [{ event, sidecar: { relayHints: TWO.relays } }], incomplete: true });
  });

  it('settles on EOSE from every relay without waiting for the deadline', async () => {
    const relays = pool();
    const backend = createRelayPoolOutboxRouter({ relayPool: relays, fallbackRelays: [], loadRelayLists: () => new Map(), defaultTimeoutMs: 10_000 });
    const result = backend.queryWithPlan!([{ authors: [PK] }], undefined, TWO);
    relays.emit('wss://up.test', event);
    relays.emit('wss://up.test', 'EOSE');
    relays.emit('wss://down.test', 'EOSE');
    await expect(result).resolves.toEqual({ events: [{ event, sidecar: { relayHints: TWO.relays } }] });
  });

  it('marks a read incomplete when one relay never answers before the deadline', async () => {
    const relays = pool();
    const backend = createRelayPoolOutboxRouter({ relayPool: relays, fallbackRelays: [], loadRelayLists: () => new Map(), defaultTimeoutMs: 20 });
    const result = backend.queryWithPlan!([{ authors: [PK] }], undefined, TWO);
    relays.emit('wss://up.test', event);
    relays.emit('wss://up.test', 'EOSE');
    await expect(result).resolves.toEqual({ events: [{ event, sidecar: { relayHints: TWO.relays } }], incomplete: true });
  });

  it('reports relay timeout when no relay answers and relay list unavailable when none attaches', async () => {
    const silent = createRelayPoolOutboxRouter({ relayPool: pool(), fallbackRelays: [], loadRelayLists: () => new Map(), defaultTimeoutMs: 10 });
    await expect(silent.queryWithPlan!([{ authors: [PK] }], undefined, TWO)).resolves.toEqual({ events: [], incomplete: true, error: 'relay timeout' });
    const down = createRelayPoolOutboxRouter({ relayPool: pool(TWO.relays), fallbackRelays: [], loadRelayLists: () => new Map() });
    await expect(down.queryWithPlan!([{ authors: [PK] }], undefined, TWO)).resolves.toEqual({ events: [], incomplete: true, error: 'relay list unavailable' });
    await expect(down.queryWithPlan!([{ authors: [PK] }], undefined, { relays: [], source: 'fallback' })).resolves.toEqual({ events: [], incomplete: true, error: 'relay list unavailable' });
  });

  it('keeps a live stream on the reachable relay and closes only when none attaches', async () => {
    const relays = pool(['wss://down.test']);
    const backend = createRelayPoolOutboxRouter({ relayPool: relays, fallbackRelays: [], loadRelayLists: () => new Map() });
    const live = { event: vi.fn(), closed: vi.fn() };
    backend.subscribeWithPlan!([{ authors: [PK] }], TWO, live);
    relays.emit('wss://up.test', event);
    await vi.waitFor(() => expect(live.event).toHaveBeenCalledWith({ event, sidecar: { relayHints: ['wss://up.test'] } }));
    expect(live.closed).not.toHaveBeenCalled();
    const dead = { event: vi.fn(), closed: vi.fn() };
    createRelayPoolOutboxRouter({ relayPool: pool(TWO.relays), fallbackRelays: [], loadRelayLists: () => new Map() })
      .subscribeWithPlan!([{ authors: [PK] }], TWO, dead);
    expect(dead.closed).toHaveBeenCalledExactlyOnceWith('relay list unavailable');
  });

  it('labels planned publish failures by cause', async () => {
    const relays = pool();
    const template = { kind: 1, content: 'x', tags: [], created_at: 1 };
    const make = (signEvent?: (t: EventTemplate) => Promise<NostrEvent>) =>
      createRelayPoolOutboxRouter({ relayPool: relays, fallbackRelays: [], loadRelayLists: () => new Map(), ...(signEvent ? { signEvent } : {}) });
    const signs = make(async (t) => ({ ...event, ...t }));
    expect(await signs.publishWithPlan!(template, { relays: [], source: 'fallback' })).toEqual({ ok: false, error: 'relay list unavailable' });
    expect(await make(async () => { throw new Error('user declined'); }).publishWithPlan!(template, PLAN)).toEqual({ ok: false, error: 'publish denied' });
    relays.publishImpl = () => { throw new Error('publish denied'); };
    expect(await signs.publishWithPlan!(template, PLAN)).toMatchObject({ ok: false, error: 'publish denied' });
    relays.publishImpl = () => { throw new Error('socket hang up'); };
    expect(await signs.publishWithPlan!(template, PLAN)).toMatchObject({ ok: false, error: 'relay timeout' });
    relays.publishImpl = () => ({ 'wss://one.test': false });
    expect(await signs.publishWithPlan!(template, PLAN)).toMatchObject({ ok: false, relays: { 'wss://one.test': false }, error: 'relay timeout' });
  });

  it('streams from fallback relays end to end when discovery fails under approval', async () => {
    const relays = pool();
    const backend = createRelayPoolOutboxRouter({
      relayPool: relays, fallbackRelays: ['wss://fallback.test'],
      loadRelayLists: () => Promise.reject(new Error('every relay failed')),
    });
    const { service, sent, send } = serve(backend, executed);
    service.handleMessage('w', subscribe, send);
    await vi.waitFor(() => expect(relays.subs).toHaveLength(1));
    relays.emit('wss://fallback.test', event);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ type: 'outbox.event', subId: 'feed', result: { event, sidecar: { relayHints: ['wss://fallback.test'] } } });
  });
});
