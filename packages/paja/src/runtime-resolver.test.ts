import { describe, expect, it } from 'vitest';
import { finalizeEvent } from 'nostr-tools/pure';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';
import type { NostrEvent } from 'nostr-tools';
import { computeAggregateHash } from '@kehto/nip/5a';
import {
  NAPPLET_KIND_NAMED,
  NAPPLET_KIND_ROOT,
  NAPPLET_KIND_SNAPSHOT,
} from '@kehto/nip/5d';

import {
  PAJA_NAPPLET_MANIFEST_KIND,
  PAJA_NAPPLET_MANIFEST_KINDS,
  decodePajaPointer,
  injectPajaRuntimeCsp,
  resolvePajaPointer,
  type PajaPointerRelayPool,
  PajaRelayUnreachableError,
} from './runtime-resolver.js';

const SK = Uint8Array.from('11'.repeat(32).match(/.{2}/g)!.map((part) => parseInt(part, 16)));
const enc = new TextEncoder();
const RELAY = 'wss://relay.example';
const BLOSSOM = 'https://blossom.example';

async function sha256hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface BuildManifestOptions {
  readonly format?: 'current' | 'legacy';
  readonly dTag?: string;
  readonly kind?: number;
  readonly aggregateOverride?: string;
}

async function buildManifestFixture(options: BuildManifestOptions = {}) {
  const dTag = options.dTag ?? 'runtime-target';
  const kind = options.kind ?? NAPPLET_KIND_NAMED;
  const bytes = enc.encode('<!doctype html><html><head><title>runtime</title></head><body>ok</body></html>');
  const hash = await sha256hex(bytes);
  const aggregateHash = options.format === 'current' ? hash : computeAggregateHash([{ path: '/index.html', sha256: hash }]);
  const event = finalizeEvent({
    kind,
    created_at: 1_700_000_000,
    tags: [
      ...(kind === NAPPLET_KIND_NAMED ? [['d', dTag]] : []),
      ...(options.format === 'current' ? [['x', options.aggregateOverride ?? hash]] : [
        ['path', '/index.html', hash], ['x', options.aggregateOverride ?? aggregateHash, 'aggregate'],
      ]),
      ['server', BLOSSOM],
    ],
    content: options.format === 'current' ? 'Runtime test napplet' : '',
  }, SK);
  return { event: event as NostrEvent, bytes, hash, aggregateHash, dTag };
}

interface RelayQueryCall {
  readonly relays: readonly string[];
  readonly maxWait?: number;
}

function fakePool(events: readonly NostrEvent[]): PajaPointerRelayPool & {
  filters: unknown[];
  calls: RelayQueryCall[];
} {
  const filters: unknown[] = [];
  const calls: RelayQueryCall[] = [];
  return {
    filters,
    calls,
    async querySync(relays, filter, params) {
      filters.push(filter);
      calls.push({ relays, maxWait: params?.maxWait });
      return events.filter((event) => {
        const ids = filter.ids as string[] | undefined;
        const authors = filter.authors as string[] | undefined;
        const kinds = filter.kinds as number[] | undefined;
        const dTags = filter['#d'] as string[] | undefined;
        if (ids && !ids.includes(event.id)) return false;
        if (authors && !authors.includes(event.pubkey)) return false;
        if (kinds && !kinds.includes(event.kind)) return false;
        if (dTags && !event.tags.some((tag) => tag[0] === 'd' && dTags.includes(tag[1] ?? ''))) return false;
        return true;
      });
    },
  };
}

function closingPool(
  events: readonly NostrEvent[],
  reasons: readonly string[],
): PajaPointerRelayPool {
  return {
    async querySync() {
      throw new Error('querySync fallback should not run');
    },
    subscribeManyEose(_relays, _filter, params) {
      const timer = setTimeout(() => {
        for (const event of events) params.onevent(event);
        params.onclose([...reasons]);
      }, 0);
      return { close: () => clearTimeout(timer) };
    },
  };
}

function fakeFetcher(hash: string, bytes: Uint8Array) {
  return async (url: string): Promise<Response> => {
    if (url === `${BLOSSOM}/${hash}`) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer,
      } as Response;
    }
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
}

describe.each(['current', 'legacy'] as const)('Paja %s runtime pointer resolver', (format) => {
  const buildManifest = (options: BuildManifestOptions = {}) => buildManifestFixture({ ...options, format });
  const classOnePrefix = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";
  const classOneSuffix = "worker-src 'none'; child-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'";

  it('injects the complete Class-1 policy with only sorted, deduplicated grants', () => {
    const out = injectPajaRuntimeCsp(
      '<html><head></head><body>verified</body></html>',
      ['https://b.example', 'https://a.example', 'https://b.example'],
    );

    expect(out).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${classOnePrefix} connect-src https://a.example https://b.example; ${classOneSuffix}">`,
    );
    expect(out).not.toContain("connect-src 'self'");
    expect(out).not.toContain('connect-src *');
    expect(out).not.toContain("'unsafe-eval'");
  });

  it("uses the complete Class-1 policy with connect-src 'none' for no grants", () => {
    const out = injectPajaRuntimeCsp('<html><head></head></html>', []);
    expect(out).toContain(`content="${classOnePrefix} connect-src 'none'; ${classOneSuffix}"`);
  });

  it('exports the NIP-5D napplet manifest kinds', () => {
    expect(PAJA_NAPPLET_MANIFEST_KIND).toBe(NAPPLET_KIND_NAMED);
    expect([...PAJA_NAPPLET_MANIFEST_KINDS].sort((a, b) => a - b)).toEqual([
      NAPPLET_KIND_SNAPSHOT,
      NAPPLET_KIND_ROOT,
      NAPPLET_KIND_NAMED,
    ].sort((a, b) => a - b));
  });

  it('decodes and resolves an naddr napplet manifest pointer', async () => {
    const manifest = await buildManifest();
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    expect(decodePajaPointer(pointer)).toMatchObject({
      type: 'naddr',
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.dTag).toBe(manifest.dTag);
    expect(resolved.aggregateHash).toBe(manifest.aggregateHash);
    expect(resolved.blossomServers).toEqual([BLOSSOM]);
    expect(resolved.indexHtml).toContain('<body>ok</body>');
    expect(pool.filters[0]).toMatchObject({
      kinds: [PAJA_NAPPLET_MANIFEST_KIND],
      authors: [manifest.event.pubkey],
      '#d': [manifest.dTag],
    });
  });

  it('keeps embedded hints first, deduplicates URLs, and resolves from a configured live relay', async () => {
    const manifest = await buildManifest({ dTag: 'configured-fallback' });
    const fallbackRelay = 'wss://fallback.example';
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [`${RELAY}/`],
    });
    const calls: RelayQueryCall[] = [];
    const pool: PajaPointerRelayPool = {
      async querySync(relays, _filter, params) {
        calls.push({ relays, maxWait: params?.maxWait });
        return relays.includes(fallbackRelay) ? [manifest.event] : [];
      },
    };

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      relays: [RELAY, `${fallbackRelay}/`, fallbackRelay],
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.event.id).toBe(manifest.event.id);
    expect(resolved.relays).toEqual([RELAY, fallbackRelay]);
    expect(calls).toEqual([{ relays: [RELAY, fallbackRelay], maxWait: 5_000 }]);
  });

  it('uses one overall deadline instead of extending it for each fallback relay', async () => {
    const manifest = await buildManifest({ dTag: 'deadline' });
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const calls: RelayQueryCall[] = [];
    let closed = false;
    const pool: PajaPointerRelayPool = {
      async querySync() {
        throw new Error('querySync fallback should not run');
      },
      subscribeManyEose(relays, _filter, params) {
        calls.push({ relays, maxWait: params.maxWait });
        return { close: () => { closed = true; } };
      },
    };
    const startedAt = Date.now();

    await expect(resolvePajaPointer(pointer, {
      pool,
      relays: ['wss://fallback-one.example', 'wss://fallback-two.example'],
      maxWaitMs: 25,
    })).rejects.toThrow(/timed out after 25ms/);

    expect(Date.now() - startedAt).toBeLessThan(150);
    expect(calls).toEqual([{
      relays: [RELAY, 'wss://fallback-one.example', 'wss://fallback-two.example'],
      maxWait: 25,
    }]);
    expect(closed).toBe(true);
  });

  it('distinguishes all-relays EOSE no-match from relay connection failure', async () => {
    const manifest = await buildManifest({ dTag: 'diagnostics' });
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });

    await expect(resolvePajaPointer(pointer, {
      pool: closingPool([], ['closed automatically on eose']),
    })).rejects.toThrow(/reached EOSE without a matching naddr/);

    await expect(resolvePajaPointer(pointer, {
      pool: closingPool([], ['connection refused']),
    })).rejects.toThrow(/Relay query failed.*connection refused/);
  });

  it('decodes and resolves a nevent napplet snapshot pointer by event id', async () => {
    const manifest = await buildManifest({ dTag: 'snapshot-target' });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    expect(decodePajaPointer(pointer)).toMatchObject({
      type: 'nevent',
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.dTag).toBe('snapshot-target');
    expect(resolved.event.id).toBe(manifest.event.id);
    expect(pool.filters[0]).toMatchObject({ ids: [manifest.event.id] });
  });

  it('resolves NIP-5D snapshot manifest nevent pointers', async () => {
    const manifest = await buildManifest({ kind: NAPPLET_KIND_SNAPSHOT });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: NAPPLET_KIND_SNAPSHOT,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.event.kind).toBe(NAPPLET_KIND_SNAPSHOT);
    expect(resolved.dTag).toBe('');
    expect(pool.filters[0]).toMatchObject({
      ids: [manifest.event.id],
      kinds: [NAPPLET_KIND_SNAPSHOT],
    });
  });

  it('resolves NIP-5D root manifest nevent pointers', async () => {
    const manifest = await buildManifest({ kind: NAPPLET_KIND_ROOT });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: NAPPLET_KIND_ROOT,
      relays: [RELAY],
    });
    const pool = fakePool([manifest.event]);

    const resolved = await resolvePajaPointer(pointer, {
      pool,
      fetcher: fakeFetcher(manifest.hash, manifest.bytes),
    });

    expect(resolved.event.kind).toBe(NAPPLET_KIND_ROOT);
    expect(resolved.dTag).toBe('');
    expect(pool.filters[0]).toMatchObject({
      ids: [manifest.event.id],
      kinds: [NAPPLET_KIND_ROOT],
    });
  });

  it.each(['current', 'legacy'] as const)('resolves a %s root naddr without a d-tag filter', async (format) => {
    const manifest = await buildManifestFixture({ kind: NAPPLET_KIND_ROOT, format });
    const pointer = naddrEncode({ identifier: '', pubkey: manifest.event.pubkey, kind: NAPPLET_KIND_ROOT, relays: [RELAY] });
    const pool = fakePool([manifest.event]);
    const resolved = await resolvePajaPointer(pointer, { pool, fetcher: fakeFetcher(manifest.hash, manifest.bytes) });
    expect(resolved.event.id).toBe(manifest.event.id);
    expect(resolved.dTag).toBe('');
    expect(pool.filters).toEqual([{ kinds: [NAPPLET_KIND_ROOT], authors: [manifest.event.pubkey], limit: 1 }]);
  });

  it('selects the newest matching root without trusting relay-side filters', async () => {
    const manifest = await buildManifestFixture({ kind: NAPPLET_KIND_ROOT, format: 'current' });
    const newer = finalizeEvent({ kind: NAPPLET_KIND_ROOT, created_at: manifest.event.created_at + 1, content: manifest.event.content, tags: manifest.event.tags }, SK);
    const tied = finalizeEvent({ kind: NAPPLET_KIND_ROOT, created_at: newer.created_at, content: 'Another signed root at the same time', tags: newer.tags }, SK);
    const wrongAuthor = finalizeEvent({ kind: NAPPLET_KIND_ROOT, created_at: newer.created_at + 1, content: newer.content, tags: newer.tags }, new Uint8Array(32).fill(2));
    const named = await buildManifestFixture({ format: 'current' });
    const pointer = naddrEncode({ identifier: '', pubkey: manifest.event.pubkey, kind: NAPPLET_KIND_ROOT, relays: [RELAY] });
    const pool = closingPool([wrongAuthor, named.event, manifest.event, newer, tied], ['closed automatically on eose']);
    const resolved = await resolvePajaPointer(pointer, { pool, fetcher: fakeFetcher(manifest.hash, manifest.bytes) });
    // NIP-01 replaceable events with equal timestamps select the lowest ID.
    expect(resolved.event.id).toBe([newer.id, tied.id].sort()[0]);
  });

  it.each([
    { kind: NAPPLET_KIND_ROOT, identifier: 'invalid-root-name', message: /root.*empty identifier/i },
    { kind: NAPPLET_KIND_SNAPSHOT, identifier: '', message: /snapshot.*nevent/i },
    { kind: NAPPLET_KIND_NAMED, identifier: '', message: /named.*non-empty identifier/i },
  ])('rejects invalid naddr coordinates for $kind with actionable guidance', async ({ kind, identifier, message }) => {
    const manifest = await buildManifestFixture({ format: 'current' });
    const pool = fakePool([manifest.event]);
    const pointer = naddrEncode({ kind, identifier, pubkey: manifest.event.pubkey, relays: [RELAY] });
    await expect(resolvePajaPointer(pointer, { pool })).rejects.toThrow(message);
    expect(pool.filters).toHaveLength(0);
  });

  it('rejects non-napplet naddr kinds before rendering', async () => {
    const manifest = await buildManifest();
    const pointer = naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: 30023,
      relays: [RELAY],
    });

    await expect(resolvePajaPointer(pointer, { pool: fakePool([manifest.event]) }))
      .rejects.toThrow(/not a root or named NIP-5D napplet manifest kind/);
  });

  it('rejects NIP-5A nsite event kinds', async () => {
    const manifest = await buildManifest({ kind: 35128 });
    const pointer = neventEncode({
      id: manifest.event.id,
      author: manifest.event.pubkey,
      kind: 35128,
      relays: [RELAY],
    });

    await expect(resolvePajaPointer(pointer, { pool: fakePool([manifest.event]) }))
      .rejects.toThrow(/expected 5129 \/ 15129 \/ 35129/);
  });

  it('keeps signature, aggregate, and blob verification fail-closed after relay fallback', async () => {
    const valid = await buildManifest({ dTag: 'fail-closed-signature' });
    const signaturePointer = naddrEncode({
      identifier: valid.dTag,
      pubkey: valid.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    const forged = JSON.parse(JSON.stringify({
      ...valid.event,
      content: 'tampered',
    })) as NostrEvent;
    await expect(resolvePajaPointer(signaturePointer, {
      pool: fakePool([forged]),
      fetcher: fakeFetcher(valid.hash, valid.bytes),
    })).rejects.toMatchObject({ code: 'invalid-signature' });

    const badAggregate = await buildManifest({
      dTag: 'fail-closed-aggregate',
      aggregateOverride: '0'.repeat(64),
    });
    const aggregatePointer = naddrEncode({
      identifier: badAggregate.dTag,
      pubkey: badAggregate.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    await expect(resolvePajaPointer(aggregatePointer, {
      pool: fakePool([badAggregate.event]),
      fetcher: fakeFetcher(badAggregate.hash, badAggregate.bytes),
    })).rejects.toMatchObject({ code: format === 'legacy' ? 'aggregate-mismatch' : 'blob-unavailable' });

    const badBlob = await buildManifest({ dTag: 'fail-closed-blob' });
    const blobPointer = naddrEncode({
      identifier: badBlob.dTag,
      pubkey: badBlob.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: [RELAY],
    });
    await expect(resolvePajaPointer(blobPointer, {
      pool: fakePool([badBlob.event]),
      fetcher: async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => enc.encode('wrong bytes').buffer,
      } as Response),
    })).rejects.toMatchObject({ code: 'blob-unavailable' });
  });
});


describe('Paja pointer resolver relay connection tracking', () => {
  const RELAYS = ['wss://a.example', 'wss://b.example', 'wss://c.example'];

  function trackingPool(
    ensure: (url: string) => Promise<unknown>,
    subscribe: 'hang' | { readonly reasons: readonly string[] } = 'hang',
  ): PajaPointerRelayPool & { ensureCalls: Array<{ url: string; connectionTimeout?: number }> } {
    const ensureCalls: Array<{ url: string; connectionTimeout?: number }> = [];
    return {
      ensureCalls,
      async querySync() {
        throw new Error('querySync fallback should not run');
      },
      ensureRelay(url, params) {
        ensureCalls.push({ url, connectionTimeout: params?.connectionTimeout });
        return ensure(url);
      },
      subscribeManyEose(_relays, _filter, params) {
        if (subscribe === 'hang') return { close: () => undefined };
        const timer = setTimeout(() => params.onclose([...subscribe.reasons]), 0);
        return { close: () => clearTimeout(timer) };
      },
    };
  }

  async function pointer(): Promise<string> {
    const manifest = await buildManifestFixture({ dTag: 'tracking', format: 'current' });
    return naddrEncode({
      identifier: manifest.dTag,
      pubkey: manifest.event.pubkey,
      kind: PAJA_NAPPLET_MANIFEST_KIND,
      relays: RELAYS,
    });
  }

  it('reports zero connections distinctly when every relay fails to connect, even past the deadline', async () => {
    const pool = trackingPool(() => Promise.reject(new Error('connection failed')));
    const value = await pointer();

    const error = await resolvePajaPointer(value, { pool, maxWaitMs: 30 }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(PajaRelayUnreachableError);
    const unreachable = error as PajaRelayUnreachableError;
    expect(unreachable.code).toBe('relay-unreachable');
    expect(unreachable.message).toMatch(/No relay connection could be opened.*0 of 3 relays connected within 30ms \(3 failed, 0 still connecting\)/);
    expect(unreachable.message).toMatch(/WebSocket connection limit/);
    expect(unreachable.message).toMatch(/Relay errors: connection failed\./);
    expect(unreachable.message).not.toMatch(/timed out/);
    expect(unreachable.connections).toMatchObject({ total: 3, connected: [], pending: [] });
    expect(unreachable.connections.failed.map((entry) => entry.url)).toEqual(RELAYS);
    // One idempotent ensureRelay per distinct relay, sharing the query deadline.
    expect(pool.ensureCalls).toEqual(RELAYS.map((url) => ({ url, connectionTimeout: 30 })));
  });

  it('counts relays still connecting at the deadline instead of calling them slow', async () => {
    const pool = trackingPool(() => new Promise(() => undefined));
    const value = await pointer();

    await expect(resolvePajaPointer(value, { pool, maxWaitMs: 25 }))
      .rejects.toMatchObject({
        code: 'relay-unreachable',
        connections: { total: 3, connected: [], failed: [], pending: RELAYS },
      });
    await expect(resolvePajaPointer(value, { pool, maxWaitMs: 25 }))
      .rejects.toThrow(/0 of 3 relays connected within 25ms \(0 failed, 3 still connecting\)/);
  });

  it('does not misreport partial connectivity as unreachable', async () => {
    const connectOnlyA = (url: string) => url === RELAYS[0] ? Promise.resolve() : Promise.reject(new Error('connection failed'));
    const value = await pointer();

    // One relay EOSE'd, two failed: the ordinary incomplete-EOSE failure, not "unreachable".
    const mixed = await resolvePajaPointer(value, {
      pool: trackingPool(connectOnlyA, { reasons: ['closed automatically on eose', 'connection failed', 'connection failed'] }),
    }).then(() => null, (caught: unknown) => caught as Error);
    expect(mixed).not.toBeInstanceOf(PajaRelayUnreachableError);
    expect(mixed?.message).toMatch(/Relay query failed for naddr pointer before complete EOSE: connection failed/);

    // Deadline expiry with one live relay keeps the timeout message, now with the count.
    await expect(resolvePajaPointer(value, { pool: trackingPool(connectOnlyA, 'hang'), maxWaitMs: 25 }))
      .rejects.toThrow(/timed out after 25ms.*\(1 of 3 relays connected\)\./);
  });

  it('keeps legacy messages unchanged for pools without ensureRelay', async () => {
    const value = await pointer();
    const legacy: PajaPointerRelayPool = {
      async querySync() { throw new Error('querySync fallback should not run'); },
      subscribeManyEose() { return { close: () => undefined }; },
    };
    await expect(resolvePajaPointer(value, { pool: legacy, maxWaitMs: 20 }))
      .rejects.toThrow(/timed out after 20ms for naddr pointer across 3 relays before complete EOSE\.$/);
  });
});
