import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_EVENTS } from '../fixtures/nostr.js';
import { encodeBase64, hexToBytes, linuxDistroBytes, linuxDistroSums, utf8Bytes } from './file-bytes.js';
import { MOCK_HASHTREE_AUTHOR, MOCK_HASHTREE_AUTHOR_NPUB, encodeBech32, encodeNhash } from './hashtree-fixtures.js';
import { DEFAULT_RESOURCE_SCHEMES, RESOURCE_MOCK_ENTRY, RESOURCE_SPEC_REF, createMockResourceService } from './resource.js';

const debian = LINUX_DISTROS[0]!;
const debianBase64 = encodeBase64(linuxDistroBytes(debian));
const ISO_MIME = 'application/x-iso9660-image';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

function bytes(service: ReturnType<typeof createMockResourceService>, url: string, id = 'r1', windowId = 'w1'): NappletMessage {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type: 'resource.bytes', id, url } as NappletMessage, send);
  return sent[0]!;
}

describe('createMockResourceService', () => {
  it('records the spec ref, descriptor, and registry entry', () => {
    const service = createMockResourceService();
    expect(RESOURCE_SPEC_REF).toEqual({ nap: 'NAP-RESOURCE', status: 'draft', source: 'pr', pr: 80, sha: 'ae5b9c64', path: 'naps/NAP-RESOURCE.md' });
    expect(service.descriptor.name).toBe('resource');
    expect(service.descriptor.version).toBe('1.0.0');
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['resource.info', 'resource.bytes', 'resource.bytesMany', 'resource.cancel']);
    expect(RESOURCE_MOCK_ENTRY.kind).toBe('service');
    expect(RESOURCE_MOCK_ENTRY.create?.({}).descriptor.name).toBe('resource');
  });

  it('answers resource.info with the advisory schemes and caps', () => {
    const service = createMockResourceService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'resource.info', id: 'i1' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'resource.info.result', id: 'i1', info: { schemes: [...DEFAULT_RESOURCE_SCHEMES], maxBytes: 10 * 1024 * 1024, maxUrls: 100 } }]);
  });

  it('resolves https catalog mirrors to placeholder image bytes with a sniffed mime', () => {
    expect(bytes(createMockResourceService(), debian.mirrors[0]!)).toEqual({ type: 'resource.bytes.result', id: 'r1', blob: debianBase64, mime: ISO_MIME });
    expect(bytes(createMockResourceService(), 'https://avatars.example.org/alice.png')).toMatchObject({ type: 'resource.bytes.result', mime: 'image/png' });
  });

  it('decodes data URLs exactly as the draft example shows', () => {
    expect(bytes(createMockResourceService(), 'data:application/octet-stream;base64,AAEC/w=='))
      .toEqual({ type: 'resource.bytes.result', id: 'r1', blob: 'AAEC/w==', mime: 'application/octet-stream' });
    expect(bytes(createMockResourceService(), 'data:text/plain,hello%20world'))
      .toEqual({ type: 'resource.bytes.result', id: 'r1', blob: encodeBase64(utf8Bytes('hello world')), mime: 'text/plain' });
    expect(bytes(createMockResourceService(), 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'))
      .toMatchObject({ type: 'resource.bytes.result', mime: 'image/png' });
    expect(bytes(createMockResourceService(), 'data:text/plain;base64,AAEC/w')).toMatchObject({ type: 'resource.bytes.error', error: 'decode-failed' });
    expect(bytes(createMockResourceService({ maxBytes: 2 }), 'data:text/plain;base64,AAEC/w==')).toMatchObject({ type: 'resource.bytes.error', error: 'too-large' });
  });

  it('resolves BUD-10 blossom URIs from the catalog by sha256', () => {
    expect(bytes(createMockResourceService(), `blossom:${debian.sha256}.iso`)).toEqual({ type: 'resource.bytes.result', id: 'r1', blob: debianBase64, mime: ISO_MIME });
    expect(bytes(createMockResourceService(), `blossom:${'0'.repeat(64)}.iso`)).toMatchObject({ type: 'resource.bytes.error', error: 'not-found' });
    expect(bytes(createMockResourceService(), 'blossom:not-a-hash')).toMatchObject({ type: 'resource.bytes.error', error: 'invalid-request' });
  });

  it('resolves hashtree references: nhash, hashtree:, and htree:// forms', () => {
    const nhash = encodeNhash(debian.sha256);
    expect(bytes(createMockResourceService(), nhash)).toEqual({ type: 'resource.bytes.result', id: 'r1', blob: debianBase64, mime: ISO_MIME });
    expect(bytes(createMockResourceService(), `hashtree:${nhash}`)).toMatchObject({ blob: debianBase64 });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/distros/SHA256SUMS`))
      .toEqual({ type: 'resource.bytes.result', id: 'r1', blob: encodeBase64(utf8Bytes(linuxDistroSums(LINUX_DISTROS))), mime: 'text/plain' });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR}/distros/${debian.id}/${debian.fileName}`)).toMatchObject({ blob: debianBase64 });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR}/distros`)).toMatchObject({ type: 'resource.bytes.error', error: 'invalid-request' });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR}/distros/SHA256SUMS#link-visible`)).toMatchObject({ error: 'invalid-request' });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR}/distros/SHA256SUMS#private`)).toMatchObject({ error: 'blocked-by-policy' });
    expect(bytes(createMockResourceService(), `htree://${MOCK_HASHTREE_AUTHOR}/missing/x`)).toMatchObject({ error: 'not-found' });
    expect(bytes(createMockResourceService(), 'hashtree:nhash1zzz')).toMatchObject({ error: 'invalid-request' });
  });

  it('resolves nostr: references one hop to fixture event JSON', () => {
    const note = MOCK_EVENTS.find((event) => event.kind === 1)!;
    const result = bytes(createMockResourceService(), `nostr:${encodeBech32('note', hexToBytes(note.id))}`);
    expect(result).toEqual({ type: 'resource.bytes.result', id: 'r1', blob: encodeBase64(utf8Bytes(JSON.stringify(note))), mime: 'application/json' });
    const profile = MOCK_EVENTS.find((event) => event.kind === 0)!;
    expect(bytes(createMockResourceService(), `nostr:${encodeBech32('npub', hexToBytes(profile.pubkey))}`)).toMatchObject({ blob: encodeBase64(utf8Bytes(JSON.stringify(profile))) });
    expect(bytes(createMockResourceService(), 'nostr:note1invalid')).toMatchObject({ type: 'resource.bytes.error', error: 'invalid-request' });
  });

  it('fails with the draft error codes for unsupported schemes, policy blocks, and malformed requests', () => {
    expect(bytes(createMockResourceService(), 'http://mirror-a.example.org/x.iso')).toEqual({ type: 'resource.bytes.error', id: 'r1', error: 'unsupported-scheme', message: 'scheme http is not supported' });
    expect(bytes(createMockResourceService(), 'https://127.0.0.1/secret')).toMatchObject({ error: 'blocked-by-policy' });
    expect(bytes(createMockResourceService(), 'https://mirror-a.example.org/iso/debian/missing.iso')).toMatchObject({ error: 'not-found' });
    expect(bytes(createMockResourceService({ schemes: [{ scheme: 'https', enabled: false }] }), debian.mirrors[0]!)).toMatchObject({ error: 'unsupported-scheme' });
    const { sent, send } = sink();
    const service = createMockResourceService();
    service.handleMessage('w1', { type: 'resource.bytes', id: 'r2' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'resource.bytes.error', id: 'r2', error: 'invalid-request', message: 'url must be a non-empty string' }]);
    service.handleMessage('w1', { type: 'resource.bytes', url: debian.mirrors[0] } as NappletMessage, send);
    expect(sent).toHaveLength(1);
  });

  it('answers bytesMany in order with per-URL outcomes and accepts the nap 0.32 requests shape', () => {
    const service = createMockResourceService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'resource.bytesMany', id: 'm1', urls: [debian.mirrors[1], 'ftp://x/y'] } as NappletMessage, send);
    expect(sent[0]).toEqual({
      type: 'resource.bytesMany.result',
      id: 'm1',
      items: [
        { url: debian.mirrors[1], ok: true, blob: debianBase64, mime: ISO_MIME },
        { url: 'ftp://x/y', ok: false, error: 'unsupported-scheme', message: 'scheme ftp is not supported' },
      ],
    });
    service.handleMessage('w1', { type: 'resource.bytesMany', id: 'm2', requests: [{ url: debian.mirrors[0] }] } as NappletMessage, send);
    expect(sent[1]).toMatchObject({ type: 'resource.bytesMany.result', id: 'm2', items: [{ url: debian.mirrors[0], ok: true }] });
    service.handleMessage('w1', { type: 'resource.bytesMany', id: 'm3', urls: [] } as NappletMessage, send);
    expect(sent[2]).toEqual({ type: 'resource.bytesMany.error', id: 'm3', error: 'invalid-request', message: 'urls must be a non-empty list' });
    const capped = createMockResourceService({ maxUrls: 1 });
    capped.handleMessage('w1', { type: 'resource.bytesMany', id: 'm4', urls: [debian.mirrors[0], debian.mirrors[1]] } as NappletMessage, send);
    expect(sent[3]).toMatchObject({ type: 'resource.bytesMany.error', id: 'm4', error: 'too-large' });
    expect(service.mock.state().log.map((entry) => entry.ok)).toEqual([true, false, true]);
  });

  it('can emit Blob results for nap 0.32 shims', () => {
    const result = bytes(createMockResourceService({ wireBytes: 'blob' }), debian.mirrors[0]!) as NappletMessage & { blob: Blob };
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.type).toBe(ISO_MIME);
    expect(result.blob.size).toBe(1024);
  });

  it('drops late envelopes for cancelled ids and cancels pending work on destroy and reset', () => {
    const queued: Array<() => void> = [];
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { queued.splice(queued.indexOf(fn), 1); }; } };
    const service = createMockResourceService({ latencyMs: 5, scheduler });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'resource.bytes', id: 'r1', url: debian.mirrors[0] } as NappletMessage, send);
    service.handleMessage('w1', { type: 'resource.bytes', id: 'r2', url: debian.mirrors[0] } as NappletMessage, send);
    expect(service.mock.state().inFlight.size).toBe(2);
    service.handleMessage('w1', { type: 'resource.cancel', id: 'r1' } as NappletMessage, send);
    expect(service.mock.state().inFlight.size).toBe(1);
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent).toEqual([{ type: 'resource.bytes.result', id: 'r2', blob: debianBase64, mime: ISO_MIME }]);
    expect(service.mock.state().inFlight.size).toBe(0);

    service.handleMessage('w2', { type: 'resource.bytes', id: 'r3', url: debian.mirrors[0] } as NappletMessage, send);
    service.onWindowDestroyed?.('w2');
    expect(queued).toHaveLength(0);
    expect(service.mock.state().inFlight.size).toBe(0);

    service.handleMessage('w1', { type: 'resource.bytes', id: 'r4', url: debian.mirrors[0] } as NappletMessage, send);
    service.mock.reset();
    expect(queued).toHaveLength(0);
    expect(service.mock.state()).toEqual({ inFlight: new Map(), log: [] });
    expect(service.mock.sent).toEqual([]);
  });

  it('exposes the resolver directly', () => {
    const service = createMockResourceService();
    expect(service.resolve(`blossom:${debian.sha256}.iso`)).toEqual({ ok: true, bytes: linuxDistroBytes(debian), mime: ISO_MIME });
    expect(service.resolve('gopher://x')).toEqual({ ok: false, error: 'unsupported-scheme', message: 'scheme gopher is not supported' });
  });
});
