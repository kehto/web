import type { NostrEvent } from 'nostr-tools';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { decode } from 'nostr-tools/nip19';
import {
  fetchBlob,
  isNappletManifestKind,
  NAPPLET_KIND_NAMED,
  NAPPLET_KINDS,
  openNappletArtifactCache,
  resolveNapplet,
  type ResolvedNapplet,
} from '@kehto/nip/5d';

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
  /** Relay URLs queried for the pointer. */
  readonly relays: readonly string[];
  /** Blossom server hints used for blob fetches. */
  readonly blossomServers: readonly string[];
  /** Resolved manifest `d` tag. */
  readonly dTag: string;
  /** Verified NIP-5A aggregate hash. */
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
  close?(relays: string[]): void;
  destroy?(): void;
}

/** Options for resolving a Paja runtime pointer. */
export interface ResolvePajaPointerOptions {
  /** Relay pool override; defaults to a `nostr-tools` `SimplePool`. */
  readonly pool?: PajaPointerRelayPool;
  /** Fetch override used for Blossom blob URLs. */
  readonly fetcher?: (url: string) => Promise<Response>;
  /** Extra relay hints appended to pointer relays. */
  readonly relays?: readonly string[];
  /** Extra Blossom server hints appended during artifact fetch. */
  readonly blossomServers?: readonly string[];
  /** Maximum relay query wait in milliseconds. */
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
    throw new Error('Pointer does not include relay hints; add a relay-bearing naddr or nevent.');
  }

  const pool = options.pool ?? new SimplePool();
  const ownsPool = options.pool === undefined;
  try {
    const event = await resolvePointerEvent(pointer, pool, relays, options.maxWaitMs ?? 5_000);
    const blossomServers = [...(options.blossomServers ?? [])];
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

/**
 * Inject a restrictive connect-src CSP for runtime-pointer srcdoc output.
 *
 * @param html - Verified target HTML.
 * @param origins - Origins the resolved target may connect to.
 * @returns HTML with a CSP meta tag inserted.
 */
export function injectPajaRuntimeCsp(html: string, origins: readonly string[]): string {
  const value = origins.length > 0
    ? `connect-src ${[...new Set(origins)].sort().join(' ')}`
    : "connect-src 'none'";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(value)}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${meta}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${meta}</head>`);
  }
  return `${meta}${html}`;
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
  const events = await pool.querySync([...relays], filter, {
    maxWait: maxWaitMs,
    label: 'kehto-paja-runtime',
  });
  const event = events
    .filter((candidate) => matchesPointer(pointer, candidate))
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (!event) {
    throw new Error(`No napplet manifest event found for ${pointer.type} pointer.`);
  }
  if (!isNappletManifestKind(event.kind)) {
    throw new Error(`Pointer resolved kind ${event.kind}; expected ${formatNappletManifestKinds()}.`);
  }
  return event;
}

function addressableFilter(pointer: Extract<PajaDecodedPointer, { type: 'naddr' }>): Filter {
  if (pointer.kind !== NAPPLET_KIND_NAMED) {
    throw new Error(`naddr kind ${pointer.kind} is not a named NIP-5D napplet manifest kind.`);
  }
  return {
    kinds: [NAPPLET_KIND_NAMED],
    authors: [pointer.pubkey],
    '#d': [pointer.identifier],
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
    && event.tags.some((tag) => tag[0] === 'd' && tag[1] === pointer.identifier);
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

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatNappletManifestKinds(): string {
  return PAJA_NAPPLET_MANIFEST_KINDS.join(' / ');
}
