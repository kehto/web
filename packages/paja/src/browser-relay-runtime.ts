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
import { verifyEvent } from 'nostr-tools/pure';

import { subscribePajaLive, queryPajaLive } from './browser-relay-transport.js';

import type { PajaConfirmationHandler, PajaSignerProvider } from './browser-adapter.js';
import type { PajaSimulation } from './simulation.js';

export const PAJA_NIP65_RELAY_LIST_KIND = 10_002;
export const PAJA_CONTACT_LIST_KIND = 3;
const PAJA_WEBRTC_SIGNAL_KIND = 25_050;
const NIP17_GIFT_WRAP_KIND = 1_059;
/**
 * Maximum raw kind-3 candidates returned for verification. The newest candidates
 * (with event-ID tie-breaking) retain deterministic replacement while bounding
 * serial signature verification of untrusted relay input.
 */
export const PAJA_CONTACT_LIST_CANDIDATE_LIMIT = 64;
export const PAJA_LIVE_QUERY_WAIT_MS = 4_000;

/**
 * Why Paja opened one relay read.
 *
 * - `outbox` — the outbox model picked the relays (an author's NIP-65 write
 *   relays, or the configured fallback set when no list resolves).
 * - `hint` — the napplet named the relays itself (a NAP-RELAY `relay.subscribe`
 *   relay field), so the read is pinned rather than routed.
 * - `host` — Paja read on its own behalf through its configured read pool:
 *   the relay service without a hint, social cache, contact lists, count/cvm,
 *   Blossom lookups, upload discovery, WebRTC and DM traffic.
 */
export type PajaRelayReadReason = 'outbox' | 'hint' | 'host';

/** Why one relay was in the read, when the caller knows how it was routed. */
export type PajaRelayReadOrigin = 'nip65' | 'hint' | 'fallback';

/** How one relay read was chosen. */
export interface PajaRelayReadContext {
  /** How the read's relay set was chosen. */
  readonly reason: PajaRelayReadReason;
  /**
   * Per-relay routing inside an outbox plan.
   *
   * The outbox router knows whether each relay came from an author's NIP-65
   * list, a caller hint, or the host fallback set. Reads that are not
   * outbox-planned leave this undefined, which renders without a chip.
   */
  readonly origin?: PajaRelayReadOrigin;
  /**
   * Router-supplied NIP-65 owners, or requested authors for other reads.
   *
   * An explicit empty list is authoritative. When omitted, attribution uses
   * filter authors, for example on ordinary host-pool queries.
   */
  readonly authors?: readonly string[];
}

/** One relay read Paja started, labelled with how its relay set was chosen. */
export interface PajaRelayReadRequest extends PajaRelayReadContext {
  /** Relay URLs the read runs against. */
  readonly relayUrls: readonly string[];
}

/** One event received from a live relay, with the read that produced it. */
export interface PajaRelayEventSighting extends PajaRelayReadRequest {
  /** Event as received, before subscriber filtering. */
  readonly event: NostrEvent;
  /**
   * Relays this read actually saw the event on.
   *
   * The current receiving relay, retaining its first requested URL spelling.
   * Historical pool tracking is reserved for sidecar hints, never attribution.
   */
  readonly sightedOn: readonly string[];
}

/** Observer for relay reads Paja starts. */
export type PajaRelayRequestObserver = (request: PajaRelayReadRequest) => void;

/**
 * Observer registered by the host for relay traffic in Paja.
 *
 * The observer fires once per event received from a live relay before Paja
 * delivers or returns it, which is the single choke point covering napplet
 * subscriptions as well as Paja's own background fetches. Simulated memory-mode
 * fixtures never fire it because they were never pulled from a relay.
 */
export type PajaRelayEventObserver = (sighting: PajaRelayEventSighting) => void;

export interface PajaRelayBackend extends RelayPoolLike {
  subscription(relayUrls: string[], filters: NostrFilter[], context?: PajaRelayReadContext): {
    subscribe(observer: (item: unknown) => void): { unsubscribe(): void };
  };
  request(relayUrls: string[], filters: NostrFilter[], context?: PajaRelayReadContext): {
    subscribe(observer: {
      next: (event: unknown) => void;
      complete: () => void;
      error: () => void;
    }): { unsubscribe(): void };
  };
  query(
    relayUrls: string[],
    filters: NostrFilter[],
    maxWaitMs?: number,
    context?: PajaRelayReadContext,
  ): Promise<NostrEvent[]>;
  publishToRelays(relayUrls: string[], event: NostrEvent): Promise<Record<string, boolean>>;
  countWithRelay(relayUrls: string[], filters: NostrFilter[]): Promise<{ count: number; relay: string }>;
  /** Relay URLs on which nostr-tools actually observed an event. */
  observedRelayUrls(eventId: string): string[];
  /**
   * Register the single host observer for events received from live relays.
   *
   * Registration is host-owned and idempotent: the newest observer replaces the
   * previous one. Relays already connected stay connected.
   *
   * @param observer - Called for every event received from a live relay.
   */
  setRelayEventObserver(observer: PajaRelayEventObserver): void;
  /**
   * Register the single host observer for relay reads Paja starts.
   *
   * Request observations fire whether or not a read returns events, which is
   * what separates a relay Paja asked and heard nothing from one it has not
   * used yet.
   *
   * @param observer - Called before every relay read Paja starts.
   */
  setRelayRequestObserver(observer: PajaRelayRequestObserver): void;
  /** Publish a consent-authorized, signed WebRTC signal without per-ICE prompts. */
  publishWebrtcSignal(relayUrls: string[], event: NostrEvent): Promise<void>;
  /** Publish a consent-authorized NIP-17 gift wrap without a second generic publish prompt. */
  publishDmGiftWrap(relayUrls: string[], event: NostrEvent): Promise<void>;
  isAvailable(): boolean;
  close(): void;
}

type ContactListCandidateQuery = (
  relayUrls: string[],
  filters: NostrFilter[],
  maxWaitMs?: number,
  signal?: AbortSignal,
) => Promise<NostrEvent[]>;

const contactListCandidateQueries = new WeakMap<PajaRelayBackend, ContactListCandidateQuery>();

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

async function publishLive(pool: SimplePool, relayUrls: string[], event: NostrEvent): Promise<Record<string, boolean>> {
  const results = await Promise.allSettled(pool.publish(relayUrls, event));
  return Object.fromEntries(relayUrls.map((relayUrl, index) => [relayUrl, results[index]?.status === 'fulfilled']));
}

async function countLive(
  pool: SimplePool,
  relayUrls: string[],
  filters: NostrFilter[],
): Promise<{ count: number; relay: string }> {
  let failure: unknown = new Error('count unavailable');
  for (const relayUrl of relayUrls) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('count timeout'));
      }, PAJA_LIVE_QUERY_WAIT_MS);
    });
    try {
      const relay = await Promise.race([
        pool.ensureRelay(relayUrl, {
          connectionTimeout: PAJA_LIVE_QUERY_WAIT_MS,
          abort: controller.signal,
        }),
        timedOut,
      ]);
      const count = await Promise.race([
        relay.count(filters as Filter[], { id: null }),
        timedOut,
      ]);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('invalid count');
      return { count, relay: relayUrl };
    } catch (error) {
      failure = error;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
  throw failure;
}

export function createPajaRelayBackend(
  getSimulation: () => PajaSimulation,
  confirmRequest: PajaConfirmationHandler,
  livePool = new SimplePool(),
): PajaRelayBackend {
  livePool.trackRelays = true;
  const fixtureEvents: NostrEvent[] = getSimulation().relay.fixtures.flatMap(toNostrEvent);
  const acceptedMemoryEvents: NostrEvent[] = [];
  const subscribers = new Set<{
    filters: NostrFilter[];
    next(item: NostrEvent | 'EOSE'): void;
  }>();
  let relayEventObserver: PajaRelayEventObserver | undefined;
  let relayRequestObserver: PajaRelayRequestObserver | undefined;

  const observeRelayRequest = (context: PajaRelayReadContext, relayUrls: readonly string[]): void => {
    if (relayUrls.length === 0) return;
    relayRequestObserver?.({ ...context, relayUrls: [...relayUrls] });
  };

  /**
   * Name the authors a read asked about, so an author-routed receipt is
   * attributable in the Events panel instead of merely surprising.
   *
   * @param context - How the read was chosen.
   * @param filters - Filters the read runs with.
   * @returns The context, extended with the read's authors when it has any.
   */
  const attributeAuthors = (
    context: PajaRelayReadContext,
    filters: readonly NostrFilter[],
  ): PajaRelayReadContext => {
    const authors = readAuthors(context.authors ?? filters.flatMap((filter) => filter.authors ?? []));
    return authors.length === 0 && context.authors === undefined ? context : { ...context, authors };
  };

  const observeRelayEvent = (
    context: PajaRelayReadContext,
    relayUrls: readonly string[],
    event: NostrEvent,
    source: string,
  ): void => {
    relayEventObserver?.({
      ...context,
      relayUrls: [...relayUrls],
      event,
      sightedOn: [source],
    });
  };

  const isAvailable = () => getSimulation().relay.mode !== 'disabled' && getPajaRelayUrls(getSimulation()).length > 0;
  const cachedEvents = (): NostrEvent[] => getSimulation().relay.mode === 'memory'
      ? [...fixtureEvents, ...acceptedMemoryEvents]
      : [];
  const query = async (
    relayUrls: string[],
    filters: NostrFilter[],
    maxWaitMs?: number,
    context: PajaRelayReadContext = { reason: 'host' },
  ): Promise<NostrEvent[]> => {
    const cached = collectMemoryEvents(cachedEvents(), filters);
    if (getSimulation().relay.mode !== 'live' || relayUrls.length === 0) return cached;
    const readContext = attributeAuthors(context, filters);
    observeRelayRequest(readContext, relayUrls);
    const liveEvents = await queryPajaLive(livePool, relayUrls, filters, maxWaitMs ?? PAJA_LIVE_QUERY_WAIT_MS,
      (event, source) => observeRelayEvent(readContext, relayUrls, event, source));
    const out = new Map<string, NostrEvent>();
    for (const event of [...cached, ...liveEvents]) out.set(event.id, event);
    return [...out.values()].sort((a, b) => b.created_at - a.created_at);
  };
  const queryContactListCandidates: ContactListCandidateQuery = async (relayUrls, filters, maxWaitMs, signal) => {
    const cached = collectMemoryEvents(cachedEvents(), filters);
    if (signal?.aborted || getSimulation().relay.mode !== 'live' || relayUrls.length === 0) return cached;
    const readContext = attributeAuthors({ reason: 'host' }, filters);
    observeRelayRequest(readContext, relayUrls);
    const liveEvents = await queryPajaLive(livePool, relayUrls, filters, maxWaitMs ?? PAJA_LIVE_QUERY_WAIT_MS,
      (event, source) => observeRelayEvent(readContext, relayUrls, event, source), true, signal);
    const out = new Map<string, NostrEvent>();
    for (const event of [...cached, ...liveEvents]) out.set(event.id, event);
    return [...out.values()].sort((a, b) => b.created_at - a.created_at);
  };

  function retainPublishedEvent(event: NostrEvent, mode: PajaSimulation['relay']['mode']): void {
    if (mode !== 'memory') return;
    acceptedMemoryEvents.push(event);
    for (const subscriber of subscribers) {
      if (matchesAnyFilter(event, subscriber.filters)) subscriber.next(event);
    }
  }

  async function attemptPublish(
    relayUrls: string[],
    event: NostrEvent,
  ): Promise<{ outcomes: Record<string, boolean>; error?: string }> {
    const simulation = getSimulation();
    const rejected = Object.fromEntries(relayUrls.map((url) => [url, false]));
    if (simulation.relay.mode === 'disabled') {
      return { outcomes: rejected, error: 'relay unavailable' };
    }
    if (!await confirmRequest({ action: 'publish', event })) {
      return { outcomes: rejected, error: 'publish denied' };
    }

    const outcomes = simulation.relay.mode === 'live'
      ? await publishLive(livePool, relayUrls, event)
      : Object.fromEntries(relayUrls.map((url) => [url, true]));
    if (!Object.values(outcomes).some(Boolean)) {
      return { outcomes, error: 'publish failed' };
    }
    retainPublishedEvent(event, simulation.relay.mode);
    return { outcomes };
  }

  const backend: PajaRelayBackend = {
    subscription(
      relayUrls: string[],
      filtersInput: NostrFilter[],
      context: PajaRelayReadContext = { reason: 'host' },
    ) {
      return {
        subscribe(next: (item: unknown) => void) {
          const filters = normalizedFilters(filtersInput);
          const subscriber = {
            filters,
            next: (item: NostrEvent | 'EOSE') => next(item),
          };
          subscribers.add(subscriber);
          for (const event of collectMemoryEvents(cachedEvents(), filters)) next(event);
          const readContext = attributeAuthors(context, filters);
          if (getSimulation().relay.mode === 'live') observeRelayRequest(readContext, relayUrls);
          const liveSub = getSimulation().relay.mode === 'live'
            ? subscribePajaLive(livePool, relayUrls, filters, subscriber.next,
                (event, source) => observeRelayEvent(readContext, relayUrls, event, source), PAJA_LIVE_QUERY_WAIT_MS)
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
    async publish(relayUrls: string[], event: NostrEvent): Promise<void> {
      const attempt = await attemptPublish(relayUrls, event);
      if (attempt.error) throw new Error(attempt.error);
    },
    request(
      relayUrls: string[],
      filtersInput: NostrFilter[],
      context: PajaRelayReadContext = { reason: 'host' },
    ) {
      return {
        subscribe(observer: { next: (event: unknown) => void; complete: () => void; error: () => void }) {
          const filters = normalizedFilters(filtersInput);
          let active = true;
          query(relayUrls, filters, undefined, context)
            .then((matched) => {
              if (!active) return;
              for (const event of matched) observer.next(event);
              observer.complete();
            })
            .catch(() => {
              if (active) observer.error();
            });
          return { unsubscribe() { active = false; } };
        },
      };
    },
    async count(relayUrls: string[], filters: NostrFilter[]): Promise<number> {
      if (getSimulation().relay.mode !== 'live') throw new Error('count unavailable');
      return (await countLive(livePool, relayUrls, normalizedFilters(filters))).count;
    },
    async countWithRelay(relayUrls, filters) {
      if (getSimulation().relay.mode !== 'live') throw new Error('count unavailable');
      observeRelayRequest(attributeAuthors({ reason: 'host' }, filters), relayUrls);
      return countLive(livePool, relayUrls, normalizedFilters(filters));
    },
    observedRelayUrls(eventId) {
      return [...(livePool.seenOn?.get(eventId) ?? [])].map((relay) => relay.url);
    },
    setRelayEventObserver(observer) {
      relayEventObserver = observer;
    },
    setRelayRequestObserver(observer) {
      relayRequestObserver = observer;
    },
    query,
    async publishToRelays(relayUrls, event) {
      return (await attemptPublish(relayUrls, event)).outcomes;
    },
    async publishWebrtcSignal(relayUrls, event) {
      if (
        getSimulation().relay.mode !== 'live'
        || relayUrls.length === 0
        || event.kind !== PAJA_WEBRTC_SIGNAL_KIND
        || !verifyEvent(event)
      ) {
        throw new Error('signaling unavailable');
      }
      const outcomes = await publishLive(livePool, relayUrls, event);
      if (!Object.values(outcomes).some(Boolean)) throw new Error('signaling unavailable');
      retainPublishedEvent(event, 'live');
    },
    async publishDmGiftWrap(relayUrls, event) {
      if (
        getSimulation().relay.mode !== 'live'
        || relayUrls.length === 0
        || event.kind !== NIP17_GIFT_WRAP_KIND
        || !verifyEvent(event)
      ) {
        throw new Error('DM relay publication failed');
      }
      const outcomes = await publishLive(livePool, relayUrls, event);
      if (!Object.values(outcomes).some(Boolean)) throw new Error('DM relay publication failed');
      retainPublishedEvent(event, 'live');
    },
    isAvailable,
    close() {
      livePool.destroy();
    },
  };
  contactListCandidateQueries.set(backend, queryContactListCandidates);
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

/**
 * Collect well-formed authors from routing metadata or event filters.
 *
 * Only exact 64-hex pubkeys are reported, so the Events panel never claims a read
 * was routed for a prefix, a placeholder, or a malformed author string.
 *
 * @param candidates - Authors supplied by the router or requested by filters.
 * @returns Lowercase hex authors, in first-seen order.
 */
function readAuthors(candidates: readonly string[]): string[] {
  const authors = new Set<string>();
  for (const author of candidates) {
    if (typeof author === 'string' && /^[0-9a-f]{64}$/i.test(author)) authors.add(author.toLowerCase());
  }
  return [...authors];
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
  getHostRelayUrls?: () => string[],
): Promise<string[]> {
  return dedupeRelayUrls([
    ...(getHostRelayUrls?.() ?? getPajaRelayUrls(getSimulation())),
    ...await getSignerRelayUrls(signerProvider, 'read'),
  ]);
}

/**
 * Loads raw kind-3 candidates for one captured account through Paja's existing
 * host-owned bootstrap relay selection. Consumers must verify and select events.
 */
export function createPajaContactListLoader(
  backend: PajaRelayBackend,
  getSimulation: () => PajaSimulation,
  signerProvider?: PajaSignerProvider,
  getHostRelayUrls?: () => string[],
): (pubkey: string, signal?: AbortSignal) => Promise<NostrEvent[]> {
  return async (pubkey: string, signal?: AbortSignal): Promise<NostrEvent[]> => {
    if (!/^[0-9a-fA-F]{64}$/.test(pubkey) || signal?.aborted) return [];
    const relayUrls = await getBootstrapRelayUrls(getSimulation, signerProvider, getHostRelayUrls);
    if (signal?.aborted) return [];
    const filters = [{
      kinds: [PAJA_CONTACT_LIST_KIND],
      authors: [pubkey],
      limit: PAJA_CONTACT_LIST_CANDIDATE_LIMIT,
    }];
    const contactQuery = contactListCandidateQueries.get(backend);
    const candidates = contactQuery
      ? await contactQuery(relayUrls, filters, PAJA_LIVE_QUERY_WAIT_MS, signal)
      : await backend.query(relayUrls, filters, PAJA_LIVE_QUERY_WAIT_MS);
    if (signal?.aborted) return [];
    return candidates
      .filter((event) => event.kind === PAJA_CONTACT_LIST_KIND && event.pubkey.toLowerCase() === pubkey.toLowerCase())
      .sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id))
      .slice(0, PAJA_CONTACT_LIST_CANDIDATE_LIMIT);
  };
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
  getHostRelayUrls?: () => string[],
): (pubkeys: string[]) => Promise<Map<string, RelayListEntry>> {
  const registry = createNip65Registry();
  return async (pubkeys: string[]) => {
    const uniquePubkeys = [...new Set(pubkeys.filter((pubkey) => /^[0-9a-fA-F]{64}$/.test(pubkey)))];
    const missing = uniquePubkeys.filter((pubkey) => !registry.has(pubkey));
    if (missing.length > 0) {
      const events = await backend.query(await getBootstrapRelayUrls(
        getSimulation,
        signerProvider,
        getHostRelayUrls,
      ), [{
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
    subscribe(filters, relayUrls, callback, origin, authors) {
      // The router supplies owners independently of event filters: options may
      // select a relay without restricting which authors its events match.
      return backend
        .subscription(relayUrls, filters, { reason: 'outbox', origin, authors })
        .subscribe((item) => callback(item as NostrEvent | 'EOSE'));
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
