import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { NZB_DOWNLOADERS, NZB_MOCK_ENTRY, NZB_SPEC_REF, createMockNzbService, mockNzbDocument, mockNzbUrl } from './nzb.js';

const ROUTES = ['nzb.downloaders', 'nzb.add', 'nzb.jobs', 'nzb.status', 'nzb.control', 'nzb.files', 'nzb.read'];
const CLOCK = { now: () => 1_700_000_000_000 };
const DEBIAN = LINUX_DISTROS[0]!;
const ALPINE = LINUX_DISTROS[4]!;
const URL_SOURCE = { kind: 'url', url: mockNzbUrl(DEBIAN) };
const BYTES_SOURCE = { kind: 'bytes', dataBase64: btoa(mockNzbDocument(ALPINE)) };
const REPLAY_UNTIL = 1_700_086_400;

type Service = ReturnType<typeof createMockNzbService>;

function run(service: Service, windowId: string, message: Record<string, unknown>): NappletMessage {
  const out: NappletMessage[] = [];
  service.handleMessage(windowId, message as unknown as NappletMessage, (msg) => out.push(msg));
  const result = out.find((msg) => msg.type === `${String(message.type)}.result` && (msg as { id?: unknown }).id === message.id);
  expect(result).toBeDefined();
  return result!;
}

function control(service: Service, jobId: string, action: string, key = `${action}-${jobId}`): NappletMessage {
  return run(service, 'w1', { type: 'nzb.control', id: `c-${key}`, request: { jobId, operationKey: key, action } });
}

describe('NAP-NZB mock', () => {
  it('describes itself and publishes every route as an extension capability', () => {
    const service = createMockNzbService();
    expect(service.descriptor).toEqual({ name: 'nzb', version: '0.1.0', description: 'Mock NAP-NZB downloader jobs over the Linux image catalog' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities ?? {})).toEqual(ROUTES);
    expect(NZB_SPEC_REF).toEqual({ nap: 'NAP-NZB', status: 'draft', source: 'pr', pr: 136, sha: '3a426fe433d4', path: 'naps/NAP-NZB.md' });
    expect(NZB_MOCK_ENTRY).toMatchObject({ domain: 'nzb', kind: 'extension' });
    expect(NZB_MOCK_ENTRY.create?.({}).descriptor.name).toBe('nzb');
  });

  it('discovers the native and remote downloaders', () => {
    const service = createMockNzbService();
    expect(run(service, 'w1', { type: 'nzb.downloaders', id: 'd1' })).toEqual({ type: 'nzb.downloaders.result', id: 'd1', result: { downloaders: [
      { downloaderId: 'native', label: 'Local downloads', canAdd: true, sourceKinds: ['bytes', 'url'], addOptions: ['categoryId', 'priority', 'startPaused', 'password'], categories: [{ categoryId: 'default', label: 'Default', description: 'Configured default destination' }, { categoryId: 'iso', label: 'ISO images', description: 'Verified and moved to the ISO library' }], actions: ['pause', 'resume', 'cancel', 'retry', 'forget', 'delete'], canReadFiles: true, maxNZBBytes: 1048576, maxPageSize: 100, maxReadBytes: 65536, replaySeconds: 86400 },
      { downloaderId: 'remote', label: 'Home downloader', canAdd: true, sourceKinds: ['bytes'], addOptions: [], categories: [], actions: ['pause', 'resume', 'forget'], canReadFiles: false, maxNZBBytes: 1048576, maxPageSize: 100, maxReadBytes: 0, replaySeconds: 86400 },
    ] } });
    expect(NZB_DOWNLOADERS).toHaveLength(2);
    expect(mockNzbDocument(DEBIAN)).toContain(`<segment bytes="661651456" number="1">${DEBIAN.nzbId}</segment>`);
    expect(mockNzbUrl(DEBIAN)).toBe('https://indexer.example.org/nzb/debian-12-netinst.nzb');
  });

  it('adds catalog NZBs by url and bytes with mutation replay', () => {
    const service = createMockNzbService({ clock: CLOCK });
    const added = run(service, 'w1', { type: 'nzb.add', id: 'a1', request: { downloaderId: 'native', operationKey: 'submit-1', source: URL_SOURCE, categoryId: 'iso' } });
    expect(added).toEqual({ type: 'nzb.add.result', id: 'a1', result: {
      job: { jobId: 'job-1', downloaderId: 'native', name: 'debian-12.7.0-amd64-netinst.iso', state: 'queued', observedAt: 1_700_000_000, actions: ['pause', 'cancel'], canReadFiles: false, categoryId: 'iso', downloadPaused: false },
      replayUntil: REPLAY_UNTIL,
    } });
    expect(run(service, 'w1', { type: 'nzb.add', id: 'a1b', request: { downloaderId: 'native', operationKey: 'submit-1', source: URL_SOURCE, categoryId: 'iso' } })).toEqual({ ...added, id: 'a1b' });
    expect(run(service, 'w1', { type: 'nzb.add', id: 'a1c', request: { downloaderId: 'native', operationKey: 'submit-1', source: URL_SOURCE, categoryId: 'iso', name: 'Other' } })).toEqual({
      type: 'nzb.add.result', id: 'a1c', error: { code: 'conflict', message: 'Operation key reused with different parameters', replayUntil: REPLAY_UNTIL },
    });
    expect(service.mock.state().jobs.size).toBe(1);
    expect(run(service, 'w1', { type: 'nzb.add', id: 'a2', request: { downloaderId: 'remote', operationKey: 'submit-2', source: BYTES_SOURCE, name: 'Alpine' } })).toEqual({ type: 'nzb.add.result', id: 'a2', result: {
      job: { jobId: 'job-2', downloaderId: 'remote', name: 'Alpine', state: 'queued', observedAt: 1_700_000_000, actions: ['pause'], canReadFiles: false, downloadPaused: false },
      replayUntil: REPLAY_UNTIL,
    } });
    expect(run(service, 'w1', { type: 'nzb.add', id: 'a3', request: { downloaderId: 'native', operationKey: 'submit-3', source: BYTES_SOURCE, startPaused: true, priority: 'high', password: 'hunter2' } })).toMatchObject({
      result: { job: { jobId: 'job-3', state: 'paused', downloadPaused: true, actions: ['resume', 'cancel'] } },
    });
    expect(JSON.stringify(service.mock.state().replay.get('w1:native:submit-3'))).not.toContain('hunter2');
  });

  it('rejects invalid, unsupported, and unknown submissions before creating jobs', () => {
    const service = createMockNzbService({ clock: CLOCK });
    const add = (id: string, request: Record<string, unknown>) => run(service, 'w1', { type: 'nzb.add', id, request });
    expect(add('e1', { downloaderId: 'ghost', operationKey: 'k', source: URL_SOURCE })).toEqual({ type: 'nzb.add.result', id: 'e1', error: { code: 'not_found', message: 'Unknown downloader' } });
    expect(add('e2', { downloaderId: 'remote', operationKey: 'k', source: URL_SOURCE })).toMatchObject({ error: { code: 'unsupported', message: 'Downloader does not accept this source kind' } });
    expect(add('e3', { downloaderId: 'remote', operationKey: 'k', source: BYTES_SOURCE, startPaused: true })).toMatchObject({ error: { code: 'unsupported', message: 'Downloader does not honor startPaused' } });
    expect(add('e4', { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE, categoryId: 'movies' })).toMatchObject({ error: { code: 'not_found', message: 'Unknown category' } });
    expect(add('e5', { downloaderId: 'native', operationKey: 'k', source: { kind: 'bytes', dataBase64: btoa('<html/>') } })).toMatchObject({ error: { code: 'invalid_request', message: 'source is not a valid NZB' } });
    expect(add('e6', { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE, bogus: 1 })).toMatchObject({ error: { code: 'invalid_request' } });
    expect(add('e7', { downloaderId: 'native', operationKey: '', source: URL_SOURCE })).toMatchObject({ error: { code: 'invalid_request' } });
    expect(add('e8', { downloaderId: 'native', operationKey: 'k', source: { kind: 'url', url: 'http://indexer.example.org/x.nzb' } })).toMatchObject({ error: { code: 'invalid_request' } });
    const stranger = btoa(mockNzbDocument(DEBIAN).replace(DEBIAN.nzbId, 'nobody@news.example.org'));
    expect(add('e9', { downloaderId: 'native', operationKey: 'k9', source: { kind: 'bytes', dataBase64: stranger } })).toEqual({ type: 'nzb.add.result', id: 'e9', error: { code: 'backend_rejected', message: 'No such articles on the news server', replayUntil: REPLAY_UNTIL } });
    expect(add('e9b', { downloaderId: 'native', operationKey: 'k9', source: { kind: 'bytes', dataBase64: stranger } })).toMatchObject({ error: { code: 'backend_rejected' } });
    expect(service.mock.state().jobs.size).toBe(0);
  });

  it('advances jobs to completion and pages jobs in jobId byte order', () => {
    const service = createMockNzbService({ clock: CLOCK });
    for (const key of ['k1', 'k2', 'k3']) run(service, 'w1', { type: 'nzb.add', id: key, request: { downloaderId: 'native', operationKey: key, source: URL_SOURCE } });
    run(service, 'w2', { type: 'nzb.add', id: 'o', request: { downloaderId: 'native', operationKey: 'k1', source: URL_SOURCE } });
    service.advance();
    expect(run(service, 'w1', { type: 'nzb.status', id: 's1', jobId: 'job-1' })).toMatchObject({ result: { state: 'downloading', downloadProgress: 0, downloadedBytes: 0, totalBytes: 661651456, downloadRate: 165412864, actions: ['pause', 'cancel'] } });
    service.advance(2);
    expect(run(service, 'w1', { type: 'nzb.status', id: 's2', jobId: 'job-1' })).toMatchObject({ result: { state: 'downloading', downloadProgress: 0.5, downloadedBytes: 330825728 } });
    service.advance(2);
    expect(run(service, 'w1', { type: 'nzb.status', id: 's3', jobId: 'job-1' })).toMatchObject({ result: { state: 'processing', downloadProgress: 1, stage: 'Repairing', actions: ['cancel'] } });
    service.advance();
    expect(run(service, 'w1', { type: 'nzb.status', id: 's4', jobId: 'job-1' })).toMatchObject({ result: { state: 'processing', stage: 'Extracting' } });
    service.advance();
    expect(run(service, 'w1', { type: 'nzb.status', id: 's5', jobId: 'job-1' })).toEqual({ type: 'nzb.status.result', id: 's5', result: {
      jobId: 'job-1', downloaderId: 'native', name: 'debian-12.7.0-amd64-netinst.iso', state: 'completed', observedAt: 1_700_000_000, actions: ['forget', 'delete'], canReadFiles: true, downloadProgress: 1, downloadedBytes: 661651456, totalBytes: 661651456,
    } });
    const first = run(service, 'w1', { type: 'nzb.jobs', id: 'j1', request: { downloaderId: 'native', limit: 2 } }) as unknown as { result: { jobs: Array<{ jobId: string }>; next: string | null } };
    expect(first.result.jobs.map((job) => job.jobId)).toEqual(['job-1', 'job-2']);
    expect(first.result.next).toBe('job-2');
    expect(run(service, 'w1', { type: 'nzb.jobs', id: 'j2', request: { downloaderId: 'native', limit: 2, after: 'job-2' } })).toMatchObject({ result: { jobs: [{ jobId: 'job-3' }], next: null } });
    expect(run(service, 'w1', { type: 'nzb.jobs', id: 'j3', request: { downloaderId: 'remote' } })).toEqual({ type: 'nzb.jobs.result', id: 'j3', result: { jobs: [], next: null } });
    expect(run(service, 'w1', { type: 'nzb.jobs', id: 'j4', request: { downloaderId: 'native', limit: 101 } })).toMatchObject({ error: { code: 'limit_exceeded' } });
    expect(run(service, 'w1', { type: 'nzb.jobs', id: 'j5', request: { downloaderId: 'nope' } })).toMatchObject({ error: { code: 'not_found' } });
    expect(run(service, 'w2', { type: 'nzb.status', id: 's6', jobId: 'job-1' })).toEqual({ type: 'nzb.status.result', id: 's6', error: { code: 'not_found', message: 'Unknown job' } });
  });

  it('controls jobs with replay, applicability, and permission checks', () => {
    const service = createMockNzbService({ clock: CLOCK, deleteAuthorized: false });
    run(service, 'w1', { type: 'nzb.add', id: 'a', request: { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE } });
    run(service, 'w1', { type: 'nzb.add', id: 'b', request: { downloaderId: 'remote', operationKey: 'k', source: BYTES_SOURCE } });
    const paused = control(service, 'job-1', 'pause');
    expect(paused).toEqual({ type: 'nzb.control.result', id: 'c-pause-job-1', result: { jobId: 'job-1', action: 'pause', job: {
      jobId: 'job-1', downloaderId: 'native', name: 'debian-12.7.0-amd64-netinst.iso', state: 'paused', observedAt: 1_700_000_000, actions: ['resume', 'cancel'], canReadFiles: false, downloadPaused: true,
    }, replayUntil: REPLAY_UNTIL } });
    expect(control(service, 'job-1', 'pause')).toEqual({ ...paused });
    expect(run(service, 'w1', { type: 'nzb.control', id: 'x', request: { jobId: 'job-1', operationKey: 'pause-job-1', action: 'resume' } })).toMatchObject({ error: { code: 'conflict', replayUntil: REPLAY_UNTIL } });
    service.advance(3);
    expect(run(service, 'w1', { type: 'nzb.status', id: 's', jobId: 'job-1' })).toMatchObject({ result: { state: 'paused' } });
    expect(control(service, 'job-1', 'resume')).toMatchObject({ result: { action: 'resume', job: { state: 'queued', downloadPaused: false } } });
    expect(control(service, 'job-1', 'delete')).toEqual({ type: 'nzb.control.result', id: 'c-delete-job-1', error: { code: 'permission_denied', message: 'Deleting download data is not authorized' } });
    expect(control(service, 'job-1', 'forget')).toMatchObject({ error: { code: 'invalid_state', message: 'forget is not applicable while queued' } });
    expect(control(service, 'job-1', 'cancel')).toMatchObject({ result: { job: { state: 'cancelled', actions: ['retry', 'forget', 'delete'] } } });
    expect(control(service, 'job-1', 'retry')).toMatchObject({ result: { job: { state: 'queued', actions: ['pause', 'cancel'] } } });
    expect(control(service, 'job-2', 'cancel')).toMatchObject({ error: { code: 'unsupported', message: 'Downloader does not implement cancel' } });
    expect(control(service, 'job-2', 'explode')).toMatchObject({ error: { code: 'invalid_request' } });
    expect(run(service, 'w2', { type: 'nzb.control', id: 'z', request: { jobId: 'job-2', operationKey: 'z', action: 'pause' } })).toMatchObject({ error: { code: 'not_found' } });

    const native = createMockNzbService({ clock: CLOCK });
    run(native, 'w1', { type: 'nzb.add', id: 'a', request: { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE } });
    native.advance(8);
    expect(control(native, 'job-1', 'forget')).toEqual({ type: 'nzb.control.result', id: 'c-forget-job-1', result: { jobId: 'job-1', action: 'forget', replayUntil: REPLAY_UNTIL } });
    expect(run(native, 'w1', { type: 'nzb.status', id: 's', jobId: 'job-1' })).toMatchObject({ error: { code: 'not_found' } });
    expect(run(native, 'w1', { type: 'nzb.jobs', id: 'j', request: { downloaderId: 'native' } })).toMatchObject({ result: { jobs: [] } });
    expect(control(native, 'job-1', 'forget')).toMatchObject({ error: { code: 'not_found' } });
  });

  it('exposes completed output files and bounded reads on the native downloader', () => {
    const service = createMockNzbService({ clock: CLOCK });
    run(service, 'w1', { type: 'nzb.add', id: 'a', request: { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE } });
    run(service, 'w1', { type: 'nzb.add', id: 'b', request: { downloaderId: 'remote', operationKey: 'k', source: BYTES_SOURCE } });
    expect(run(service, 'w1', { type: 'nzb.files', id: 'f0', request: { jobId: 'job-1' } })).toEqual({ type: 'nzb.files.result', id: 'f0', error: { code: 'not_ready', message: 'Job output is still being produced' } });
    service.advance(8);
    expect(run(service, 'w1', { type: 'nzb.files', id: 'f1', request: { jobId: 'job-1' } })).toEqual({ type: 'nzb.files.result', id: 'f1', result: { files: [
      { fileId: 'job-1.f1', name: 'debian-12.7.0-amd64-netinst.iso', byteLength: 661651456, mediaType: 'application/x-iso9660-image' },
      { fileId: 'job-1.f2', name: 'SHA256SUMS', byteLength: 98, mediaType: 'text/plain' },
    ], next: null } });
    expect(run(service, 'w1', { type: 'nzb.files', id: 'f2', request: { jobId: 'job-1', limit: 1 } })).toMatchObject({ result: { files: [{ fileId: 'job-1.f1' }], next: 'job-1.f1' } });
    expect(run(service, 'w1', { type: 'nzb.files', id: 'f3', request: { jobId: 'job-2' } })).toEqual({ type: 'nzb.files.result', id: 'f3', error: { code: 'unsupported', message: 'Completed output is not exposed by this adapter' } });
    const read = (id: string, request: Record<string, unknown>) => run(service, 'w1', { type: 'nzb.read', id, request: { jobId: 'job-1', ...request } });
    expect(read('r1', { fileId: 'job-1.f2', offset: 0, length: 200 })).toEqual({ type: 'nzb.read.result', id: 'r1', result: {
      dataBase64: btoa(`${DEBIAN.sha256}  ${DEBIAN.fileName}\n`), byteLength: 98, eof: true,
    } });
    expect(read('r2', { fileId: 'job-1.f1', offset: 0, length: 4 })).toEqual({ type: 'nzb.read.result', id: 'r2', result: { dataBase64: 'UysuRQ==', byteLength: 4, eof: false } });
    expect(read('r3', { fileId: 'job-1.f2', offset: 98, length: 4 })).toEqual({ type: 'nzb.read.result', id: 'r3', result: { dataBase64: '', byteLength: 0, eof: true } });
    expect(read('r4', { fileId: 'job-1.f2', offset: 99, length: 4 })).toMatchObject({ error: { code: 'invalid_range' } });
    expect(read('r5', { fileId: 'job-1.f2', offset: 0, length: 0 })).toMatchObject({ error: { code: 'invalid_request' } });
    expect(read('r6', { fileId: 'job-1.f1', offset: 0, length: 65537 })).toMatchObject({ error: { code: 'limit_exceeded' } });
    expect(read('r7', { fileId: 'job-1.f9', offset: 0, length: 1 })).toMatchObject({ error: { code: 'not_found' } });
    expect(run(service, 'w1', { type: 'nzb.read', id: 'r8', request: { jobId: 'job-2', fileId: 'x', offset: 0, length: 1 } })).toMatchObject({ error: { code: 'unsupported' } });
  });

  it('keeps jobs across window teardown, runs autoplay, and resets', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const service = createMockNzbService({ clock: CLOCK, autoplay: true, tickMs: 5, scheduler: { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } } });
    run(service, 'w1', { type: 'nzb.add', id: 'a', request: { downloaderId: 'native', operationKey: 'k', source: URL_SOURCE } });
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().jobs.has('job-1')).toBe(true);
    expect(service.mock.state().replay.has('w1:native:k')).toBe(true);
    while (queued.length > 0) queued.shift()!();
    expect(run(service, 'w1', { type: 'nzb.status', id: 's', jobId: 'job-1' })).toMatchObject({ result: { state: 'completed' } });
    run(service, 'w1', { type: 'nzb.add', id: 'b', request: { downloaderId: 'native', operationKey: 'k2', source: URL_SOURCE } });
    expect(queued).toHaveLength(1);
    service.mock.reset();
    expect(cancelled).toBe(1);
    expect(service.mock.state().jobs.size).toBe(0);
    expect(service.mock.state().replay.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
