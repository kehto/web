import { afterEach, describe, expect, it, vi } from 'vitest';
import { AbstractRelay } from 'nostr-tools/abstract-relay';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey, verifyEvent } from 'nostr-tools/pure';
import type { NostrEvent } from '@napplet/core';
import { queryPajaLive, subscribePajaLive } from './browser-relay-transport.js';

/** Connected in-memory sockets still exercise AbstractRelay's real receive guard. */
class TestSocket {
  static OPEN = 1;
  readyState = 1;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: MessageEvent) => void;
  constructor(_url: string) { queueMicrotask(() => this.onopen?.()); }
  send(_message: string) {}
  close() { this.readyState = 3; }
}

class TestPool extends SimplePool {
  readonly sources = new Map<string, AbstractRelay>();
  override async ensureRelay(url: string): Promise<AbstractRelay> {
    let relay = this.sources.get(url);
    if (!relay) {
      relay = new AbstractRelay(url, {
        verifyEvent,
        websocketImplementation: TestSocket as unknown as typeof WebSocket,
        enablePing: false,
        enableReconnect: false,
      });
      this.sources.set(url, relay);
      await relay.connect();
    }
    return relay;
  }
  override destroy() { for (const relay of this.sources.values()) relay.close(); }
  emit(url: string, event: unknown) {
    const relay = this.sources.get(url)!;
    for (const sub of [...relay.openSubs.values()]) {
      relay._onmessage({ data: JSON.stringify(['EVENT', sub.id, event]) } as MessageEvent);
    }
  }
  eose() {
    for (const relay of this.sources.values()) {
      for (const sub of [...relay.openSubs.values()]) {
        relay._onmessage({ data: JSON.stringify(['EOSE', sub.id]) } as MessageEvent);
      }
    }
  }
}
const A = 'wss://a.example';
const B = 'wss://b.example';
const event = finalizeEvent({ kind: 1, created_at: 1, tags: [], content: 'receipt' }, generateSecretKey()) as NostrEvent;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const pools: TestPool[] = [];
function pool() { const value = new TestPool(); value.trackRelays = true; pools.push(value); return value; }
afterEach(() => { for (const value of pools.splice(0)) value.destroy(); });

describe('Paja live receipt boundary', () => {
  it('counts A,B,A receipts but delivers once and never credits historical B to a later read', async () => {
    const live = pool();
    const receipts: string[] = [];
    const delivered: unknown[] = [];
    const sub = subscribePajaLive(live, [A, `${A}/`, B], [{ kinds: [1] }, {}], (item) => delivered.push(item),
      (_event, source) => receipts.push(source), 1000);
    await tick();
    expect(live.sources.size).toBe(2);
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([A]); // B is silent, not a presumed fan-out receipt.
    live.emit(`${B}/`, event);
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([A, B, A]);
    expect(delivered).toEqual([event]);
    expect([...live.seenOn.get(event.id)!].map((relay) => relay.url)).toEqual([`${A}/`, `${B}/`]);
    sub.unsubscribe();
    receipts.length = 0;
    const later = subscribePajaLive(live, [A, B], [{}], () => {}, (_event, source) => receipts.push(source), 1000);
    await tick();
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([A]);
    later.unsubscribe();
    live.emit(`${B}/`, event);
    expect(receipts).toEqual([A]);
  });

  it('observes query arrivals before EOSE and deduplicates overlapping-filter results', async () => {
    const live = pool();
    const receipts: string[] = [];
    let settled = false;
    const result = queryPajaLive(live, [A, B], [{ kinds: [1] }, {}], 1000,
      (_event, source) => receipts.push(source)).then((events) => { settled = true; return events; });
    await tick();
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([A, A]); // Two actual subscriptions, one receipt each.
    expect(settled).toBe(false);
    live.eose();
    await expect(result).resolves.toEqual([event]);
    expect([...live.sources.values()].every((relay) => relay.openSubs.size === 0)).toBe(true);
  });

  it('excludes invalid signatures and nonmatching events from both receipts and deliveries', async () => {
    const live = pool();
    const receipts: unknown[] = [];
    const deliveries: unknown[] = [];
    const sub = subscribePajaLive(live, [A], [{ kinds: [1] }], (item) => deliveries.push(item),
      (item) => receipts.push(item), 1000);
    await tick();
    live.emit(`${A}/`, { ...event, sig: '0'.repeat(128) });
    live.emit(`${A}/`, finalizeEvent({ kind: 2, created_at: 1, tags: [], content: '' }, generateSecretKey()));
    expect(receipts).toEqual([]);
    expect(deliveries).toEqual([]);
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([event]);
    sub.unsubscribe();
  });

  it('closes bounded and aborted reads without late observations', async () => {
    const live = pool();
    let receipts = 0;
    const bounded = queryPajaLive(live, [A], [{ limit: 1 }], 1000, () => { receipts += 1; }, true);
    await tick();
    live.emit(`${A}/`, event);
    await expect(bounded).resolves.toEqual([event]);
    live.emit(`${A}/`, event);
    expect(receipts).toBe(1);
    const controller = new AbortController();
    const aborted = queryPajaLive(live, [A], [{}], 1000, () => { receipts += 1; }, false, controller.signal);
    await tick();
    controller.abort();
    await expect(aborted).resolves.toEqual([]);
    live.emit(`${A}/`, event);
    expect(receipts).toBe(1);
  });

  it('aggregates EOSE once and contains observer failures without losing delivery', async () => {
    const live = pool();
    const deliveries: unknown[] = [];
    const sub = subscribePajaLive(live, [A, B], [{}], (item) => deliveries.push(item), () => { throw new Error('diagnostics'); }, 1000);
    await tick();
    live.emit(`${A}/`, event);
    live.eose();
    live.eose();
    expect(deliveries).toEqual([event, 'EOSE']);
    sub.unsubscribe();
  });

  it('times out quiet queries and closes reads cancelled before connection opens', async () => {
    const live = pool();
    const query = queryPajaLive(live, [A], [{}], 20, () => {});
    await expect(query).resolves.toEqual([]);
    expect(live.sources.get(`${A}/`)!.openSubs.size).toBe(0);
    const sub = subscribePajaLive(live, [B], [{}], () => { throw new Error('late delivery'); }, () => {}, 1000);
    sub.unsubscribe();
    await tick();
    expect(live.sources.get(`${B}/`)!.openSubs.size).toBe(0);
  });

  it('cancels concurrent reads exactly once without marking an active relay idle', async () => {
    const live = pool();
    const first = subscribePajaLive(live, [A], [{}], () => {}, () => {}, 1000);
    await tick();
    const second = subscribePajaLive(live, [A], [{}], () => {}, () => {}, 1000);
    await tick();
    const relay = live.sources.get(`${A}/`)!;
    expect(relay.ongoingOperations).toBe(2);
    first.unsubscribe();
    first.unsubscribe();
    expect(relay.ongoingOperations).toBe(1);
    expect(relay.openSubs.size).toBe(1);
    expect(relay.idleSince).toBeUndefined();
    second.unsubscribe();
    expect(relay.ongoingOperations).toBe(0);
    expect(relay.openSubs.size).toBe(0);
  });

  it('retries an auth-required close using the pool auth signer', async () => {
    const live = pool();
    const signer = vi.fn(async () => event as ReturnType<typeof finalizeEvent>);
    live.automaticallyAuth = () => signer;
    const receipts: string[] = [];
    const sub = subscribePajaLive(live, [A], [{}], () => {}, (_event, source) => receipts.push(source), 1000);
    await tick();
    const relay = live.sources.get(`${A}/`)!;
    const auth = vi.spyOn(relay, 'auth').mockResolvedValue('ok');
    const first = [...relay.openSubs.values()][0]!;
    relay._onmessage({ data: JSON.stringify(['CLOSED', first.id, 'auth-required: sign in']) } as MessageEvent);
    await tick();
    expect(auth).toHaveBeenCalledWith(signer);
    expect(relay.openSubs.size).toBe(1);
    live.emit(`${A}/`, event);
    expect(receipts).toEqual([A]);
    sub.unsubscribe();
    expect(relay.ongoingOperations).toBe(0);
    expect(relay.openSubs.size).toBe(0);
  });

});
