import type { NostrEvent } from 'nostr-tools';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { decode } from 'nostr-tools/nip19';
import {
  fetchBlob,
  openNappletArtifactCache,
  resolveNapplet,
  type ResolvedNapplet,
} from '@kehto/nip/5d';

export const PAJA_NAPPLET_MANIFEST_KIND = 35129;

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

export interface PajaResolvedPointer {
  readonly pointer: PajaDecodedPointer;
  readonly event: NostrEvent;
  readonly relays: readonly string[];
  readonly blossomServers: readonly string[];
  readonly dTag: string;
  readonly aggregateHash: string;
  readonly indexHtml: string;
  readonly manifest: ResolvedNapplet['manifest'];
}

export interface PajaPointerRelayPool {
  querySync(
    relays: string[],
    filter: Filter,
    params?: { readonly maxWait?: number; readonly label?: string; readonly id?: string },
  ): Promise<NostrEvent[]>;
  close?(relays: string[]): void;
  destroy?(): void;
}

export interface ResolvePajaPointerOptions {
  readonly pool?: PajaPointerRelayPool;
  readonly fetcher?: (url: string) => Promise<Response>;
  readonly relays?: readonly string[];
  readonly blossomServers?: readonly string[];
  readonly maxWaitMs?: number;
}

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
  if (event.kind !== PAJA_NAPPLET_MANIFEST_KIND) {
    throw new Error(`Pointer resolved kind ${event.kind}; expected ${PAJA_NAPPLET_MANIFEST_KIND}.`);
  }
  return event;
}

function addressableFilter(pointer: Extract<PajaDecodedPointer, { type: 'naddr' }>): Filter {
  if (pointer.kind !== PAJA_NAPPLET_MANIFEST_KIND) {
    throw new Error(`naddr kind ${pointer.kind} is not a napplet manifest kind.`);
  }
  return {
    kinds: [PAJA_NAPPLET_MANIFEST_KIND],
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
