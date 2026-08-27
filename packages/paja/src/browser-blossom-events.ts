import type { NostrEvent } from '@napplet/core';
import type {
  OutboxResult,
  OutboxRouter,
  OutboxRouterSubscription,
  OutboxSubscriptionSink,
} from '@kehto/services';
import type { RelayEventResult } from '@kehto/runtime';

import {
  PAJA_RESOURCE_MAX_SERVERS,
  normalizePublicBlossomServer,
} from './browser-resource.js';

/** Blossom BUD-03 replaceable server-list event kind. */
export const BLOSSOM_SERVER_LIST_KIND = 10_063;

const HEX_64 = /^[0-9a-f]{64}$/i;
const BLOSSOM_REFERENCE = /^blossom:(?:sha256:)?([0-9a-f]{64})(?:\.[0-9a-z]+)?(?:\?([^#]*))?$/i;
const DEFAULT_SERVER_LIST_TTL_MS = 5 * 60_000;
const MAX_RESOURCES_PER_WINDOW = 256;
const MAX_CONTEXTS_PER_RESOURCE = 8;

interface EventResourceLocation {
  readonly url: string;
  readonly servers: string[];
  readonly authors: string[];
}

interface ResourceContext extends EventResourceLocation {
  readonly eventId: string;
  readonly publisher: string;
  readonly createdAt: number;
}

interface ServerListCacheEntry {
  readonly expiresAt: number;
  readonly servers: string[];
}

/** Dependencies for Paja's source-scoped OUTBOX-to-Blossom resolver. */
export interface PajaBlossomEventResolverOptions {
  /** Verified, NIP-65-aware router used for publisher BUD-03 lookups. */
  readonly baseRouter: OutboxRouter;
  /** Active runtime users whose BUD-03 lists are read fallbacks. */
  readonly getDefaultAuthors?: () => readonly string[];
  /** Trusted runtime fallback servers, evaluated after event-derived servers. */
  readonly getConfiguredServers: () => readonly string[];
  /** Cache lifetime for successful publisher-list lookups. */
  readonly serverListTtlMs?: number;
  /** Injectable clock for deterministic cache tests. */
  readonly now?: () => number;
}

/** Paja-private bridge between OUTBOX event context and later RESOURCE reads. */
export interface PajaBlossomEventResolver {
  /** Observe returned events for one authenticated source window. */
  observe(windowId: string, results: readonly RelayEventResult[]): void;
  /** Decorate read operations so returned event resource context is observed. */
  decorate(router: OutboxRouter, windowId: string): OutboxRouter;
  /** Resolve event hints, publisher/user lists, and runtime fallbacks for one URL. */
  getServers(url: string, windowId?: string): Promise<readonly string[]>;
  /** Release event-derived context when its source window is destroyed. */
  clearWindow(windowId: string): void;
}

/**
 * Create Paja's lazy event-publisher Blossom resolver.
 *
 * OUTBOX reads only index already-delivered metadata. Network reads for the
 * publisher's BUD-03 list wait until the same source window requests the
 * indexed resource, avoiding speculative resource-host prefetch.
 */
export function createPajaBlossomEventResolver(
  options: PajaBlossomEventResolverOptions,
): PajaBlossomEventResolver {
  const now = options.now ?? Date.now;
  const ttl = Math.max(0, options.serverListTtlMs ?? DEFAULT_SERVER_LIST_TTL_MS);
  const windows = new Map<string, Map<string, ResourceContext[]>>();
  const serverLists = new Map<string, ServerListCacheEntry>();
  const pendingServerLists = new Map<string, Promise<string[]>>();

  function observe(windowId: string, results: readonly RelayEventResult[]): void {
    if (!windowId) return;
    let resources = windows.get(windowId);
    if (!resources) {
      resources = new Map();
      windows.set(windowId, resources);
    }
    for (const result of results) {
      const publisher = normalizePubkey(result.event.pubkey);
      if (!publisher) continue;
      for (const location of extractEventResourceLocations(result.event)) {
        if (!resources.has(location.url) && resources.size >= MAX_RESOURCES_PER_WINDOW) {
          const oldest = resources.keys().next().value as string | undefined;
          if (oldest) resources.delete(oldest);
        }
        const contexts = resources.get(location.url) ?? [];
        const next: ResourceContext = {
          ...location,
          eventId: result.event.id,
          publisher,
          createdAt: result.event.created_at,
        };
        const merged = [next, ...contexts.filter((context) => context.eventId !== next.eventId)]
          .sort(compareResourceContext)
          .slice(0, MAX_CONTEXTS_PER_RESOURCE);
        resources.set(location.url, merged);
      }
    }
  }

  function decorate(router: OutboxRouter, windowId: string): OutboxRouter {
    const getEvent = router.getEvent
      ? async (eventId: string, eventOptions?: Parameters<NonNullable<OutboxRouter['getEvent']>>[1]) => {
          const result = await router.getEvent!(eventId, eventOptions);
          if (result.result) observe(windowId, [result.result]);
          return result;
        }
      : undefined;
    return {
      ...(getEvent ? { getEvent } : {}),
      async query(filters, queryOptions) {
        const result = await router.query(filters, queryOptions);
        observe(windowId, result.events);
        return result;
      },
      subscribe(filters, subscribeOptions, sink): OutboxRouterSubscription {
        const observingSink: OutboxSubscriptionSink = {
          event(result) {
            observe(windowId, [result]);
            sink.event(result);
          },
          closed: (reason) => sink.closed(reason),
        };
        return router.subscribe(filters, subscribeOptions, observingSink);
      },
      publish: router.publish.bind(router),
      resolveRelays: router.resolveRelays.bind(router),
    };
  }

  async function getServers(url: string, windowId?: string): Promise<readonly string[]> {
    const canonical = parseBlossomReference(url)?.url;
    const contexts = canonical && windowId
      ? windows.get(windowId)?.get(canonical) ?? []
      : [];
    const servers: string[] = [];
    for (const context of contexts) appendUnique(servers, context.servers);

    if (servers.length < PAJA_RESOURCE_MAX_SERVERS) {
      const hintedAuthors: string[] = [];
      for (const context of contexts) appendUnique(hintedAuthors, context.authors);
      const authors = [...hintedAuthors];
      for (const context of contexts) appendUniqueWithoutLimit(authors, [context.publisher]);
      const defaultAuthors: string[] = [];
      for (const author of options.getDefaultAuthors?.() ?? []) {
        const normalized = normalizePubkey(author);
        if (normalized) appendUnique(defaultAuthors, [normalized]);
      }
      appendUniqueWithoutLimit(authors, defaultAuthors);
      const lists = await Promise.all(
        authors.map((author) => discoverServerList(author)),
      );
      for (const list of lists) appendUnique(servers, list);
    }
    appendUnique(servers, options.getConfiguredServers());
    return servers.slice(0, PAJA_RESOURCE_MAX_SERVERS);
  }

  async function discoverServerList(pubkey: string): Promise<string[]> {
    const cached = serverLists.get(pubkey);
    if (cached && cached.expiresAt > now()) return [...cached.servers];
    const pending = pendingServerLists.get(pubkey);
    if (pending) return [...await pending];

    const lookup = loadServerList(pubkey);
    pendingServerLists.set(pubkey, lookup);
    try {
      return [...await lookup];
    } finally {
      if (pendingServerLists.get(pubkey) === lookup) pendingServerLists.delete(pubkey);
    }
  }

  async function loadServerList(pubkey: string): Promise<string[]> {
    let result: OutboxResult;
    try {
      result = await options.baseRouter.query(
        [{ kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [pubkey], limit: 1 }],
        { authors: [pubkey], limit: 1 },
      );
    } catch {
      return [];
    }
    const newest = result.events
      .map((entry) => entry.event)
      .filter((event) => event.kind === BLOSSOM_SERVER_LIST_KIND && normalizePubkey(event.pubkey) === pubkey)
      .sort(compareNewestEvent)[0];
    if (!newest) {
      if (!result.error && !result.incomplete) {
        serverLists.set(pubkey, { expiresAt: now() + ttl, servers: [] });
      }
      return [];
    }
    const servers = newest.tags.flatMap((tag) => {
      if (tag[0] !== 'server' || typeof tag[1] !== 'string') return [];
      const server = normalizePublicBlossomServer(tag[1]);
      return server ? [server] : [];
    });
    const deduplicated: string[] = [];
    appendUnique(deduplicated, servers);
    serverLists.set(pubkey, { expiresAt: now() + ttl, servers: deduplicated });
    return deduplicated;
  }

  return {
    observe,
    decorate,
    getServers,
    clearWindow: (windowId) => windows.delete(windowId),
  };
}

function extractEventResourceLocations(event: NostrEvent): EventResourceLocation[] {
  const locations = new Map<string, EventResourceLocation>();
  const globalServers = event.tags.flatMap((tag) => {
    if (tag[0] !== 'server' || typeof tag[1] !== 'string') return [];
    const server = normalizeEventServer(tag[1]);
    return server ? [server] : [];
  });

  const add = (value: string | undefined, servers: readonly string[] = [], authors: readonly string[] = []) => {
    if (!value) return;
    const parsed = parseBlossomReference(value);
    if (!parsed) return;
    const existing = locations.get(parsed.url) ?? {
      url: parsed.url,
      servers: [],
      authors: [],
    };
    appendUnique(existing.servers, [
      ...parsed.servers,
      ...servers.flatMap((server) => {
        const normalized = normalizeEventServer(server);
        return normalized ? [normalized] : [];
      }),
      ...globalServers,
    ]);
    appendUnique(existing.authors, [
      ...parsed.authors,
      ...authors.flatMap((author) => {
        const normalized = normalizePubkey(author);
        return normalized ? [normalized] : [];
      }),
    ]);
    locations.set(parsed.url, existing);
  };

  for (const tag of event.tags) {
    if ((tag[0] === 'resource' || tag[0] === 'r') && typeof tag[1] === 'string') {
      add(tag[1]);
    } else if (tag[0] === 'blossom' && typeof tag[1] === 'string') {
      add(HEX_64.test(tag[1]) ? `blossom:sha256:${tag[1]}` : tag[1]);
    }
  }

  const content = parseEventContent(event.content);
  if (content) {
    const contentServers = stringList(content.servers);
    for (const key of ['sources', 'resources'] as const) {
      const entries = content[key];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (typeof entry === 'string') {
          add(entry, contentServers);
          continue;
        }
        if (!isRecord(entry)) continue;
        const value = stringValue(entry.uri)
          ?? stringValue(entry.url)
          ?? stringValue(entry.resource)
          ?? (isBlossomRecord(entry) && isHash(entry.sha256)
            ? `blossom:sha256:${String(entry.sha256)}`
            : undefined);
        add(value, [...contentServers, ...stringList(entry.servers)], stringList(entry.authors));
      }
    }
  }
  return [...locations.values()];
}

function parseBlossomReference(value: string): EventResourceLocation | null {
  const match = BLOSSOM_REFERENCE.exec(value.trim());
  if (!match?.[1]) return null;
  const params = new URLSearchParams(match[2] ?? '');
  const servers = params.getAll('xs').flatMap((server) => {
    const normalized = normalizeEventServer(server);
    return normalized ? [normalized] : [];
  });
  const authors = params.getAll('as').flatMap((author) => {
    const normalized = normalizePubkey(author);
    return normalized ? [normalized] : [];
  });
  return {
    url: `blossom:sha256:${match[1].toLowerCase()}`,
    servers,
    authors,
  };
}

function normalizeEventServer(value: string): string | null {
  const normalized = normalizePublicBlossomServer(value);
  if (normalized) return normalized;
  const trimmed = value.trim();
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) return null;
  return normalizePublicBlossomServer(`https://${trimmed}`);
}

function parseEventContent(value: string): Record<string, unknown> | null {
  if (!value.startsWith('{') || value.length > 256 * 1024) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function compareResourceContext(left: ResourceContext, right: ResourceContext): number {
  if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
  return left.eventId.localeCompare(right.eventId);
}

function compareNewestEvent(left: NostrEvent, right: NostrEvent): number {
  if (left.created_at !== right.created_at) return right.created_at - left.created_at;
  return left.id.localeCompare(right.id);
}

function normalizePubkey(value: unknown): string | null {
  return typeof value === 'string' && HEX_64.test(value) ? value.toLowerCase() : null;
}

function appendUnique(target: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
    if (target.length >= PAJA_RESOURCE_MAX_SERVERS) return;
  }
}

function appendUniqueWithoutLimit(target: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isHash(value: unknown): boolean {
  return typeof value === 'string' && HEX_64.test(value);
}

function isBlossomRecord(value: Record<string, unknown>): boolean {
  return value.type === 'blossom' || value.kind === 'blossom';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
