import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { SOULSEEK_MOCK_ENTRY, SOULSEEK_SPEC_REF, createMockSoulseekService } from './soulseek.js';

const ROUTES = ['soulseek.info', 'soulseek.search', 'soulseek.browse', 'soulseek.results', 'soulseek.stop', 'soulseek.download', 'soulseek.transfers', 'soulseek.status', 'soulseek.pause', 'soulseek.resume', 'soulseek.cancel', 'soulseek.read', 'soulseek.save', 'soulseek.release'];
const DEBIAN = LINUX_DISTROS[0]!;
const DEBIAN_FILE = { fileId: 'f1', username: 'tux-mirror', path: 'Linux\\Debian\\debian-12.7.0-amd64-netinst.iso', size: '661651456', locked: false, extension: 'iso' };
const QUERY = { queryId: 's1', kind: 'search', state: 'collecting', count: 0, maxResults: 500, maxPageSize: 100, timeoutMs: 30000 };

type Service = ReturnType<typeof createMockSoulseekService>;

function run(service: Service, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

function downloaded(service: Service): Service {
  run(service, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'debian' } });
  service.advance();
  run(service, 'w1', { type: 'soulseek.download', id: 'q3', fileId: 'f1' });
  service.advance(5);
  return service;
}

describe('NAP-SOULSEEK mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockSoulseekService();
    expect(service.descriptor).toEqual({ name: 'soulseek', version: '0.1.0', description: 'Mock NAP-SOULSEEK discovery and downloads over the Linux image catalog' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(SOULSEEK_SPEC_REF).toEqual({ nap: 'NAP-SOULSEEK', status: 'draft', source: 'pr', pr: 135, sha: '892ed8d4909c', path: 'naps/NAP-SOULSEEK.md' });
    expect(SOULSEEK_MOCK_ENTRY).toMatchObject({ domain: 'soulseek', kind: 'extension' });
    expect(SOULSEEK_MOCK_ENTRY.create?.({}).descriptor.name).toBe('soulseek');
  });

  it('reports info and admits a search that the catalog peer answers on advance', () => {
    const service = createMockSoulseekService();
    expect(run(service, 'w1', { type: 'soulseek.info', id: 'i1' })).toEqual({
      type: 'soulseek.info.result', id: 'i1',
      value: { state: 'online', canSave: true, maxQueries: 4, maxTransfers: 8, maxResults: 500, maxPageSize: 100, maxReadBytes: 65536, maxTextBytes: 1024, queryTimeoutMs: 30000, pollIntervalMs: 1000 },
    });
    expect(run(service, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'debian' } })).toEqual({ type: 'soulseek.search.result', id: 'q1', value: QUERY });
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'q2', queryId: 's1' })).toEqual({ type: 'soulseek.results.result', id: 'q2', value: { query: QUERY, files: [], next: 0 } });
    service.advance();
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'q3', queryId: 's1', limit: 10 })).toEqual({
      type: 'soulseek.results.result', id: 'q3',
      value: { query: { ...QUERY, state: 'complete', count: 1, reason: 'deadline' }, files: [DEBIAN_FILE], next: 1 },
    });
    expect(run(service, 'w1', { type: 'soulseek.stop', id: 'q4', queryId: 's1' })).toEqual({ type: 'soulseek.stop.result', id: 'q4', value: { ...QUERY, state: 'complete', count: 1, reason: 'deadline' } });
  });

  it('pages results of a collecting search and stops it', () => {
    const service = createMockSoulseekService();
    run(service, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'iso' } });
    service.advance();
    const page = run(service, 'w1', { type: 'soulseek.results', id: 'r1', queryId: 's1', limit: 2 }) as unknown as { value: { query: Record<string, unknown>; files: Array<{ fileId: string; username: string }>; next: number } };
    expect(page.value.query).toMatchObject({ state: 'collecting', count: 3 });
    expect(page.value.files.map((file) => [file.fileId, file.username])).toEqual([['f1', 'tux-mirror'], ['f2', 'penguin-share']]);
    expect(page.value.next).toBe(2);
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'r2', queryId: 's1', after: 2 })).toMatchObject({ value: { files: [{ fileId: 'f3', username: 'blue-hat' }], next: 3 } });
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'r3', queryId: 's1', after: 4 })).toEqual({ type: 'soulseek.results.result', id: 'r3', error: { code: 'invalid_request', message: 'after is out of range' } });
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'r4', queryId: 's1', limit: 101 })).toMatchObject({ error: { code: 'invalid_request' } });
    expect(run(service, 'w1', { type: 'soulseek.stop', id: 's', queryId: 's1' })).toMatchObject({ value: { state: 'stopped', reason: 'cancelled', count: 3 } });
    service.advance(5);
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'r5', queryId: 's1', after: 3 })).toMatchObject({ value: { query: { state: 'stopped', count: 3 }, files: [], next: 3 } });

    const full = createMockSoulseekService();
    run(full, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'iso', username: 'gecko-green' } });
    full.advance(3);
    expect(run(full, 'w1', { type: 'soulseek.results', id: 'r', queryId: 's1' })).toMatchObject({ value: { query: { state: 'complete', reason: 'deadline', count: 1 }, files: [{ username: 'gecko-green', path: 'Linux\\openSUSE\\openSUSE-Tumbleweed-DVD-x86_64-Current.iso' }] } });
  });

  it('browses a peer share and fails for unknown peers', () => {
    const service = createMockSoulseekService();
    expect(run(service, 'w1', { type: 'soulseek.browse', id: 'b1', username: 'lambda-cat' })).toEqual({ type: 'soulseek.browse.result', id: 'b1', value: { queryId: 'b1', kind: 'browse', state: 'collecting', count: 0, maxResults: 500, maxPageSize: 100, timeoutMs: 30000 } });
    service.advance();
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'b2', queryId: 'b1' })).toEqual({
      type: 'soulseek.results.result', id: 'b2',
      value: { query: { queryId: 'b1', kind: 'browse', state: 'complete', count: 1, maxResults: 500, maxPageSize: 100, timeoutMs: 30000, reason: 'peer_complete' }, files: [{ fileId: 'f1', username: 'lambda-cat', path: 'Linux\\NixOS\\nixos-gnome-24.05.5678.x86_64-linux.iso', size: '2549088256', locked: false, extension: 'iso' }], next: 1 },
    });
    run(service, 'w1', { type: 'soulseek.browse', id: 'b3', username: 'nobody' });
    service.advance();
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'b4', queryId: 'b2' })).toMatchObject({ value: { query: { state: 'failed', count: 0, error: { code: 'peer_unavailable', message: 'Peer cannot be reached' } }, files: [] } });
  });

  it('validates requests and enforces account and capacity limits', () => {
    const service = createMockSoulseekService();
    expect(run(service, 'w1', { type: 'soulseek.search', id: 'e1', request: { text: '   ' } })).toEqual({ type: 'soulseek.search.result', id: 'e1', error: { code: 'invalid_request', message: 'request.text must be a nonempty string' } });
    expect(run(service, 'w1', { type: 'soulseek.search', id: 'e2', request: { text: 'x', extra: 1 } })).toMatchObject({ error: { code: 'invalid_request', message: 'unknown request field' } });
    expect(run(service, 'w1', { type: 'soulseek.browse', id: 'e3' })).toMatchObject({ error: { code: 'invalid_request' } });
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'e4', queryId: 'zzz' })).toEqual({ type: 'soulseek.results.result', id: 'e4', error: { code: 'not_found', message: 'Query handle is unavailable' } });
    expect(run(service, 'w1', { type: 'soulseek.release', id: 'e5', kind: 'folder', handle: 'x' })).toMatchObject({ error: { code: 'invalid_request' } });
    for (let index = 0; index < 4; index += 1) run(service, 'w1', { type: 'soulseek.search', id: `s${index}`, request: { text: 'linux' } });
    expect(run(service, 'w1', { type: 'soulseek.search', id: 's5', request: { text: 'linux' } })).toEqual({ type: 'soulseek.search.result', id: 's5', error: { code: 'limit_exceeded', message: 'Query limit reached' } });
    service.setAccountState('offline');
    expect(run(service, 'w2', { type: 'soulseek.search', id: 's6', request: { text: 'linux' } })).toEqual({ type: 'soulseek.search.result', id: 's6', error: { code: 'unavailable', message: 'No online Soulseek account' } });
    expect(run(service, 'w2', { type: 'soulseek.info', id: 'i' })).toMatchObject({ value: { state: 'offline' } });
    expect(service.mock.state().queries.size).toBe(4);
  });

  it('downloads a catalog file with progress, then reads and saves it', () => {
    const service = createMockSoulseekService();
    run(service, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'debian' } });
    service.advance();
    const transfer = { transferId: 't1', file: DEBIAN_FILE, state: 'queued', maxReadBytes: 65536, received: '0' };
    expect(run(service, 'w1', { type: 'soulseek.download', id: 'q3', fileId: 'f1' })).toEqual({ type: 'soulseek.download.result', id: 'q3', value: transfer });
    expect(run(service, 'w1', { type: 'soulseek.download', id: 'q3b', fileId: 'f1' })).toEqual({ type: 'soulseek.download.result', id: 'q3b', value: transfer });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r0', transferId: 't1', offset: '0', length: 3 })).toEqual({ type: 'soulseek.read.result', id: 'r0', error: { code: 'invalid_state', message: 'Transfer is not complete' } });
    service.advance();
    expect(run(service, 'w1', { type: 'soulseek.status', id: 's1', transferId: 't1' })).toMatchObject({ value: { state: 'transferring', received: '165412864', bytesPerSecond: 165412864 } });
    service.advance(4);
    expect(run(service, 'w1', { type: 'soulseek.status', id: 's2', transferId: 't1' })).toEqual({ type: 'soulseek.status.result', id: 's2', value: { ...transfer, state: 'complete', received: String(DEBIAN.sizeBytes) } });
    expect(run(service, 'w1', { type: 'soulseek.transfers', id: 'l1' })).toEqual({ type: 'soulseek.transfers.result', id: 'l1', value: [{ ...transfer, state: 'complete', received: '661651456' }] });
    expect(run(service, 'w2', { type: 'soulseek.transfers', id: 'l2' })).toEqual({ type: 'soulseek.transfers.result', id: 'l2', value: [] });
    expect(run(service, 'w2', { type: 'soulseek.status', id: 'l3', transferId: 't1' })).toEqual({ type: 'soulseek.status.result', id: 'l3', error: { code: 'not_found', message: 'Transfer handle is unavailable' } });

    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r1', transferId: 't1', offset: '0', length: 6 })).toEqual({ type: 'soulseek.read.result', id: 'r1', value: { offset: '0', data: 'UysuRQPC', length: 6, eof: false } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r2', transferId: 't1', offset: '3', length: 3 })).toEqual({ type: 'soulseek.read.result', id: 'r2', value: { offset: '3', data: 'RQPC', length: 3, eof: false } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r3', transferId: 't1', offset: '661651454', length: 10 })).toEqual({ type: 'soulseek.read.result', id: 'r3', value: { offset: '661651454', data: '1dU=', length: 2, eof: true } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r4', transferId: 't1', offset: '661651456', length: 1 })).toEqual({ type: 'soulseek.read.result', id: 'r4', value: { offset: '661651456', data: '', length: 0, eof: true } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r5', transferId: 't1', offset: '00', length: 3 })).toEqual({ type: 'soulseek.read.result', id: 'r5', error: { code: 'invalid_request', message: 'Offset is not canonical decimal text' } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r6', transferId: 't1', offset: '661651457', length: 3 })).toMatchObject({ error: { code: 'invalid_request', message: 'offset exceeds file size' } });
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r7', transferId: 't1', offset: '0', length: 65537 })).toMatchObject({ error: { code: 'invalid_request' } });
    service.setReadAuthorization(false);
    expect(run(service, 'w1', { type: 'soulseek.read', id: 'r8', transferId: 't1', offset: '0', length: 3 })).toEqual({ type: 'soulseek.read.result', id: 'r8', error: { code: 'denied', message: 'Content disclosure is not authorized' } });
    expect(run(service, 'w1', { type: 'soulseek.save', id: 'sv', transferId: 't1' })).toEqual({ type: 'soulseek.save.result', id: 'sv', value: { saved: true } });
    expect(run(createMockSoulseekService({ canSave: false }), 'w1', { type: 'soulseek.save', id: 'sv2', transferId: 't1' })).toMatchObject({ error: { code: 'not_found' } });
    const noSave = downloaded(createMockSoulseekService({ canSave: false }));
    expect(run(noSave, 'w1', { type: 'soulseek.save', id: 'sv3', transferId: 't1' })).toEqual({ type: 'soulseek.save.result', id: 'sv3', error: { code: 'unsupported', message: 'save is not implemented' } });
  });

  it('follows the transfer state table for pause, resume, and cancel', () => {
    const service = createMockSoulseekService();
    run(service, 'w1', { type: 'soulseek.browse', id: 'b1', username: 'rolling-stone' });
    service.advance();
    run(service, 'w1', { type: 'soulseek.download', id: 'd', fileId: 'f1' });
    expect(run(service, 'w1', { type: 'soulseek.pause', id: 'p1', transferId: 't1' })).toMatchObject({ value: { state: 'paused', received: '0' } });
    expect(run(service, 'w1', { type: 'soulseek.pause', id: 'p2', transferId: 't1' })).toMatchObject({ value: { state: 'paused' } });
    service.advance();
    expect(run(service, 'w1', { type: 'soulseek.status', id: 's', transferId: 't1' })).toMatchObject({ value: { state: 'paused', received: '0' } });
    expect(run(service, 'w1', { type: 'soulseek.resume', id: 'r1', transferId: 't1' })).toMatchObject({ value: { state: 'queued' } });
    expect(run(service, 'w1', { type: 'soulseek.resume', id: 'r2', transferId: 't1' })).toMatchObject({ value: { state: 'queued' } });
    expect(run(service, 'w1', { type: 'soulseek.cancel', id: 'c1', transferId: 't1' })).toMatchObject({ value: { state: 'cancelled', received: '0' } });
    expect(run(service, 'w1', { type: 'soulseek.cancel', id: 'c2', transferId: 't1' })).toMatchObject({ value: { state: 'cancelled' } });
    expect(run(service, 'w1', { type: 'soulseek.pause', id: 'p3', transferId: 't1' })).toEqual({ type: 'soulseek.pause.result', id: 'p3', error: { code: 'invalid_state', message: 'Transfer is terminal' } });
    expect(run(service, 'w1', { type: 'soulseek.resume', id: 'r3', transferId: 't1' })).toMatchObject({ error: { code: 'invalid_state' } });
    expect(run(service, 'w1', { type: 'soulseek.save', id: 'sv', transferId: 't1' })).toMatchObject({ error: { code: 'invalid_state' } });
    service.setAccountState('offline');
    run(service, 'w1', { type: 'soulseek.download', id: 'd2', fileId: 'f1' });
    expect(run(service, 'w1', { type: 'soulseek.transfers', id: 'l' })).toMatchObject({ value: [{ transferId: 't1', state: 'cancelled' }] });
  });

  it('releases handles, honors ownership, and tears down per window', () => {
    const service = downloaded(createMockSoulseekService());
    expect(run(service, 'w2', { type: 'soulseek.release', id: 'x1', kind: 'query', handle: 's1' })).toEqual({ type: 'soulseek.release.result', id: 'x1', value: { released: false } });
    expect(run(service, 'w1', { type: 'soulseek.release', id: 'x2', kind: 'query', handle: 's1' })).toEqual({ type: 'soulseek.release.result', id: 'x2', value: { released: true } });
    expect(run(service, 'w1', { type: 'soulseek.release', id: 'x3', kind: 'query', handle: 's1' })).toMatchObject({ value: { released: false } });
    expect(run(service, 'w1', { type: 'soulseek.download', id: 'x4', fileId: 'f1' })).toEqual({ type: 'soulseek.download.result', id: 'x4', error: { code: 'not_found', message: 'File handle is unavailable' } });
    expect(run(service, 'w1', { type: 'soulseek.status', id: 'x5', transferId: 't1' })).toMatchObject({ value: { state: 'complete', file: DEBIAN_FILE } });
    expect(run(service, 'w1', { type: 'soulseek.release', id: 'x6', kind: 'transfer', handle: 't1' })).toMatchObject({ value: { released: true } });
    expect(run(service, 'w1', { type: 'soulseek.transfers', id: 'x7' })).toMatchObject({ value: [] });

    const torn = downloaded(createMockSoulseekService());
    run(torn, 'w2', { type: 'soulseek.search', id: 'o1', request: { text: 'alpine' } });
    torn.onWindowDestroyed?.('w1');
    expect(torn.mock.state().queries.size).toBe(1);
    expect(torn.mock.state().transfers.size).toBe(0);
    expect(torn.mock.state().handles.size).toBe(1);
    torn.onCapabilityRevoked?.('w2', null);
    expect(torn.mock.state().handles.size).toBe(0);
    expect(run(torn, 'w2', { type: 'soulseek.results', id: 'o2', queryId: 's2' })).toMatchObject({ error: { code: 'not_found' } });
  });

  it('runs autoplay through the scheduler and resets everything', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const service = createMockSoulseekService({ autoplay: true, tickMs: 5, scheduler: { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } } });
    run(service, 'w1', { type: 'soulseek.search', id: 'q1', request: { text: 'fedora' } });
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(run(service, 'w1', { type: 'soulseek.results', id: 'r', queryId: 's1' })).toMatchObject({ value: { query: { state: 'complete' }, files: [{ username: 'blue-hat' }] } });
    expect(queued).toHaveLength(0);
    run(service, 'w1', { type: 'soulseek.download', id: 'd', fileId: 'f1' });
    expect(queued).toHaveLength(1);
    service.mock.reset();
    expect(cancelled).toBe(1);
    expect(service.mock.state()).toMatchObject({ accountState: 'online', readsAuthorized: true, nextQuery: 1 });
    expect(service.mock.state().queries.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
