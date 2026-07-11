import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { RelayPoolLike } from '@kehto/shell';
import type { OutboxRelayPool, RelayListEntry } from '@kehto/services';
import {
  createNip65Registry,
  selectReadRelays,
  selectWriteRelays,
} from '@kehto/nip/65';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';

import type { PajaConfirmationRequest, PajaSignerProvider } from './browser-adapter.js';
import type { PajaSimulation } from './simulation.js';

export const PAJA_NIP65_RELAY_LIST_KIND = 10_002;
export const PAJA_CONTACT_LIST_KIND = 3;
export const PAJA_LIVE_QUERY_WAIT_MS = 4_000;

export interface PajaRelayBackend extends RelayPoolLike {
  query(relayUrls: string[], filters: NostrFilter[], maxWaitMs?: number): Promise<NostrEvent[]>;
  publishToRelays(relayUrls: string[], event: NostrEvent): Promise<Record<string, boolean>>;
  isAvailable(): boolean;
  close(): void;
}

function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  const ids = filter.ids;
  if (ids && !ids.some((id) => event.id === id || event.id.startsWith(id))) return false;
  const authors = filter.authors;
  if (authors && !authors.some((author) => event.pubkey === author || event.pubkey.startsWith(author))) return false;
  const kinds = filter.kinds;
  if (kinds && !kinds.includes(event.kind)) return false;
  if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
  if (typeof filter.until === 'number' && event.created_at > filter.until) return false;
  for (const [key, value] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(value)) continue;
    const tagName = key.slice(1);
    const allowed = value.filter((item): item is string => typeof item === 'string');
    if (allowed.length === 0) continue;
    if (!event.tags.some((tag) => tag[0] === tagName && typeof tag[1] === 'string' && allowed.includes(tag[1]))) return false;
  }
  return true;
}

export function matchesAnyFilter(event: NostrEvent, filters: NostrFilter[]): boolean {
  return filters.length === 0 || filters.some((filter) => matchesFilter(event, filter));
}

function normalizedFilters(filters: NostrFilter[] | NostrFilter): NostrFilter[] {
  return Array.isArray(filters) ? filters : [filters];
}

function applyFilterLimit(events: NostrEvent[], filter: NostrFilter): NostrEvent[] {
  const limit = typeof filter.limit === 'number' && filter.limit >= 0 ? filter.limit : undefined;
  if (limit === undefined) return events;
  return [...events].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

function collectMemoryEvents(events: NostrEvent[], filters: NostrFilter[]): NostrEvent[] {
  const out = new Map<string, NostrEvent>();
  const activeFilters = filters.length > 0 ? filters : [{} as NostrFilter];
  for (const filter of activeFilters) {
    for (const event of applyFilterLimit(events.filter((candidate) => matchesFilter(candidate, filter)), filter)) {
      out.set(event.id, event);
    }
  }
  return [...out.values()].sort((a, b) => b.created_at - a.created_at);
}

function subscribeLive(
  pool: SimplePool,
  relayUrls: string[],
  filters: NostrFilter[],
  next: (item: NostrEvent | 'EOSE') => void,
): { unsubscribe(): void } {
  const activeFilters = filters.length > 0 ? filters : [{} as NostrFilter];
  const requests = relayUrls.flatMap((url) => activeFilters.map((filter) => ({ url, filter: filter as Filter })));
  if (requests.length === 0) {
    queueMicrotask(() => next('EOSE'));
    return { unsubscribe() { /* no-op */ } };
  }
  const sub = pool.subscribeMap(requests, {
    label: 'kehto-paja-runtime',
    maxWait: PAJA_LIVE_QUERY_WAIT_MS,
    onevent: (event) => next(event as NostrEvent),
    oneose: () => next('EOSE'),
  });
  return {
    unsubscribe() {
      void sub.close('paja unsubscribe');
    },
  };
}

async function queryLive(
  pool: SimplePool,
  relayUrls: string[],
  filters: NostrFilter[],
  maxWaitMs = PAJA_LIVE_QUERY_WAIT_MS,
): Promise<NostrEvent[]> {
  const activeFilters = filters.length > 0 ? filters : [{} as NostrFilter];
  const batches = await Promise.all(activeFilters.map((filter) =>
    pool.querySync(relayUrls, filter as Filter, {
      label: 'kehto-paja-runtime',
      maxWait: maxWaitMs,
    }) as Promise<NostrEvent[]>,
  ));
  const out = new Map<string, NostrEvent>();
  for (const event of batches.flat()) out.set(event.id, event);
  return [...out.values()].sort((a, b) => b.created_at - a.created_at);
}

async function publishLive(pool: SimplePool, relayUrls: string[], event: NostrEvent): Promise<Record<string, boolean>> {
  const results = await Promise.allSettled(pool.publish(relayUrls, event));
  return Object.fromEntries(relayUrls.map((relayUrl, index) => [relayUrl, results[index]?.status === 'fulfilled']));
}

export function createPajaRelayBackend(
  getSimulation: () => PajaSimulation,
  confirmRequest: (request: PajaConfirmationRequest) => boolean,
): PajaRelayBackend {
  const events: NostrEvent[] = getSimulation().relay.fixtures.flatMap(toNostrEvent);
  const livePool = new SimplePool();
  const subscribers = new Set<{
    filters: NostrFilter[];
    next(item: NostrEvent | 'EOSE'): void;
  }>();

  const isAvailable = () => getSimulation().relay.mode !== 'disabled' && getPajaRelayUrls(getSimulation()).length > 0;
  const query = async (relayUrls: string[], filters: NostrFilter[], maxWaitMs?: number): Promise<NostrEvent[]> => {
    const memoryEvents = collectMemoryEvents(events, filters);
    if (getSimulation().relay.mode !== 'live' || relayUrls.length === 0) return memoryEvents;
    const liveEvents = await queryLive(livePool, relayUrls, filters, maxWaitMs);
    const out = new Map<string, NostrEvent>();
    for (const event of [...memoryEvents, ...liveEvents]) out.set(event.id, event);
    return [...out.values()].sort((a, b) => b.created_at - a.created_at);
  };

  const backend: PajaRelayBackend = {
    subscription(relayUrls: string[], filtersInput: NostrFilter[]) {
      return {
        subscribe(next: (item: unknown) => void) {
          const filters = normalizedFilters(filtersInput);
          const subscriber = {
            filters,
            next: (item: NostrEvent | 'EOSE') => next(item),
          };
          subscribers.add(subscriber);
          for (const event of collectMemoryEvents(events, filters)) next(event);
          const liveSub = getSimulation().relay.mode === 'live'
            ? subscribeLive(livePool, relayUrls, filters, subscriber.next)
            : null;
          queueMicrotask(() => {
            if (subscribers.has(subscriber) && !liveSub) next('EOSE');
          });
          return {
            unsubscribe() {
              subscribers.delete(subscriber);
              liveSub?.unsubscribe();
            },
          };
        },
      };
    },
    publish(relayUrls: string[], event: NostrEvent): void {
      if (getSimulation().relay.mode === 'disabled') return;
      if (!confirmRequest({ action: 'publish', event })) return;
      events.push(event);
      for (const subscriber of subscribers) {
        if (matchesAnyFilter(event, subscriber.filters)) subscriber.next(event);
      }
      if (getSimulation().relay.mode === 'live') {
        void publishLive(livePool, relayUrls, event);
      }
    },
    request(relayUrls: string[], filtersInput: NostrFilter[]) {
      return {
        subscribe(observer: { next: (event: unknown) => void; complete: () => void; error: () => void }) {
          const filters = normalizedFilters(filtersInput);
          query(relayUrls, filters)
            .then((matched) => {
              for (const event of matched) observer.next(event);
              observer.complete();
            })
            .catch(() => observer.error());
          return { unsubscribe() { /* no-op */ } };
        },
      };
    },
    async count(relayUrls: string[], filters: NostrFilter[]): Promise<number> {
      return (await query(relayUrls, normalizedFilters(filters))).length;
    },
    query,
    async publishToRelays(relayUrls, event) {
      if (getSimulation().relay.mode === 'disabled') return Object.fromEntries(relayUrls.map((url) => [url, false]));
      if (!confirmRequest({ action: 'publish', event })) return Object.fromEntries(relayUrls.map((url) => [url, false]));
      events.push(event);
      for (const subscriber of subscribers) {
        if (matchesAnyFilter(event, subscriber.filters)) subscriber.next(event);
      }
      if (getSimulation().relay.mode !== 'live') return Object.fromEntries(relayUrls.map((url) => [url, true]));
      return publishLive(livePool, relayUrls, event);
    },
    isAvailable,
    close() {
      livePool.destroy();
    },
  };
  return backend;
}

function toNostrEvent(value: unknown): NostrEvent[] {
  if (
    typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
    && typeof (value as { pubkey?: unknown }).pubkey === 'string'
    && typeof (value as { kind?: unknown }).kind === 'number'
    && Array.isArray((value as { tags?: unknown }).tags)
    && typeof (value as { content?: unknown }).content === 'string'
    && typeof (value as { sig?: unknown }).sig === 'string'
  ) {
    return [value as NostrEvent];
  }
  return [];
}

export function getPajaRelayUrls(simulation: PajaSimulation): string[] {
  return simulation.relay.mode === 'disabled' ? [] : [...simulation.relay.urls];
}

function dedupeRelayUrls(urls: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const url of urls) {
    const trimmed = url.trim();
    if (trimmed.length > 0) out.add(trimmed);
  }
  return [...out];
}

async function getSignerRelayUrls(
  signerProvider: PajaSignerProvider | undefined,
  direction: 'read' | 'write',
): Promise<string[]> {
  const signer = signerProvider?.getSigner();
  if (!signer?.getRelays) return [];
  try {
    const relays = await signer.getRelays();
    return dedupeRelayUrls(Object.entries(relays).flatMap(([url, permissions]) => {
      if (direction === 'read' && permissions.read) return [url];
      if (direction === 'write' && permissions.write) return [url];
      return [];
    }));
  } catch {
    return [];
  }
}

async function getBootstrapRelayUrls(
  getSimulation: () => PajaSimulation,
  signerProvider: PajaSignerProvider | undefined,
): Promise<string[]> {
  return dedupeRelayUrls([
    ...getPajaRelayUrls(getSimulation()),
    ...await getSignerRelayUrls(signerProvider, 'read'),
  ]);
}

function latestEvent(events: NostrEvent[], kind: number, pubkey: string): NostrEvent | undefined {
  return events
    .filter((event) => event.kind === kind && event.pubkey === pubkey)
    .sort((a, b) => b.created_at - a.created_at)[0];
}

function contactPubkeys(event: NostrEvent | undefined): string[] {
  if (!event) return [];
  const out = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] === 'p' && typeof tag[1] === 'string' && /^[0-9a-fA-F]{64}$/.test(tag[1])) {
      out.add(tag[1].toLowerCase());
    }
  }
  return [...out];
}

export function createPajaRelayListLoader(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
): (pubkeys: string[]) => Promise<Map<string, RelayListEntry>> {
  const registry = createNip65Registry();
  return async (pubkeys: string[]) => {
    const uniquePubkeys = [...new Set(pubkeys.filter((pubkey) => /^[0-9a-fA-F]{64}$/.test(pubkey)))];
    const missing = uniquePubkeys.filter((pubkey) => !registry.has(pubkey));
    if (missing.length > 0) {
      const events = await backend.query(await getBootstrapRelayUrls(getSimulation, signerProvider), [{
        kinds: [PAJA_NIP65_RELAY_LIST_KIND],
        authors: missing,
        limit: Math.max(missing.length * 2, 10),
      }], PAJA_LIVE_QUERY_WAIT_MS);
      for (const pubkey of missing) {
        const event = latestEvent(events, PAJA_NIP65_RELAY_LIST_KIND, pubkey);
        if (event) registry.ingest(event);
      }
    }
    const out = new Map<string, RelayListEntry>();
    for (const pubkey of uniquePubkeys) {
      const entries = registry.getRelayList(pubkey);
      if (entries) {
        out.set(pubkey, {
          read: selectReadRelays(entries),
          write: selectWriteRelays(entries),
        });
      }
    }
    return out;
  };
}

export function createPajaOutboxRelayPool(backend: PajaRelayBackend): OutboxRelayPool {
  return {
    subscribe(filters, relayUrls, callback) {
      return backend.subscription(relayUrls, filters).subscribe((item) => callback(item as NostrEvent | 'EOSE'));
    },
    publish(event, relayUrls) {
      return backend.publishToRelays(relayUrls, event);
    },
    isAvailable() {
      return backend.isAvailable();
    },
  };
}

export function createPajaIdentityProviders(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
): { getFollows(pubkey: string): Promise<string[]> } {
  const followsCache = new Map<string, string[]>();
  return {
    async getFollows(pubkey) {
      if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) return [];
      const cached = followsCache.get(pubkey);
      if (cached) return [...cached];
      const events = await backend.query(await getBootstrapRelayUrls(getSimulation, signerProvider), [{
        kinds: [PAJA_CONTACT_LIST_KIND],
        authors: [pubkey],
        limit: 1,
      }], PAJA_LIVE_QUERY_WAIT_MS);
      const follows = contactPubkeys(latestEvent(events, PAJA_CONTACT_LIST_KIND, pubkey));
      followsCache.set(pubkey, follows);
      return [...follows];
    },
  };
}
