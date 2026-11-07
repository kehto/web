import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockHex, mockPubkey } from '../core/rng.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_EPOCH_SECONDS } from '../fixtures/nostr.js';
import { linuxDistroBytes, placeholderSha256 } from './file-bytes.js';
import { BLOSSOM_MOCK_ENTRY, BLOSSOM_SPEC_REF, DEFAULT_BLOSSOM_SERVERS, createMockBlossomService } from './blossom.js';

const SERVER = 'https://blossom.example.org';
const debian = LINUX_DISTROS[0]!;
const ISO_MIME = 'application/x-iso9660-image';
const ALICE = mockPubkey('alice');
const clock = { now: () => 1_767_225_600_000 };

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

function call(service: ReturnType<typeof createMockBlossomService>, type: string, fields: Record<string, unknown>, id = 'q1'): NappletMessage {
  const { sent, send } = sink();
  service.handleMessage('w1', { type, id, ...fields } as NappletMessage, send);
  return sent[0]!;
}

const debianDescriptor = (origin: string) => ({
  url: `${origin}/${debian.sha256}.iso`,
  sha256: debian.sha256,
  size: 1024,
  type: ISO_MIME,
  uploaded: MOCK_EPOCH_SECONDS,
  nip94: [['url', `${origin}/${debian.sha256}.iso`], ['m', ISO_MIME], ['x', debian.sha256], ['size', '1024']],
});

describe('createMockBlossomService', () => {
  it('records the spec ref, descriptor, routes, and extension capabilities', () => {
    const service = createMockBlossomService();
    expect(BLOSSOM_SPEC_REF).toEqual({ nap: 'NAP-BLOSSOM', status: 'draft', source: 'pr', pr: 71, sha: '5e74daa4', path: 'naps/NAP-BLOSSOM.md' });
    expect(service.descriptor).toMatchObject({ name: 'blossom', version: '1.0.0' });
    const routes = ['blossom.check', 'blossom.get', 'blossom.checkUpload', 'blossom.upload', 'blossom.mirror', 'blossom.checkMedia', 'blossom.media', 'blossom.list', 'blossom.delete', 'blossom.servers', 'blossom.addServer', 'blossom.removeServer', 'blossom.reorderServers'];
    expect(service.mock.routes).toEqual(routes);
    expect(Object.keys(service.messageCapabilities!)).toEqual(routes);
    expect(Object.values(service.messageCapabilities!).every((capability) => capability === null)).toBe(true);
    expect(BLOSSOM_MOCK_ENTRY).toMatchObject({ domain: 'blossom', kind: 'extension', spec: BLOSSOM_SPEC_REF });
  });

  it('checks blob presence with BUD-01 shaped headers', () => {
    const service = createMockBlossomService();
    expect(call(service, 'blossom.check', { request: { server: SERVER, sha256: debian.sha256, extension: '.iso' } }))
      .toEqual({ type: 'blossom.check.result', id: 'q1', result: { ok: true, status: 200, headers: { contentType: ISO_MIME, contentLength: 1024, acceptRanges: 'bytes' } } });
    expect(call(service, 'blossom.check', { request: { server: 'https://elsewhere.example.com', sha256: debian.sha256 } }))
      .toEqual({ type: 'blossom.check.result', id: 'q1', result: { ok: false, status: 404, headers: {}, error: 'not-found' } });
    expect(call(service, 'blossom.check', { request: { server: 'ftp://nope', sha256: debian.sha256 } })).toMatchObject({ result: { ok: false, status: 0, error: 'invalid-server' } });
    expect(call(service, 'blossom.check', { request: { server: SERVER, sha256: 'xyz' } })).toMatchObject({ result: { ok: false, status: 0, error: 'invalid-hash' } });
    expect(call(service, 'blossom.check', {})).toEqual({ type: 'blossom.check.result', id: 'q1', error: 'invalid-request' });
  });

  it('gets whole blobs and byte ranges', () => {
    const service = createMockBlossomService();
    const whole = call(service, 'blossom.get', { request: { server: SERVER, sha256: debian.sha256 } }) as NappletMessage & { result: { blob: ArrayBuffer; status: number; headers: unknown } };
    expect(whole.result.status).toBe(200);
    expect(new Uint8Array(whole.result.blob)).toEqual(linuxDistroBytes(debian));
    const range = call(service, 'blossom.get', { request: { server: SERVER, sha256: debian.sha256, range: 'bytes=0-3' } }) as NappletMessage & { result: { blob: ArrayBuffer; status: number; headers: unknown } };
    expect(range.result.status).toBe(206);
    expect(new Uint8Array(range.result.blob)).toEqual(linuxDistroBytes(debian).slice(0, 4));
    expect(range.result.headers).toEqual({ contentType: ISO_MIME, contentLength: 4, acceptRanges: 'bytes' });
    expect(call(service, 'blossom.get', { request: { server: SERVER, sha256: debian.sha256, range: 'bytes=9999-' } })).toMatchObject({ result: { ok: false, status: 416, error: 'invalid-request' } });
  });

  it('runs upload preflight and stores exact bytes with a placeholder hash', () => {
    const service = createMockBlossomService({ clock, maxBytes: 2048 });
    const data = new Uint8Array([1, 2, 3, 4]);
    const sha256 = placeholderSha256(data);
    expect(call(service, 'blossom.checkUpload', { request: { server: SERVER, sha256, size: 4, type: 'application/pdf' } })).toEqual({ type: 'blossom.checkUpload.result', id: 'q1', result: { ok: true, status: 200, headers: {} } });
    expect(call(service, 'blossom.checkUpload', { request: { server: SERVER, sha256, size: 4096, type: 'application/pdf' } })).toMatchObject({ result: { ok: false, status: 413, error: 'too-large' } });
    expect(call(service, 'blossom.upload', { request: { server: SERVER, data, sha256, type: 'application/pdf', size: 4 } })).toEqual({
      type: 'blossom.upload.result',
      id: 'q1',
      result: { ok: true, status: 201, descriptor: { url: `${SERVER}/${sha256}.pdf`, sha256, size: 4, type: 'application/pdf', uploaded: MOCK_EPOCH_SECONDS, nip94: [['url', `${SERVER}/${sha256}.pdf`], ['m', 'application/pdf'], ['x', sha256], ['size', '4']] } },
    });
    expect(call(service, 'blossom.upload', { request: { server: SERVER, data } })).toMatchObject({ result: { ok: true, status: 200 } });
    expect(call(service, 'blossom.upload', { request: { server: SERVER, data, sha256: '0'.repeat(64) } })).toMatchObject({ result: { ok: false, status: 0, error: 'hash-mismatch' } });
    expect(call(service, 'blossom.upload', { request: { server: SERVER, data: 'not bytes' } })).toMatchObject({ result: { ok: false, status: 0, error: 'invalid-request' } });
    expect(call(createMockBlossomService({ signedIn: false }), 'blossom.upload', { request: { server: SERVER, data } })).toMatchObject({ result: { ok: false, status: 0, error: 'not-signed-in' } });
    expect(call(createMockBlossomService({ signedIn: false }), 'blossom.check', { request: { server: SERVER, sha256: debian.sha256, auth: 'required' } })).toMatchObject({ result: { error: 'not-signed-in' } });
  });

  it('mirrors a known blob URL onto another server', () => {
    const service = createMockBlossomService();
    const target = 'https://mirror.example.org';
    expect(call(service, 'blossom.mirror', { request: { server: target, url: `https://cdn.example.net/${debian.sha256}.iso`, sha256: debian.sha256 } }))
      .toEqual({ type: 'blossom.mirror.result', id: 'q1', result: { ok: true, status: 201, descriptor: debianDescriptor(target) } });
    expect(call(service, 'blossom.check', { request: { server: target, sha256: debian.sha256 } })).toMatchObject({ result: { ok: true, status: 200 } });
    expect(call(service, 'blossom.mirror', { request: { server: target, url: `https://cdn.example.net/${'1'.repeat(64)}.iso` } })).toMatchObject({ result: { ok: false, status: 404, error: 'not-found' } });
    expect(call(service, 'blossom.mirror', { request: { server: target, url: `https://cdn.example.net/${debian.sha256}.iso`, sha256: '2'.repeat(64) } })).toMatchObject({ result: { error: 'hash-mismatch' } });
  });

  it('optimizes media uploads into a transformed webp descriptor', () => {
    const service = createMockBlossomService({ clock });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 5, 6, 7, 8, 9, 10]);
    const original = placeholderSha256(png);
    expect(call(service, 'blossom.checkMedia', { request: { server: SERVER, sha256: original, size: 10, type: 'image/png' } })).toMatchObject({ result: { ok: true, status: 200, headers: {} } });
    expect(call(service, 'blossom.checkMedia', { request: { server: SERVER, sha256: original, size: 10, type: 'application/pdf' } })).toMatchObject({ result: { ok: false, status: 415, error: 'unsupported-media-type' } });
    const stored = call(service, 'blossom.media', { request: { server: SERVER, data: png, type: 'image/png' } }) as NappletMessage & { result: { descriptor: Record<string, unknown> } };
    expect(stored.result.descriptor).toMatchObject({ sha256: mockHex(`media:${original}`), type: 'image/webp', size: 6, url: `${SERVER}/${mockHex(`media:${original}`)}.webp` });
  });

  it('lists a pubkey blobs with cursor pagination and deletes one hash at a time', () => {
    const service = createMockBlossomService();
    const sorted = [...LINUX_DISTROS].map((image) => image.sha256).sort();
    const first = call(service, 'blossom.list', { request: { server: SERVER, pubkey: ALICE, limit: 3 } }) as NappletMessage & { result: { blobs: Array<{ sha256: string }>; cursor?: string; status: number } };
    expect(first.result.status).toBe(200);
    expect(first.result.blobs.map((blob) => blob.sha256)).toEqual(sorted.slice(0, 3));
    expect(first.result.cursor).toBe(sorted[2]);
    const rest = call(service, 'blossom.list', { request: { server: SERVER, pubkey: ALICE, cursor: first.result.cursor } }) as typeof first;
    expect(rest.result.blobs.map((blob) => blob.sha256)).toEqual(sorted.slice(3));
    expect(rest.result).not.toHaveProperty('cursor');
    expect(call(service, 'blossom.list', { request: { server: SERVER, pubkey: mockPubkey('bob') } })).toMatchObject({ result: { ok: true, status: 200, blobs: [] } });
    expect(call(service, 'blossom.delete', { request: { server: SERVER, sha256: debian.sha256 } })).toEqual({ type: 'blossom.delete.result', id: 'q1', result: { ok: true, status: 200 } });
    expect(call(service, 'blossom.delete', { request: { server: SERVER, sha256: debian.sha256 } })).toEqual({ type: 'blossom.delete.result', id: 'q1', result: { ok: false, status: 404, error: 'not-found' } });
    expect(call(service, 'blossom.check', { request: { server: 'https://cdn.example.net', sha256: debian.sha256 } })).toMatchObject({ result: { ok: true } });
  });

  it('manages the BUD-03 server list and republishes kind 10063 on every mutation', () => {
    const service = createMockBlossomService({ clock });
    const seeded = service.mock.state().serverListEvent!;
    expect(seeded).toMatchObject({ kind: 10063, pubkey: ALICE, content: '', tags: DEFAULT_BLOSSOM_SERVERS.map((server) => ['server', server]) });
    expect(call(service, 'blossom.servers', {})).toEqual({ type: 'blossom.servers.result', id: 'q1', result: { ok: true, servers: [...DEFAULT_BLOSSOM_SERVERS], eventId: seeded.id, result: { event: seeded } } });

    const added = call(service, 'blossom.addServer', { request: { server: 'https://cdn2.example.com', position: 0 } }) as NappletMessage & { result: Record<string, unknown> };
    expect(added.result).toMatchObject({ ok: true, servers: ['https://cdn2.example.com', ...DEFAULT_BLOSSOM_SERVERS] });
    expect(added.result.eventId).not.toBe(seeded.id);
    expect((added.result.result as { event: { tags: string[][]; created_at: number } }).event).toMatchObject({ created_at: MOCK_EPOCH_SECONDS, tags: [['server', 'https://cdn2.example.com'], ...DEFAULT_BLOSSOM_SERVERS.map((server) => ['server', server])] });
    expect(call(service, 'blossom.addServer', { request: { server: 'cdn3.example.com' } })).toMatchObject({ result: { ok: false, error: 'invalid-server' } });

    expect(call(service, 'blossom.reorderServers', { servers: [...DEFAULT_BLOSSOM_SERVERS, 'https://cdn2.example.com'] })).toMatchObject({ result: { ok: true, servers: [...DEFAULT_BLOSSOM_SERVERS, 'https://cdn2.example.com'] } });
    expect(call(service, 'blossom.reorderServers', { servers: [] })).toMatchObject({ result: { ok: false, error: 'empty-server-list' } });
    expect(call(service, 'blossom.reorderServers', { servers: ['https://other.example'] })).toMatchObject({ result: { ok: false, error: 'invalid-server-list' } });

    expect(call(service, 'blossom.removeServer', { server: 'https://cdn2.example.com' })).toMatchObject({ result: { ok: true, servers: [...DEFAULT_BLOSSOM_SERVERS] } });
    expect(call(service, 'blossom.removeServer', { server: 'https://absent.example' })).toMatchObject({ result: { ok: true, servers: [...DEFAULT_BLOSSOM_SERVERS] } });
    expect(call(service, 'blossom.removeServer', { server: DEFAULT_BLOSSOM_SERVERS[0] })).toMatchObject({ result: { ok: true, servers: [DEFAULT_BLOSSOM_SERVERS[1]] } });
    expect(call(service, 'blossom.removeServer', { server: DEFAULT_BLOSSOM_SERVERS[1] })).toMatchObject({ result: { ok: false, servers: [DEFAULT_BLOSSOM_SERVERS[1]], error: 'empty-server-list' } });
    expect(service.mock.state().serial).toBe(5);

    expect(call(createMockBlossomService({ signedIn: false }), 'blossom.addServer', { request: { server: 'https://x.example' } })).toMatchObject({ result: { ok: false, error: 'not-signed-in' } });
    expect(call(createMockBlossomService({ servers: [] }), 'blossom.servers', {})).toEqual({ type: 'blossom.servers.result', id: 'q1', result: { ok: true, servers: [] } });
  });

  it('resets to the seeded store and tolerates window teardown', () => {
    const service = createMockBlossomService();
    call(service, 'blossom.delete', { request: { server: SERVER, sha256: debian.sha256 } });
    call(service, 'blossom.removeServer', { server: DEFAULT_BLOSSOM_SERVERS[1] });
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().serverList).toEqual([DEFAULT_BLOSSOM_SERVERS[0]]);
    service.mock.reset();
    expect(service.mock.state().serverList).toEqual([...DEFAULT_BLOSSOM_SERVERS]);
    expect(service.mock.state().blobs.get(debian.sha256)?.servers).toEqual(new Set(DEFAULT_BLOSSOM_SERVERS));
    expect(service.mock.state().blobs.size).toBe(LINUX_DISTROS.length);
    expect(service.mock.sent).toEqual([]);
  });
});
