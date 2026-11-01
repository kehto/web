import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { TORRENT_CAPABILITIES, mockImageBytesBase64, parseTorrentSource } from './torrent-fixtures.js';
import { TORRENT_MOCK_ENTRY, TORRENT_SPEC_REF, createMockTorrentService } from './torrent.js';

const ROUTES = ['torrent.capabilities', 'torrent.pickFiles', 'torrent.add', 'torrent.status', 'torrent.jobs', 'torrent.files', 'torrent.selectFiles', 'torrent.pause', 'torrent.resume', 'torrent.remove', 'torrent.metadata', 'torrent.read', 'torrent.exportMetainfo', 'torrent.saveFile', 'torrent.openFile', 'torrent.cancel', 'torrent.update'];
const CLOCK = { now: () => 1_700_000_000_000 };
const DEBIAN = LINUX_DISTROS[0]!;
const HASH = '739e3fecd39391a55e2445f122e9aba0c5ae163d';
const SETTINGS = { revision: 0, downloadLimitBytesPerSecond: 0, uploadLimitBytesPerSecond: 0, seedAfterComplete: true, trackers: ['udp://tracker.example.org:6969/announce'], webSeeds: [...DEBIAN.mirrors], endpointsRedacted: false };
const MAGNET = { sourceType: 'magnet', magnet: DEBIAN.magnet };

type Service = ReturnType<typeof createMockTorrentService>;

function run(service: Service, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

function add(service: Service, windowId: string, source: Record<string, unknown>, options?: Record<string, unknown>, jobId?: string): NappletMessage {
  return run(service, windowId, { type: 'torrent.add', id: `add-${service.mock.state().nextJob}`, request: { source, ...(options ? { options } : {}), ...(jobId ? { jobId } : {}) } });
}

function pushes(service: Service): NappletMessage[] {
  return service.mock.sent.map((entry) => entry.message).filter((msg) => msg.type === 'torrent.state' || msg.type === 'torrent.progress' || msg.type === 'torrent.error');
}

describe('NAP-TORRENT mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockTorrentService();
    expect(service.descriptor).toEqual({ name: 'torrent', version: '0.1.0', description: 'Mock NAP-TORRENT runtime-mediated transfers of Linux images' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(TORRENT_SPEC_REF).toEqual({ nap: 'NAP-TORRENT', status: 'draft', source: 'pr', pr: 72, sha: 'bc99787e3cf0', path: 'naps/NAP-TORRENT.md' });
    expect(TORRENT_MOCK_ENTRY).toMatchObject({ domain: 'torrent', kind: 'extension' });
    expect(TORRENT_MOCK_ENTRY.create?.({}).descriptor.name).toBe('torrent');
    expect(run(service, 'w1', { type: 'torrent.capabilities', id: 'c1' })).toEqual({ type: 'torrent.capabilities.result', id: 'c1', capabilities: { ...TORRENT_CAPABILITIES } });
  });

  it('adds a magnet, resolves metadata, pushes progress, and ends seeding', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    expect(add(service, 'w1', MAGNET, { mode: 'download-and-seed', storage: 'user-selected' })).toEqual({ type: 'torrent.add.result', id: 'add-1', ack: { ok: true, jobId: 'tor-1', state: 'metadata' } });
    expect(run(service, 'w1', { type: 'torrent.status', id: 's0', jobId: 'tor-1' })).toEqual({ type: 'torrent.status.result', id: 's0', status: {
      ok: true, jobId: 'tor-1', state: 'metadata', mode: 'download-and-seed', transport: 'bittorrent', hashes: { v1: HASH }, downloadedBytes: 0, uploadedBytes: 0, downloadRate: 0, uploadRate: 0, ratio: 0,
      peers: { peers: 3, seeds: 2, leeches: 1 }, title: DEBIAN.fileName, storage: 'user-selected', settings: SETTINGS, retention: 'session',
    } });
    expect(run(service, 'w1', { type: 'torrent.files', id: 'f0', jobId: 'tor-1' })).toEqual({ type: 'torrent.files.result', id: 'f0', files: [] });
    expect(service.mock.state().jobs.get('tor-1')!.peerNames).toEqual(['tux-mirror', 'lambda-cat', 'penguin-share']);
    service.advance();
    expect(pushes(service)).toEqual([{ type: 'torrent.state', jobId: 'tor-1', state: 'downloading', status: {
      ok: true, jobId: 'tor-1', state: 'downloading', mode: 'download-and-seed', transport: 'bittorrent', hashes: { v1: HASH }, downloadedBytes: 0, uploadedBytes: 0, totalBytes: 661651456, progress: 0,
      downloadRate: 165412864, uploadRate: 16541286, ratio: 0, peers: { peers: 3, seeds: 2, leeches: 1 }, title: DEBIAN.fileName, etaSeconds: 4, storage: 'user-selected', settings: SETTINGS, retention: 'session',
    } }]);
    service.advance();
    expect(pushes(service).at(-1)).toMatchObject({ type: 'torrent.progress', jobId: 'tor-1', status: { state: 'downloading', downloadedBytes: 165412864, uploadedBytes: 16541286, progress: 0.25, ratio: 0.1, etaSeconds: 3 } });
    expect(run(service, 'w1', { type: 'torrent.files', id: 'f1', jobId: 'tor-1' })).toEqual({ type: 'torrent.files.result', id: 'f1', files: [{ index: 0, path: DEBIAN.fileName, size: 661651456, selected: true, priority: 0, downloadedBytes: 165412864, progress: 0.25 }] });
    expect(run(service, 'w1', { type: 'torrent.jobs', id: 'j1' })).toEqual({ type: 'torrent.jobs.result', id: 'j1', jobs: [{ jobId: 'tor-1', state: 'downloading', mode: 'download-and-seed', transport: 'bittorrent', hashes: { v1: HASH }, progress: 0.25, downloadRate: 165412864, uploadRate: 16541286, ratio: 0.1, title: DEBIAN.fileName, retention: 'session' }] });
    service.advance(3);
    expect(pushes(service).at(-1)).toMatchObject({ type: 'torrent.state', jobId: 'tor-1', state: 'seeding', status: { downloadedBytes: 661651456, uploadedBytes: 66165144, progress: 1, downloadRate: 0, uploadRate: 16541286 } });
    expect(pushes(service).map((msg) => msg.type)).toEqual(['torrent.state', 'torrent.progress', 'torrent.progress', 'torrent.progress', 'torrent.state']);
    expect(run(service, 'w1', { type: 'torrent.jobs', id: 'j2', filter: { states: ['downloading'] } })).toEqual({ type: 'torrent.jobs.result', id: 'j2', jobs: [] });
    expect(run(service, 'w2', { type: 'torrent.status', id: 's9', jobId: 'tor-1' })).toEqual({ type: 'torrent.status.result', id: 's9', error: 'job-not-found' });
  });

  it('validates sources and options before creating a job', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    const ack = (msg: NappletMessage) => (msg as unknown as { ack: Record<string, unknown> }).ack;
    expect(ack(add(service, 'w1', { sourceType: 'magnet', magnet: 'magnet:?xt=urn:btih:zz' }))).toEqual({ ok: false, error: 'invalid-magnet' });
    expect(ack(add(service, 'w1', { sourceType: 'magnet', magnet: DEBIAN.magnet, hashes: { v1: HASH } }))).toEqual({ ok: false, error: 'invalid-source' });
    expect(ack(add(service, 'w1', { sourceType: 'infohash', hashes: { v1: 'abc' } }))).toEqual({ ok: false, error: 'invalid-infohash' });
    expect(ack(add(service, 'w1', { sourceType: 'infohash', hashes: { v2: 'ab'.repeat(32) } }))).toEqual({ ok: false, error: 'unsupported-format' });
    expect(ack(add(service, 'w1', { sourceType: 'ftp' }))).toEqual({ ok: false, error: 'unsupported-source' });
    expect(ack(add(service, 'w1', { sourceType: 'runtime-file-set', runtimeFileSetId: 'fs-404' }, { mode: 'seed' }))).toEqual({ ok: false, error: 'source-unavailable' });
    expect(ack(add(service, 'w1', MAGNET, { mode: 'stream' }))).toEqual({ ok: false, error: 'unsupported-mode' });
    expect(ack(add(service, 'w1', MAGNET, { transport: 'carrier-pigeon' }))).toEqual({ ok: false, error: 'unsupported-transport' });
    expect(ack(add(service, 'w1', MAGNET, { seedAfterComplete: true }))).toEqual({ ok: false, error: 'invalid-request' });
    expect(ack(add(service, 'w1', { sourceType: 'metainfo', metainfo: 'not base64!' }))).toEqual({ ok: false, error: 'invalid-source' });
    expect(service.mock.state().jobs.size).toBe(0);
    expect(ack(add(service, 'w1', { sourceType: 'infohash', hashes: { v1: HASH } }, { retention: 'persistent' }, 'retained-1'))).toEqual({ ok: true, jobId: 'retained-1', state: 'metadata' });
    expect(ack(add(service, 'w1', MAGNET, undefined, 'retained-1'))).toEqual({ ok: false, error: 'job-conflict' });
    expect(run(service, 'w1', { type: 'torrent.jobs', id: 'j' })).toEqual({ type: 'torrent.jobs.result', id: 'j', jobs: [{ jobId: 'retained-1', state: 'metadata', mode: 'download', transport: 'bittorrent', hashes: { v1: HASH }, downloadRate: 0, uploadRate: 0, ratio: 0, title: DEBIAN.fileName, retention: 'persistent' }] });

    const unknown = 'f'.repeat(40);
    expect(ack(add(service, 'w1', { sourceType: 'infohash', hashes: { v1: unknown } }))).toEqual({ ok: true, jobId: 'tor-1', state: 'metadata' });
    service.advance();
    expect(pushes(service).filter((msg) => (msg as unknown as { jobId: string }).jobId === 'tor-1')).toEqual([
      { type: 'torrent.error', jobId: 'tor-1', error: 'no-peers' },
      { type: 'torrent.state', jobId: 'tor-1', state: 'error', status: expect.objectContaining({ state: 'error', error: 'no-peers', hashes: { v1: unknown } }) },
    ]);
    expect(parseTorrentSource({ sourceType: 'magnet', magnet: DEBIAN.magnet }, LINUX_DISTROS)).toEqual({ ok: true, sourceType: 'magnet', claimedV1: HASH, image: DEBIAN });
  });

  it('seeds a picked runtime file set and rejects selection on seed jobs', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    expect(run(service, 'w1', { type: 'torrent.pickFiles', id: 'p1', options: { multiple: true } })).toEqual({ type: 'torrent.pickFiles.result', id: 'p1', result: { ok: true, fileSet: { runtimeFileSetId: 'fs-1', files: [{ path: DEBIAN.fileName, size: 661651456 }], totalBytes: 661651456, displayName: 'Debian 12.7.0' } } });
    expect(run(service, 'w1', { type: 'torrent.pickFiles', id: 'p2' })).toMatchObject({ result: { fileSet: { runtimeFileSetId: 'fs-2', displayName: 'Ubuntu 24.04.1' } } });
    expect(add(service, 'w2', { sourceType: 'runtime-file-set', runtimeFileSetId: 'fs-1' }, { mode: 'seed' })).toMatchObject({ ack: { ok: false, error: 'source-unavailable' } });
    expect(add(service, 'w1', { sourceType: 'runtime-file-set', runtimeFileSetId: 'fs-1' })).toMatchObject({ ack: { ok: false, error: 'unsupported-mode' } });
    expect(add(service, 'w1', { sourceType: 'runtime-file-set', runtimeFileSetId: 'fs-1' }, { mode: 'seed', createFormat: 'v2' })).toMatchObject({ ack: { ok: false, error: 'unsupported-format' } });
    expect(add(service, 'w1', { sourceType: 'runtime-file-set', runtimeFileSetId: 'fs-1' }, { mode: 'seed', uploadLimitBytesPerSecond: 500000 })).toEqual({ type: 'torrent.add.result', id: 'add-1', ack: { ok: true, jobId: 'tor-1', state: 'seeding' } });
    expect(run(service, 'w1', { type: 'torrent.status', id: 's', jobId: 'tor-1' })).toMatchObject({ status: { state: 'seeding', mode: 'seed', downloadedBytes: 661651456, totalBytes: 661651456, progress: 1, hashes: { v1: HASH }, settings: { uploadLimitBytesPerSecond: 500000, seedAfterComplete: true } } });
    expect(run(service, 'w1', { type: 'torrent.selectFiles', id: 'sel', jobId: 'tor-1', selection: { indexes: [] } })).toEqual({ type: 'torrent.selectFiles.result', id: 'sel', error: 'unsupported-state' });
    expect(run(service, 'w1', { type: 'torrent.update', id: 'u', request: { jobId: 'tor-1', expectedRevision: 0, patch: { seedAfterComplete: false } } })).toEqual({ type: 'torrent.update.result', id: 'u', result: { ok: false, error: 'unsupported-state' } });
    expect(run(service, 'w1', { type: 'torrent.metadata', id: 'm', jobId: 'tor-1' })).toMatchObject({ result: { ok: true, hashes: { v1: HASH }, metainfoReady: true } });
    service.advance();
    expect(run(service, 'w1', { type: 'torrent.status', id: 's2', jobId: 'tor-1' })).toMatchObject({ status: { uploadedBytes: 16541286, ratio: 0.025 } });
  });

  it('pauses, resumes, selects files, and removes jobs', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    add(service, 'w1', MAGNET);
    service.advance(2);
    expect(run(service, 'w1', { type: 'torrent.pause', id: 'x1', jobId: 'tor-1' })).toMatchObject({ type: 'torrent.pause.result', id: 'x1', status: { state: 'paused', downloadedBytes: 165412864, downloadRate: 0, peers: { peers: 0, seeds: 0, leeches: 0 } } });
    service.advance();
    expect(run(service, 'w1', { type: 'torrent.status', id: 'x2', jobId: 'tor-1' })).toMatchObject({ status: { state: 'paused', downloadedBytes: 165412864 } });
    expect(run(service, 'w1', { type: 'torrent.selectFiles', id: 'x3', jobId: 'tor-1', selection: { indexes: [], priority: 2 } })).toMatchObject({ status: { state: 'paused' } });
    expect(run(service, 'w1', { type: 'torrent.files', id: 'x4', jobId: 'tor-1' })).toMatchObject({ files: [{ selected: false, priority: 2 }] });
    expect(run(service, 'w1', { type: 'torrent.selectFiles', id: 'x5', jobId: 'tor-1', selection: { paths: [DEBIAN.fileName] } })).toMatchObject({ status: { state: 'paused' } });
    expect(run(service, 'w1', { type: 'torrent.selectFiles', id: 'x6', jobId: 'tor-1', selection: { indexes: [4] } })).toEqual({ type: 'torrent.selectFiles.result', id: 'x6', error: 'invalid-request' });
    expect(run(service, 'w1', { type: 'torrent.resume', id: 'x7', jobId: 'tor-1' })).toMatchObject({ status: { state: 'downloading', peers: { peers: 3 } } });
    expect(run(service, 'w1', { type: 'torrent.resume', id: 'x8', jobId: 'tor-1' })).toMatchObject({ status: { state: 'downloading' } });
    service.advance(3);
    expect(run(service, 'w1', { type: 'torrent.status', id: 'x9', jobId: 'tor-1' })).toMatchObject({ status: { state: 'complete', mode: 'download', progress: 1 } });
    expect(run(service, 'w1', { type: 'torrent.pause', id: 'x10', jobId: 'tor-1' })).toEqual({ type: 'torrent.pause.result', id: 'x10', error: 'unsupported-state' });
    expect(run(service, 'w1', { type: 'torrent.remove', id: 'x11', jobId: 'tor-1', options: { deleteData: true } })).toEqual({ type: 'torrent.remove.result', id: 'x11', result: { ok: true, jobId: 'tor-1', deletedData: true } });
    expect(run(service, 'w1', { type: 'torrent.remove', id: 'x12', jobId: 'tor-1' })).toEqual({ type: 'torrent.remove.result', id: 'x12', result: { ok: false, error: 'job-not-found' } });
    expect(run(service, 'w1', { type: 'torrent.pause', id: 'x13', jobId: 'tor-1' })).toEqual({ type: 'torrent.pause.result', id: 'x13', error: 'job-not-found' });
    expect(add(service, 'w1', MAGNET, { startPaused: true })).toMatchObject({ ack: { ok: true, jobId: 'tor-2', state: 'paused' } });
    expect(run(service, 'w1', { type: 'torrent.resume', id: 'x14', jobId: 'tor-2' })).toMatchObject({ status: { state: 'metadata' } });
  });

  it('reads verified bytes, waits with cancellation and timeout, and saves or opens files', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    add(service, 'w1', MAGNET);
    const read = (id: string, request: Record<string, unknown>, windowId = 'w1') => run(service, windowId, { type: 'torrent.read', id, request: { jobId: 'tor-1', fileIndex: 0, ...request } });
    expect(read('r0', { offset: 0, length: 4 })).toEqual({ type: 'torrent.read.result', id: 'r0', result: { ok: false, error: 'metadata-unavailable' } });
    service.advance(2);
    expect(read('r1', { offset: 0, length: 4 })).toEqual({ type: 'torrent.read.result', id: 'r1', result: { ok: true, offset: 0, dataBase64: 'UysuRQ==', byteLength: 4, totalBytes: 661651456, eof: false } });
    expect(read('r2', { offset: 165412860, length: 4 })).toMatchObject({ result: { ok: true, dataBase64: mockImageBytesBase64(DEBIAN, 165412860, 4), byteLength: 4 } });
    expect(read('r3', { offset: 165412861, length: 4 })).toEqual({ type: 'torrent.read.result', id: 'r3', result: { ok: false, error: 'not-ready' } });
    expect(read('r4', { offset: 661651457, length: 4 })).toMatchObject({ result: { ok: false, error: 'invalid-range' } });
    expect(read('r5', { offset: 0, length: 0 })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
    expect(read('r6', { offset: 0, length: 65537 })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
    expect(read('r7', { fileIndex: 1, offset: 0, length: 1 })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
    expect(read('r8', { offset: 0, length: 1 }, 'w2')).toMatchObject({ result: { ok: false, error: 'job-not-found' } });
    expect(run(service, 'w1', { type: 'torrent.saveFile', id: 'sv0', jobId: 'tor-1', fileIndex: 0 })).toEqual({ type: 'torrent.saveFile.result', id: 'sv0', result: { ok: false, error: 'not-ready' } });

    const readResults = () => service.mock.sent.map((entry) => entry.message).filter((msg) => msg.type === 'torrent.read.result' && /^read-/.test(String((msg as unknown as { id: string }).id)));
    const pendingRead = (id: string, offset: number, length: number, waitMs: number) =>
      service.handleMessage('w1', { type: 'torrent.read', id, request: { jobId: 'tor-1', fileIndex: 0, offset, length, waitMs } } as unknown as NappletMessage, () => {});
    pendingRead('read-2', 300000000, 65536, 3000);
    expect(readResults()).toEqual([]);
    expect(run(service, 'w2', { type: 'torrent.cancel', id: 'cx', requestId: 'read-2' })).toEqual({ type: 'torrent.cancel.result', id: 'cx', result: { ok: true, cancelled: false } });
    expect(run(service, 'w1', { type: 'torrent.cancel', id: 'cancel-1', requestId: 'read-2' })).toEqual({ type: 'torrent.cancel.result', id: 'cancel-1', result: { ok: true, cancelled: true } });
    expect(readResults()).toEqual([{ type: 'torrent.read.result', id: 'read-2', result: { ok: false, error: 'cancelled' } }]);
    expect(run(service, 'w1', { type: 'torrent.cancel', id: 'cancel-2', requestId: 'read-2' })).toMatchObject({ result: { cancelled: false } });

    pendingRead('read-3', 300000000, 4, 3000);
    pendingRead('read-4', 661651452, 4, 1000);
    service.advance();
    expect(readResults().slice(1)).toEqual([
      { type: 'torrent.read.result', id: 'read-3', result: { ok: true, offset: 300000000, dataBase64: mockImageBytesBase64(DEBIAN, 300000000, 4), byteLength: 4, totalBytes: 661651456, eof: false } },
      { type: 'torrent.read.result', id: 'read-4', result: { ok: false, error: 'timeout' } },
    ]);
    service.advance(2);
    expect(read('r9', { offset: 661651452, length: 8 })).toMatchObject({ result: { ok: true, byteLength: 4, eof: true } });
    expect(run(service, 'w1', { type: 'torrent.saveFile', id: 'save-1', jobId: 'tor-1', fileIndex: 0 })).toEqual({ type: 'torrent.saveFile.result', id: 'save-1', result: { ok: true, jobId: 'tor-1', fileIndex: 0, outcome: 'saved' } });
    expect(run(service, 'w1', { type: 'torrent.openFile', id: 'open-1', jobId: 'tor-1', fileIndex: 0 })).toEqual({ type: 'torrent.openFile.result', id: 'open-1', result: { ok: true, jobId: 'tor-1', fileIndex: 0, outcome: 'accepted' } });
    expect(run(service, 'w1', { type: 'torrent.openFile', id: 'open-2', jobId: 'tor-1', fileIndex: 3 })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
  });

  it('exports metainfo that round-trips as a metainfo source', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    add(service, 'w1', MAGNET);
    expect(run(service, 'w1', { type: 'torrent.metadata', id: 'm0', jobId: 'tor-1' })).toEqual({ type: 'torrent.metadata.result', id: 'm0', result: { ok: false, error: 'metadata-unavailable' } });
    expect(run(service, 'w1', { type: 'torrent.exportMetainfo', id: 'e0', jobId: 'tor-1' })).toEqual({ type: 'torrent.exportMetainfo.result', id: 'e0', result: { ok: false, error: 'metadata-unavailable' } });
    service.advance();
    expect(run(service, 'w1', { type: 'torrent.metadata', id: 'm1', jobId: 'tor-1' })).toEqual({ type: 'torrent.metadata.result', id: 'm1', result: {
      ok: true, format: 'v1', hashes: { v1: HASH }, name: DEBIAN.fileName, private: false, magnet: `magnet:?xt=urn:btih:${HASH}&dn=${encodeURIComponent(DEBIAN.fileName)}`,
      trackers: ['udp://tracker.example.org:6969/announce'], webSeeds: [...DEBIAN.mirrors], endpointsRedacted: false, metainfoReady: true,
    } });
    const exported = run(service, 'w1', { type: 'torrent.exportMetainfo', id: 'e1', jobId: 'tor-1' }) as unknown as { result: { ok: boolean; dataBase64: string; byteLength: number; hashes: { v1: string } } };
    expect(exported.result).toMatchObject({ ok: true, byteLength: 3407, hashes: { v1: HASH } });
    expect(atob(exported.result.dataBase64)).toMatch(/^d8:announce39:udp:\/\/tracker\.example\.org:6969\/announce13:announce-listll39:/);
    expect(atob(exported.result.dataBase64)).toContain(`4:infod6:lengthi661651456e4:name31:${DEBIAN.fileName}12:piece lengthi4194304e6:pieces`);
    expect(add(service, 'w1', { sourceType: 'metainfo', metainfo: exported.result.dataBase64 })).toEqual({ type: 'torrent.add.result', id: 'add-2', ack: { ok: true, jobId: 'tor-2', state: 'metadata' } });
    expect(run(service, 'w1', { type: 'torrent.status', id: 's', jobId: 'tor-2' })).toMatchObject({ status: { hashes: { v1: HASH }, title: DEBIAN.fileName } });
  });

  it('applies live settings atomically with revision checks', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    add(service, 'w1', MAGNET, { mode: 'download-and-seed' });
    const update = (id: string, request: Record<string, unknown>) => run(service, 'w1', { type: 'torrent.update', id, request: { jobId: 'tor-1', ...request } });
    expect(update('u1', { expectedRevision: 0, patch: { uploadLimitBytesPerSecond: 500000 } })).toEqual({ type: 'torrent.update.result', id: 'u1', result: { ok: true, settings: { ...SETTINGS, revision: 1, uploadLimitBytesPerSecond: 500000 } } });
    expect(update('u2', { expectedRevision: 0, patch: { trackers: [] } })).toEqual({ type: 'torrent.update.result', id: 'u2', result: { ok: false, error: 'revision-conflict', settings: { ...SETTINGS, revision: 1, uploadLimitBytesPerSecond: 500000 } } });
    expect(update('u3', { expectedRevision: 1, patch: { uploadLimitBytesPerSecond: 500000 } })).toMatchObject({ result: { ok: true, settings: { revision: 1 } } });
    expect(update('u4', { expectedRevision: 1, patch: { dht: false } })).toEqual({ type: 'torrent.update.result', id: 'u4', result: { ok: false, error: 'unsupported-setting' } });
    expect(update('u5', { expectedRevision: 1, patch: {} })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
    expect(update('u6', { expectedRevision: 1, patch: { downloadLimitBytesPerSecond: -1 } })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });
    expect(update('u7', { expectedRevision: 1, patch: { trackers: [], webSeeds: [] } })).toMatchObject({ result: { ok: true, settings: { revision: 2, trackers: [], webSeeds: [] } } });
    service.advance(5);
    expect(run(service, 'w1', { type: 'torrent.status', id: 's1', jobId: 'tor-1' })).toMatchObject({ status: { state: 'seeding', mode: 'download-and-seed' } });
    expect(update('u8', { expectedRevision: 2, patch: { seedAfterComplete: false } })).toMatchObject({ result: { ok: true, settings: { revision: 3, seedAfterComplete: false } } });
    expect(pushes(service).at(-1)).toMatchObject({ type: 'torrent.state', jobId: 'tor-1', state: 'complete', status: { mode: 'download' } });
    expect(update('u9', { expectedRevision: 3, patch: { seedAfterComplete: true } })).toMatchObject({ result: { ok: true, settings: { revision: 4 } } });
    expect(run(service, 'w1', { type: 'torrent.status', id: 's2', jobId: 'tor-1' })).toMatchObject({ status: { state: 'seeding', mode: 'download-and-seed' } });
  });

  it('retires session jobs on window teardown, keeps persistent ones, and revokes reads', () => {
    const service = createMockTorrentService({ clock: CLOCK });
    add(service, 'w1', MAGNET);
    add(service, 'w1', { sourceType: 'infohash', hashes: { v1: LINUX_DISTROS[3]!.infoHash } }, { retention: 'persistent' }, 'retained-1');
    run(service, 'w1', { type: 'torrent.pickFiles', id: 'p' });
    service.advance(2);
    const sink: NappletMessage[] = [];
    service.handleMessage('w1', { type: 'torrent.read', id: 'pending', request: { jobId: 'tor-1', fileIndex: 0, offset: 600000000, length: 4, waitMs: 5000 } } as unknown as NappletMessage, (msg) => sink.push(msg));
    service.onCapabilityRevoked?.('w1', null);
    expect(sink).toEqual([{ type: 'torrent.read.result', id: 'pending', result: { ok: false, error: 'permission-revoked' } }]);
    expect(service.mock.state().jobs.get('tor-1')!.state).toBe('paused');
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().jobs.keys()]).toEqual(['retained-1']);
    expect(service.mock.state().fileSets.size).toBe(0);
    expect(run(service, 'w1', { type: 'torrent.jobs', id: 'recover-1' })).toMatchObject({ jobs: [{ jobId: 'retained-1', retention: 'persistent', hashes: { v1: LINUX_DISTROS[3]!.infoHash } }] });
  });

  it('runs autoplay through the scheduler and resets everything', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const service = createMockTorrentService({ clock: CLOCK, autoplay: true, tickMs: 5, scheduler: { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } } });
    add(service, 'w1', MAGNET);
    expect(queued).toHaveLength(1);
    for (let index = 0; index < 5; index += 1) queued.shift()!();
    expect(queued).toHaveLength(0);
    expect(run(service, 'w1', { type: 'torrent.status', id: 's', jobId: 'tor-1' })).toMatchObject({ status: { state: 'complete' } });
    add(service, 'w1', MAGNET);
    expect(queued).toHaveLength(1);
    service.mock.reset();
    expect(cancelled).toBe(1);
    expect(service.mock.state().jobs.size).toBe(0);
    expect(service.mock.state().nextJob).toBe(1);
    expect(service.mock.sent).toEqual([]);
  });
});
