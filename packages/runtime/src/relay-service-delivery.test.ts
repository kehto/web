import { describe, expect, it } from 'vitest';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';

import { matchesAnyFilter } from './event-buffer.js';
import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from './test-utils.js';
import type { RelayPlanningServiceHandler } from './service-types.js';
import type { ServiceHandler, Signer } from './types.js';

// Disposable scalar key; no external identity.
const SECRET = Uint8Array.from([...Array(31).fill(0), 9]);
const AUTHOR = getPublicKey(SECRET);
const HASH = 'd'.repeat(64);
const WINDOWS = ['w1', 'w2', 'w3'] as const;
declare function setTimeout(callback: () => void, ms: number): unknown;

const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

type Sub = { windowId: string; subId: string; filters: NostrFilter[]; send: (message: NappletMessage) => void };
type Wire = NappletMessage & { subId?: string; id?: string; filters?: NostrFilter[]; event?: NostrEvent; result?: { event: NostrEvent } };

/**
 * Minimal relay-shaped service: stores publishes and echoes them to every matching
 * subscription. It implements the planned-execution contract the runtime requires
 * of a relay service, with local-only plans because it opens no relay transport.
 */
function relayService(): RelayPlanningServiceHandler & { subs: Map<string, Sub>; store: NostrEvent[] } {
  const subs = new Map<string, Sub>();
  const store: NostrEvent[] = [];
  const event = (subId: string, item: NostrEvent): NappletMessage => ({ type: 'relay.event', subId, result: { event: item } } as NappletMessage);
  return {
    descriptor: { name: 'relay', version: '1.0.0' },
    subs,
    store,
    planRelayOperation(_windowId, message) {
      const operation = message.type === 'relay.publish' ? 'publish' : 'subscribe';
      return Object.freeze({ operation, relayUrls: Object.freeze([]), localOnly: true });
    },
    executeRelayOperation(windowId, message, _plan, signal, send) {
      if (!signal.aborted) this.handleMessage(windowId, message, send);
    },
    handleMessage(windowId, message, send) {
      const m = message as Wire;
      if (m.type === 'relay.subscribe' && m.subId) {
        const filters = m.filters ?? [];
        subs.set(`${windowId}:${m.subId}`, { windowId, subId: m.subId, filters, send });
        for (const item of store) if (matchesAnyFilter(item, filters)) send(event(m.subId, item));
        send({ type: 'relay.eose', subId: m.subId } as NappletMessage);
      } else if (m.type === 'relay.close' && m.subId) {
        subs.delete(`${windowId}:${m.subId}`);
      } else if (m.type === 'relay.publish' && m.event) {
        store.push(m.event);
        for (const sub of subs.values()) if (matchesAnyFilter(m.event, sub.filters)) sub.send(event(sub.subId, m.event));
        send({ type: 'relay.publish.result', id: m.id ?? '', ok: true, event: m.event, eventId: m.event.id } as NappletMessage);
      }
    },
  };
}

function setup(relay?: ServiceHandler) {
  const signer: Signer = { signEvent: async (template) => finalizeEvent(template as Parameters<typeof finalizeEvent>[0], SECRET) };
  const ctx = createMockRuntimeAdapter({
    services: relay ? { relay } : {},
    auth: { getUserPubkey: () => AUTHOR, getSigner: () => signer },
  });
  const runtime = createRuntime(ctx.hooks);
  for (const windowId of WINDOWS) {
    runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, `napp-${windowId}`, HASH));
  }
  const subscribe = (windowId: string, subId: string): void => {
    runtime.handleMessage(windowId, { type: 'relay.subscribe', id: `req-${subId}`, subId, filters: [{ kinds: [1], authors: [AUTHOR] }] } as NappletMessage);
  };
  const publish = async (windowId: string, id: string, content: string): Promise<void> => {
    runtime.handleMessage(windowId, { type: 'relay.publish', id, event: { kind: 1, content, tags: [], created_at: Math.floor(Date.now() / 1000) } } as NappletMessage);
    await flush();
    await flush();
  };
  const relayEvents = () => ctx.sent
    .filter(({ message }) => !Array.isArray(message) && (message as NappletMessage).type === 'relay.event')
    .map(({ windowId, message }) => ({ windowId, subId: (message as Wire).subId, id: (message as Wire).result?.event.id }));
  const arrays = () => ctx.sent.filter(({ message }) => Array.isArray(message));
  return { ...ctx, runtime, subscribe, publish, relayEvents, arrays };
}

describe('relay publish delivery ownership (kehto/web#376 review)', () => {
  it('lets a registered relay service own fan-out: publisher echo, one copy per subscriber, no ring-buffer replay', async () => {
    const relay = relayService();
    const { sent, subscribe, publish, relayEvents, arrays } = setup(relay);
    subscribe('w1', 'mine');
    subscribe('w2', 'theirs');
    sent.length = 0;

    await publish('w1', 'p1', 'owned by the service');
    const result = sent.find(({ message }) => (message as NappletMessage).type === 'relay.publish.result')?.message as Wire & { ok: boolean };
    expect(result).toMatchObject({ id: 'p1', ok: true });
    expect(relay.store).toHaveLength(1);
    const published = relay.store[0]!;
    expect(relayEvents()).toEqual([
      { windowId: 'w1', subId: 'mine', id: published.id },
      { windowId: 'w2', subId: 'theirs', id: published.id },
    ]);
    expect(arrays()).toEqual([]);

    // A late subscriber hears the event once, from the service; the runtime kept no second copy.
    sent.length = 0;
    subscribe('w3', 'late');
    expect(relayEvents()).toEqual([{ windowId: 'w3', subId: 'late', id: published.id }]);
    expect(sent.map(({ message }) => (message as NappletMessage).type)).toEqual(['relay.event', 'relay.eose']);
  });

  it('still fans out from the ring buffer when the runtime coordinates the publish itself', async () => {
    const { hooks, sent, subscribe, publish, arrays } = setup();
    hooks.relayPool!.isAvailable = () => true;
    subscribe('w2', 'theirs');
    sent.length = 0;
    await publish('w1', 'p2', 'runtime coordinated');
    expect(arrays().map(({ windowId, message }) => [windowId, (message as unknown[])[0], (message as unknown[])[1]])).toEqual([['w2', 'EVENT', 'theirs']]);
  });
});
