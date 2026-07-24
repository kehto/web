import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { finalizeEvent } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { computeAggregateHash } from '@kehto/nip/5a';
import {
  injectCspMeta,
  resolvePlaygroundNapplet,
  PLAYGROUND_MANIFEST_AUTHOR,
} from '../../apps/playground/src/napplet-resolver.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const hexToBytes = (h: string): Uint8Array =>
  Uint8Array.from(h.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const sha256hex = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
const SK = hexToBytes('11'.repeat(32));
const enc = new TextEncoder();

const RELAY = 'http://relay.test/napplet-relay/event';
const DISCOVERY = 'http://relay.test/napplet-relay/relay-list';
const BLOSSOM = 'http://relay.test/napplet-blossom';

function indexBlob() {
  const bytes = enc.encode('<!doctype html><html><head><title>chat</title></head><body>hi</body></html>');
  return { bytes, hash: sha256hex(bytes) };
}

function buildManifest(dTag = 'chat') {
  const index = indexBlob();
  const aggregate = computeAggregateHash([{ path: '/index.html', sha256: index.hash }]);
  const tags = [
    ['d', dTag],
    ['path', '/index.html', index.hash],
    ['x', aggregate, 'aggregate'],
  ];
  const event = finalizeEvent({ kind: 35129, created_at: 1_700_000_000, tags, content: '' }, SK);
  return { event, index, aggregate };
}

function relayList(): NostrEvent {
  return finalizeEvent(
    { kind: 10002, created_at: 1_700_000_000, tags: [['r', RELAY, 'write']], content: '' },
    SK,
  );
}

/** Build a fake fetcher over a route table. */
function fakeFetcher(routes: Record<string, () => { ok: boolean; json?: unknown; bytes?: Uint8Array }>) {
  return async (url: string): Promise<Response> => {
    const hit = routes[url];
    if (!hit) return { ok: false, status: 404 } as Response;
    const r = hit();
    return {
      ok: r.ok,
      status: r.ok ? 200 : 404,
      json: async () => r.json,
      arrayBuffer: async () => (r.bytes ?? new Uint8Array()).buffer,
    } as Response;
  };
}

describe('injectCspMeta', () => {
  const classOnePrefix = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";
  const classOneSuffix = "worker-src 'none'; child-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none'; manifest-src 'none'; prefetch-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

  it('injects the complete Class-1 policy with sorted, deduplicated grants into <head>', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';
    const out = injectCspMeta(html, ['https://b.example', 'https://a.example', 'https://b.example']);
    expect(out).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${classOnePrefix} connect-src https://a.example https://b.example; ${classOneSuffix}">`,
    );
    expect(out).not.toContain("connect-src 'self'");
    expect(out).not.toContain('connect-src *');
    // sits inside <head>
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('</head>'));
    expect(out.indexOf('<head>')).toBeLessThan(out.indexOf('Content-Security-Policy'));
  });

  it("emits the complete Class-1 policy with connect-src 'none' when there are no origins", () => {
    const out = injectCspMeta('<html><head></head></html>', []);
    expect(out).toContain(`content="${classOnePrefix} connect-src 'none'; ${classOneSuffix}"`);
  });

  it('still injects when there is no <head> (prepends a head)', () => {
    const out = injectCspMeta('<html><body>x</body></html>', ['https://a.example']);
    expect(out).toContain('Content-Security-Policy');
  });
});

describe('resolvePlaygroundNapplet', () => {
  const optsFor = (event: NostrEvent, index: { bytes: Uint8Array; hash: string }, dTag = 'chat') => ({
    dTag,
    relayDiscoveryUrl: DISCOVERY,
    blossomServers: [BLOSSOM],
    fetcher: fakeFetcher({
      [`${DISCOVERY}/${PLAYGROUND_MANIFEST_AUTHOR}`]: () => ({ ok: true, json: relayList() }),
      [`${RELAY}/${dTag}`]: () => ({ ok: true, json: event }),
      [`${BLOSSOM}/${index.hash}`]: () => ({ ok: true, bytes: index.bytes }),
    }),
  });

  it('resolves via NIP-65 → relay → Blossom → verify with computed identity', async () => {
    vi.stubGlobal('caches', undefined);
    const { event, index, aggregate } = buildManifest();
    const napplet = await resolvePlaygroundNapplet(optsFor(event, index));
    expect(napplet.dTag).toBe('chat');
    expect(napplet.aggregateHash).toBe(aggregate);
    expect(napplet.indexHtml).toContain('<body>hi</body>');
  });

  it('rejects when the manifest author does not match the expected author', async () => {
    const otherSk = hexToBytes('22'.repeat(32));
    const { index, aggregate } = buildManifest();
    const idx = indexBlob();
    const event = finalizeEvent(
      {
        kind: 35129,
        created_at: 1,
        tags: [['d', 'chat'], ['path', '/index.html', idx.hash], ['x', computeAggregateHash([{ path: '/index.html', sha256: idx.hash }]), 'aggregate']],
        content: '',
      },
      otherSk,
    );
    void aggregate;
    await expect(resolvePlaygroundNapplet(optsFor(event, idx))).rejects.toThrow(/author/i);
  });

  it('rejects when the resolved dTag does not match the requested dTag', async () => {
    const { event, index } = buildManifest('other');
    await expect(resolvePlaygroundNapplet(optsFor(event, index, 'chat'))).rejects.toThrow();
  });

  it('rejects when no outbox relay is advertised', async () => {
    const { event, index } = buildManifest();
    const emptyList = finalizeEvent({ kind: 10002, created_at: 1, tags: [], content: '' }, SK);
    await expect(
      resolvePlaygroundNapplet({
        ...optsFor(event, index),
        fetcher: fakeFetcher({
          [`${DISCOVERY}/${PLAYGROUND_MANIFEST_AUTHOR}`]: () => ({ ok: true, json: emptyList }),
        }),
      }),
    ).rejects.toThrow(/relay/i);
  });

  it('rejects when a fetched blob does not match its hash (Blossom not trusted)', async () => {
    const { event, index } = buildManifest();
    await expect(
      resolvePlaygroundNapplet({
        ...optsFor(event, index),
        fetcher: fakeFetcher({
          [`${DISCOVERY}/${PLAYGROUND_MANIFEST_AUTHOR}`]: () => ({ ok: true, json: relayList() }),
          [`${RELAY}/chat`]: () => ({ ok: true, json: event }),
          [`${BLOSSOM}/${index.hash}`]: () => ({ ok: true, bytes: enc.encode('forged') }),
        }),
      }),
    ).rejects.toThrow();
  });
});
