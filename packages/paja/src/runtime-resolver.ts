import { injectNappletCsp } from '@kehto/shell';
import type { NostrEvent } from 'nostr-tools';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { decode } from 'nostr-tools/nip19';
import {
  fetchBlob,
  isNappletManifestKind,
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
  NAPPLET_KINDS,
  openNappletArtifactCache,
  resolveNapplet,
  type ResolvedNapplet,
} from '@kehto/nip/5d';

import { normalizePublicBlossomServer } from './browser-resource.js';

/** Named/addressable NIP-5D napplet manifest kind (`35129`). */
export const PAJA_NAPPLET_MANIFEST_KIND = NAPPLET_KIND_NAMED;
/** All NIP-5D napplet manifest kinds accepted by Paja pointers (`5129`, `15129`, `35129`). */
export const PAJA_NAPPLET_MANIFEST_KINDS = NAPPLET_KINDS;

/** Decoded naddr/nevent pointer accepted by Paja runtime-pointer mode. */
export type PajaDecodedPointer =
  | {
    readonly type: 'naddr';
    readonly value: string;
    readonly identifier: string;
    readonly pubkey: string;
    readonly kind: number;
    readonly relays: readonly string[];
  }
  | {
    readonly type: 'nevent';
    readonly value: string;
    readonly id: string;
    readonly author?: string;
    readonly kind?: number;
    readonly relays: readonly string[];
  };

/** Fully resolved pointer plus verified napplet artifact bytes. */
export interface PajaResolvedPointer {
  /** Decoded pointer input. */
  readonly pointer: PajaDecodedPointer;
  /** Manifest event resolved from relays. */
  readonly event: NostrEvent;
  /** Ordered relay URLs queried for the pointer, with embedded hints first. */
  readonly relays: readonly string[];
  /** Blossom server hints used for blob fetches. */
  readonly blossomServers: readonly string[];
  /** Resolved manifest `d` tag. */
  readonly dTag: string;
  /** Verified content identity: current artifact hash or legacy NIP-5A aggregate. */
  readonly aggregateHash: string;
  /** Verified target `/index.html` content. */
  readonly indexHtml: string;
  /** Parsed NIP-5D manifest. */
  readonly manifest: ResolvedNapplet['manifest'];
}

/** Relay-pool contract for runtime-pointer resolution. */
export interface PajaPointerRelayPool {
  /** Query relays synchronously for matching manifest events. */
  querySync(
    relays: string[],
    filter: Filter,
    params?: { readonly maxWait?: number; readonly label?: string; readonly id?: string },
  ): Promise<NostrEvent[]>;
  /** Subscribe until all relays reach EOSE, fail, or the shared deadline expires. */
  subscribeManyEose?(
    relays: string[],
    filter: Filter,
    params: {
      readonly maxWait?: number;
      readonly label?: string;
      readonly id?: string;
      readonly onevent: (event: NostrEvent) => void;
      readonly onclose: (reasons: string[]) => void;
    },
  ): { close(reason?: string): void | Promise<void> };
  /** Open (or reuse) the connection to one relay; rejects when it cannot connect. */
  ensureRelay?(
    url: string,
    params?: { readonly connectionTimeout?: number },
  ): Promise<unknown>;
  close?(relays: string[]): void;
  destroy?(): void;
}

/**
 * Per-relay connection outcomes observed while a pointer was being resolved.
 *
 * @example
 * ```ts
 * const summary: PajaRelayConnectionSummary = {
 *   total: 3, connected: [], pending: ['wss://slow.example'],
 *   failed: [{ url: 'wss://down.example', reason: 'connection failed' }],
 * };
 * ```
 */
export interface PajaRelayConnectionSummary {
  /** Distinct relays the resolver tried to reach. */
  readonly total: number;
  /** Relays whose WebSocket opened. */
  readonly connected: readonly string[];
  /** Relays whose connection attempt failed, with the transport reason. */
  readonly failed: readonly { readonly url: string; readonly reason: string }[];
  /** Relays still connecting when the query settled. */
  readonly pending: readonly string[];
}

/**
 * Thrown when pointer resolution could not open a single relay connection.
 *
 * Zero connections means the manifest was never asked for — the browser is
 * offline, the relays are blocked, or the browser reached its WebSocket
 * connection limit (for example many tabs each holding relay sockets). Hosts
 * surface this distinctly from a slow relay or a missing manifest.
 *
 * @example
 * ```ts
 * try {
 *   await resolvePajaPointer(pointer);
 * } catch (error) {
 *   if (error instanceof PajaRelayUnreachableError) showRelayBanner(error.connections);
 * }
 * ```
 */
export class PajaRelayUnreachableError extends Error {
  /** Stable discriminator for hosts that cannot rely on `instanceof` across bundles. */
  readonly code = 'relay-unreachable' as const;

  constructor(
    message: string,
    /** What the resolver observed per relay. */
    readonly connections: PajaRelayConnectionSummary,
  ) {
    super(message);
    this.name = 'PajaRelayUnreachableError';
  }
}

/** Options for resolving a Paja runtime pointer. */
export interface ResolvePajaPointerOptions {
  /** Relay pool override; defaults to a `nostr-tools` `SimplePool`. */
  readonly pool?: PajaPointerRelayPool;
  /** Fetch override used for Blossom blob URLs. */
  readonly fetcher?: (url: string) => Promise<Response>;
  /** Extra relay candidates appended after embedded pointer hints. */
  readonly relays?: readonly string[];
  /** Extra Blossom server hints appended during artifact fetch. */
  readonly blossomServers?: readonly string[];
  /** One overall deadline for relay connection, fanout, and EOSE in milliseconds. */
  readonly maxWaitMs?: number;
}

/**
 * Decode a NIP-19 naddr/nevent pointer for Paja runtime-pointer mode.
 *
 * @param value - NIP-19 pointer string.
 * @returns Structured pointer metadata.
 */
export function decodePajaPointer(value: string): PajaDecodedPointer {
  const trimmed = value.trim();
  const decoded = decode(trimmed);
  if (decoded.type === 'naddr') {
    return {
      type: 'naddr',
      value: trimmed,
      identifier: decoded.data.identifier,
      pubkey: decoded.data.pubkey,
      kind: decoded.data.kind,
      relays: [...(decoded.data.relays ?? [])],
    };
  }
  if (decoded.type === 'nevent') {
    return {
      type: 'nevent',
      value: trimmed,
      id: decoded.data.id,
      ...(decoded.data.author ? { author: decoded.data.author } : {}),
      ...(decoded.data.kind ? { kind: decoded.data.kind } : {}),
      relays: [...(decoded.data.relays ?? [])],
    };
  }
  throw new Error(`Expected naddr or nevent pointer, got ${decoded.type}.`);
}

/**
 * Resolve a Paja runtime pointer into verified napplet HTML and manifest data.
 *
 * @param value - NIP-19 naddr or nevent pointer.
 * @param options - Relay, fetch, and Blossom overrides.
 * @returns Verified napplet artifact ready for srcdoc injection.
 */
export async function resolvePajaPointer(
  value: string,
  options: ResolvePajaPointerOptions = {},
): Promise<PajaResolvedPointer> {
  const pointer = decodePajaPointer(value);
  const relays = uniqueRelayUrls([...pointer.relays, ...(options.relays ?? [])]);
  if (relays.length === 0) {
    throw new Error('Pointer has no relay hints or enabled configured live relays.');
  }

  const pool = options.pool ?? new SimplePool();
  const ownsPool = options.pool === undefined;
  try {
    const event = await resolvePointerEvent(pointer, pool, relays, normalizeMaxWaitMs(options.maxWaitMs));
    const blossomServers = resolvePointerBlossomServers(event, options.blossomServers ?? []);
    const resolved = await resolveNapplet({
      event,
      cache: await openNappletArtifactCache({ requireStorageEstimate: false }),
      fetchBlob: (sha256Hex, servers) =>
        fetchBlob([...servers, ...blossomServers], sha256Hex, async (url) => {
          const response = await (options.fetcher ?? fetch)(url);
          if (!response.ok) throw new Error(`[paja-runtime] blob ${url}: ${response.status}`);
          return new Uint8Array(await response.arrayBuffer());
        }),
    });
    return {
      pointer,
      event,
      relays,
      blossomServers,
      dTag: resolved.dTag,
      aggregateHash: resolved.aggregateHash,
      indexHtml: resolved.indexHtml,
      manifest: resolved.manifest,
    };
  } finally {
    if (ownsPool) {
      pool.close?.(relays);
      pool.destroy?.();
    }
  }
}

function resolvePointerBlossomServers(
  event: NostrEvent,
  configured: readonly string[],
): string[] {
  const servers: string[] = [];
  for (const value of event.tags.flatMap(
    (tag) => tag[0] === 'server' && tag[1] ? [tag[1]] : [],
  )) {
    const normalized = normalizePublicBlossomServer(value);
    if (normalized && !servers.includes(normalized)) servers.push(normalized);
  }
  for (const value of configured) {
    const server = normalizePublicBlossomServer(value) ?? value;
    if (!servers.includes(server)) servers.push(server);
  }
  return servers;
}

/**
 * Inject Kehto's Class-1 CSP for verified runtime-pointer srcdoc output.
 * Delegates to the shell policy, which enforces NIP-5D CSP recommendations.
 *
 * @param html - Verified target HTML.
 * @param origins - Origins the resolved target may connect to.
 * @returns HTML with a CSP meta tag inserted.
 */
export function injectPajaRuntimeCsp(html: string, origins: readonly string[]): string {
  return injectNappletCsp(html, { connectOrigins: origins });
}

async function resolvePointerEvent(
  pointer: PajaDecodedPointer,
  pool: PajaPointerRelayPool,
  relays: readonly string[],
  maxWaitMs: number,
): Promise<NostrEvent> {
  const filter = pointer.type === 'naddr'
    ? addressableFilter(pointer)
    : eventFilter(pointer);
  const result = await queryPointerRelays(pool, relays, filter, maxWaitMs);
  const event = result.events
    .filter((candidate) => matchesPointer(pointer, candidate))
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0];
  if (!event) {
    const connections = result.connections;
    // Zero opened sockets is a different failure from a slow relay or a
    // missing manifest: the query never reached any relay. Report it first so
    // a deadline expiry does not disguise it as "timed out".
    if (connections && connections.total > 0 && connections.connected.length === 0) {
      throw new PajaRelayUnreachableError(
        describeRelayUnreachable(pointer.type, connections, maxWaitMs),
        connections,
      );
    }
    if (result.timedOut) {
      const connectedNote = connections
        ? ` (${connections.connected.length} of ${connections.total} relays connected)`
        : '';
      throw new Error(
        `Relay resolution timed out after ${maxWaitMs}ms for ${pointer.type} pointer across ${relays.length} relays before complete EOSE${connectedNote}.`,
      );
    }
    const failures = relayFailureReasons(result.reasons);
    if (result.error || failures.length > 0) {
      const detail = result.error instanceof Error
        ? result.error.message
        : result.error === undefined
          ? failures.join('; ')
          : String(result.error);
      throw new Error(`Relay query failed for ${pointer.type} pointer before complete EOSE: ${detail}`);
    }
    throw new Error(
      `All ${relays.length} relays reached EOSE without a matching ${pointer.type} napplet manifest event.`,
    );
  }
  if (!isNappletManifestKind(event.kind)) {
    throw new Error(`Pointer resolved kind ${event.kind}; expected ${formatNappletManifestKinds()}.`);
  }
  return event;
}

interface PointerRelayQueryResult {
  readonly events: readonly NostrEvent[];
  readonly reasons: readonly string[];
  readonly timedOut: boolean;
  readonly error?: unknown;
  /** Present when the pool exposes `ensureRelay`; snapshot taken as the query settled. */
  readonly connections?: PajaRelayConnectionSummary;
}

async function queryPointerRelays(
  pool: PajaPointerRelayPool,
  relays: readonly string[],
  filter: Filter,
  maxWaitMs: number,
): Promise<PointerRelayQueryResult> {
  const tracker = trackRelayConnections(pool, relays, maxWaitMs);
  const result = pool.subscribeManyEose
    ? await queryPointerRelaySubscription(pool, relays, filter, maxWaitMs)
    : await queryPointerRelaySync(pool, relays, filter, maxWaitMs);
  return tracker ? { ...result, connections: tracker.snapshot() } : result;
}

/**
 * Observe each relay's connection outcome alongside the query. `ensureRelay`
 * is idempotent in nostr-tools (it reuses the relay the subscription opens),
 * so this adds no sockets — it only tells us whether any opened.
 */
function trackRelayConnections(
  pool: PajaPointerRelayPool,
  relays: readonly string[],
  maxWaitMs: number,
): { snapshot(): PajaRelayConnectionSummary } | null {
  const ensureRelay = pool.ensureRelay?.bind(pool);
  if (!ensureRelay) return null;
  const urls = [...new Set(relays)];
  const connected: string[] = [];
  const failed: { url: string; reason: string }[] = [];
  const pending = new Set(urls);
  for (const url of urls) {
    const settle = (outcome: 'connected' | 'failed', reason?: string): void => {
      if (!pending.delete(url)) return;
      if (outcome === 'connected') connected.push(url);
      else failed.push({ url, reason: reason ?? 'connection failed' });
    };
    try {
      ensureRelay(url, { connectionTimeout: maxWaitMs }).then(
        () => settle('connected'),
        (error: unknown) => settle('failed', describeRelayFailure(error)),
      );
    } catch (error) {
      settle('failed', describeRelayFailure(error));
    }
  }
  return {
    snapshot: () => ({
      total: urls.length,
      connected: [...connected],
      failed: [...failed],
      pending: [...pending],
    }),
  };
}

function describeRelayFailure(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = text.trim();
  return (trimmed.length > 0 ? trimmed : 'connection failed').slice(0, 160);
}

function describeRelayUnreachable(
  pointerType: string,
  connections: PajaRelayConnectionSummary,
  maxWaitMs: number,
): string {
  const reasons = relayFailureReasons(connections.failed.map((entry) => entry.reason));
  const parts = [
    `No relay connection could be opened for the ${pointerType} pointer: 0 of ${connections.total} relays connected within ${maxWaitMs}ms`
      + ` (${connections.failed.length} failed, ${connections.pending.length} still connecting).`,
    'The browser is offline, the relays are blocked, or the browser reached its WebSocket connection limit'
      + ' (for example many open tabs each holding relay connections) — close some tabs and retry.',
  ];
  if (reasons.length > 0) parts.push(`Relay errors: ${reasons.join('; ')}.`);
  return parts.join(' ');
}

function queryPointerRelaySubscription(
  pool: PajaPointerRelayPool,
  relays: readonly string[],
  filter: Filter,
  maxWaitMs: number,
): Promise<PointerRelayQueryResult> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    let settled = false;
    let subscription: ReturnType<NonNullable<PajaPointerRelayPool['subscribeManyEose']>> | undefined;
    const finish = (result: Omit<PointerRelayQueryResult, 'events'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ events, ...result });
    };
    const deadline = setTimeout(() => {
      finish({ reasons: [], timedOut: true });
      void subscription?.close('Paja pointer relay deadline exceeded');
    }, maxWaitMs);

    try {
      subscription = pool.subscribeManyEose!([...relays], filter, {
        maxWait: maxWaitMs,
        label: 'kehto-paja-runtime',
        onevent(event) {
          events.push(event);
        },
        onclose(reasons) {
          finish({ reasons, timedOut: false });
        },
      });
    } catch (error) {
      finish({ reasons: [], timedOut: false, error });
    }
  });
}

function queryPointerRelaySync(
  pool: PajaPointerRelayPool,
  relays: readonly string[],
  filter: Filter,
  maxWaitMs: number,
): Promise<PointerRelayQueryResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PointerRelayQueryResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    const deadline = setTimeout(() => {
      finish({ events: [], reasons: [], timedOut: true });
    }, maxWaitMs);

    void pool.querySync([...relays], filter, {
      maxWait: maxWaitMs,
      label: 'kehto-paja-runtime',
    }).then(
      (events) => finish({ events, reasons: [], timedOut: false }),
      (error: unknown) => finish({ events: [], reasons: [], timedOut: false, error }),
    );
  });
}

function relayFailureReasons(reasons: readonly string[]): string[] {
  return [...new Set(reasons
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0 && reason !== 'closed automatically on eose')
    .map((reason) => reason.slice(0, 160)))]
    .slice(0, 3);
}

function normalizeMaxWaitMs(value: number | undefined): number {
  if (value === undefined) return 5_000;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Pointer relay deadline must be a positive number of milliseconds.');
  }
  return Math.floor(value);
}

function addressableFilter(pointer: Extract<PajaDecodedPointer, { type: 'naddr' }>): Filter {
  // NIP-19: replaceable root coordinates use an empty identifier and no #d.
  // NIP-5D snapshots are regular events; only nevent can pin their identity.
  if (pointer.kind === NAPPLET_KIND_SNAPSHOT) {
    throw new Error('NIP-5D snapshot kind 5129 requires a nevent pointer with its signed event ID.');
  }
  if (pointer.kind !== NAPPLET_KIND_NAMED && pointer.kind !== NAPPLET_KIND_ROOT) {
    throw new Error(`naddr kind ${pointer.kind} is not a root or named NIP-5D napplet manifest kind.`);
  }
  if (pointer.kind === NAPPLET_KIND_ROOT && pointer.identifier !== '') {
    throw new Error('NIP-5D root naddr requires an empty identifier.');
  }
  if (pointer.kind === NAPPLET_KIND_NAMED && pointer.identifier === '') {
    throw new Error('NIP-5D named naddr requires a non-empty identifier.');
  }
  return {
    kinds: [pointer.kind],
    authors: [pointer.pubkey],
    ...(pointer.kind === NAPPLET_KIND_NAMED ? { '#d': [pointer.identifier] } : {}),
    limit: 1,
  };
}

function eventFilter(pointer: Extract<PajaDecodedPointer, { type: 'nevent' }>): Filter {
  return {
    ids: [pointer.id],
    ...(pointer.kind ? { kinds: [pointer.kind] } : {}),
    ...(pointer.author ? { authors: [pointer.author] } : {}),
    limit: 1,
  };
}

function matchesPointer(pointer: PajaDecodedPointer, event: NostrEvent): boolean {
  if (pointer.type === 'nevent') {
    if (event.id !== pointer.id) return false;
    if (pointer.author && event.pubkey !== pointer.author) return false;
    if (pointer.kind && event.kind !== pointer.kind) return false;
    return true;
  }
  return event.kind === pointer.kind
    && event.pubkey === pointer.pubkey
    && (pointer.kind === NAPPLET_KIND_ROOT
      || event.tags.some((tag) => tag[0] === 'd' && tag[1] === pointer.identifier));
}

function uniqueRelayUrls(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const url = normalizeRelayUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function normalizeRelayUrl(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return undefined;
    url.hash = '';
    url.search = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function formatNappletManifestKinds(): string {
  return PAJA_NAPPLET_MANIFEST_KINDS.join(' / ');
}
