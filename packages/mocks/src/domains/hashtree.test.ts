import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { mockHex } from '../core/rng.js';
import type { MockScheduler } from '../core/types.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_RELAY_URLS } from '../fixtures/nostr.js';
import { linuxDistroBytes, linuxDistroSums, placeholderSha256, utf8Bytes } from './file-bytes.js';
import {
  MOCK_HASHTREE_AUTHOR,
  MOCK_HASHTREE_AUTHOR_NPUB,
  MOCK_HASHTREE_NODES,
  MOCK_HASHTREE_ROOT_EVENT,
  MOCK_HASHTREE_ROOT_HASH,
  encodeNhash,
} from './hashtree-fixtures.js';
import { HASHTREE_MOCK_ENTRY, HASHTREE_SPEC_REF, createMockHashtreeService, parseHashtreeRef } from './hashtree.js';

const ROOT_REF = `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/distros`;
const debian = LINUX_DISTROS[0]!;
const SUMS_HASH = mockHex('htree:file:SHA256SUMS');
const clock = { now: () => 1_767_225_600_000 };
const ROUTES = ['hashtree.capabilities', 'hashtree.parseRef', 'hashtree.resolve', 'hashtree.stat', 'hashtree.list', 'hashtree.read', 'hashtree.putBytes', 'hashtree.putTree', 'hashtree.publishRoot', 'hashtree.pickFiles', 'hashtree.importFiles', 'hashtree.exportFiles', 'hashtree.pins', 'hashtree.pin', 'hashtree.unpin', 'hashtree.job', 'hashtree.cancel'];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

type Service = ReturnType<typeof createMockHashtreeService>;

function call(service: Service, type: string, fields: Record<string, unknown>, windowId = 'w1', id = 'q1'): NappletMessage & Record<string, any> {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type, id, ...fields } as NappletMessage, send);
  return sent[0] as NappletMessage & Record<string, any>;
}

const seededRoot = {
  cid: { hash: MOCK_HASHTREE_ROOT_HASH, nhash: encodeNhash(MOCK_HASHTREE_ROOT_HASH) },
  ref: { kind: 'htree', ref: ROOT_REF, identifier: MOCK_HASHTREE_AUTHOR_NPUB, treePath: 'distros', entryPath: '' },
  rootResult: { event: MOCK_HASHTREE_ROOT_EVENT },
  eventId: MOCK_HASHTREE_ROOT_EVENT.id,
  author: MOCK_HASHTREE_AUTHOR,
  treeName: 'distros',
  visibility: 'unencrypted',
};

describe('createMockHashtreeService', () => {
  it('records the spec ref, descriptor, routes, and extension capabilities', () => {
    const service = createMockHashtreeService();
    expect(HASHTREE_SPEC_REF).toEqual({ nap: 'NAP-HASHTREE', status: 'draft', source: 'pr', pr: 73, sha: '67997706', path: 'naps/NAP-HASHTREE.md' });
    expect(service.descriptor).toMatchObject({ name: 'hashtree', version: '1.0.0' });
    expect(service.mock.routes).toEqual(ROUTES);
    expect(Object.keys(service.messageCapabilities!)).toEqual(ROUTES);
    expect(HASHTREE_MOCK_ENTRY).toMatchObject({ domain: 'hashtree', kind: 'extension', spec: HASHTREE_SPEC_REF });
    expect(call(service, 'hashtree.capabilities', {})).toMatchObject({ type: 'hashtree.capabilities.result', id: 'q1', capabilities: { canReadImmutable: true, canPublishRoots: true, maxReadBytes: 1048576 } });
  });

  it('parses every reference form without fetching', () => {
    const nhash = encodeNhash(debian.sha256);
    expect(parseHashtreeRef(nhash)).toEqual({ kind: 'nhash', ref: nhash, cid: { hash: debian.sha256, nhash } });
    expect(parseHashtreeRef(`hashtree:${nhash}`)?.cid).toEqual({ hash: debian.sha256, nhash });
    expect(parseHashtreeRef(`${debian.sha256}:${'a'.repeat(64)}`)).toEqual({ kind: 'cid', ref: `${debian.sha256}:${'a'.repeat(64)}`, cid: { hash: debian.sha256, key: 'a'.repeat(64), nhash: encodeNhash(debian.sha256, 'a'.repeat(64)) } });
    expect(parseHashtreeRef(`${ROOT_REF}/SHA256SUMS#k=${'b'.repeat(64)}`)).toEqual({ kind: 'htree', ref: `${ROOT_REF}/SHA256SUMS#k=${'b'.repeat(64)}`, identifier: MOCK_HASHTREE_AUTHOR_NPUB, treePath: 'distros', entryPath: 'SHA256SUMS', visibility: 'link-visible', shareSecret: 'b'.repeat(64) });
    expect(parseHashtreeRef(`${MOCK_HASHTREE_AUTHOR_NPUB}/distros/${debian.id}`)).toEqual({ kind: 'npub-path', ref: `${MOCK_HASHTREE_AUTHOR_NPUB}/distros/${debian.id}`, identifier: MOCK_HASHTREE_AUTHOR_NPUB, treePath: 'distros', entryPath: debian.id });
    expect(parseHashtreeRef('htree://x/y?z')).toBeNull();
    const service = createMockHashtreeService();
    expect(call(service, 'hashtree.parseRef', { ref: 'nope' })).toEqual({ type: 'hashtree.parseRef.result', id: 'q1', result: { ok: false, error: 'invalid-ref' } });
    expect(call(service, 'hashtree.parseRef', { ref: nhash })).toEqual({ type: 'hashtree.parseRef.result', id: 'q1', result: { ok: true, ref: parseHashtreeRef(nhash) } });
  });

  it('resolves, stats, lists, and reads the seeded mutable root', () => {
    const service = createMockHashtreeService();
    expect(call(service, 'hashtree.resolve', { ref: ROOT_REF })).toEqual({ type: 'hashtree.resolve.result', id: 'q1', result: { ok: true, root: seededRoot } });
    expect(call(service, 'hashtree.resolve', { ref: `htree://${MOCK_HASHTREE_AUTHOR}/missing` })).toEqual({ type: 'hashtree.resolve.result', id: 'q1', result: { ok: false, error: 'not-found' } });
    expect(call(service, 'hashtree.stat', { ref: `${ROOT_REF}/SHA256SUMS` })).toEqual({
      type: 'hashtree.stat.result',
      id: 'q1',
      result: { ok: true, entry: { path: 'SHA256SUMS', type: 'file', cid: { hash: SUMS_HASH, nhash: encodeNhash(SUMS_HASH) }, name: 'SHA256SUMS', size: linuxDistroSums(LINUX_DISTROS).length, mime: 'text/plain' } },
    });
    const listed = call(service, 'hashtree.list', { ref: ROOT_REF });
    expect(listed.result.ok).toBe(true);
    expect(listed.result.entries.map((entry: { path: string; type: string }) => [entry.path, entry.type])).toEqual([
      ['SHA256SUMS', 'file'],
      ...[...LINUX_DISTROS].map((image) => image.id).sort().map((id) => [id, 'dir']),
    ]);
    expect(listed.result.root).toEqual(seededRoot);
    const recursive = call(service, 'hashtree.list', { ref: ROOT_REF, options: { recursive: true, limit: 3 } });
    expect(recursive.result.entries.map((entry: { path: string }) => entry.path)).toEqual(['SHA256SUMS', 'alpine-3-20-standard', 'alpine-3-20-standard/alpine-standard-3.20.3-x86_64.iso']);
    expect(recursive.result.truncated).toBe(true);
    expect(call(service, 'hashtree.list', { ref: `${ROOT_REF}/SHA256SUMS` })).toMatchObject({ result: { ok: false, entries: [], error: 'not-directory' } });

    const read = call(service, 'hashtree.read', { ref: `${ROOT_REF}/${debian.id}/${debian.fileName}`, options: { offset: 0, length: 8 } });
    expect(new Uint8Array(read.result.blob)).toEqual(linuxDistroBytes(debian).slice(0, 8));
    expect(read.result.entry).toMatchObject({ path: `${debian.id}/${debian.fileName}`, type: 'file', cid: { hash: debian.sha256 }, size: 1024, mime: 'application/x-iso9660-image' });
    expect(call(service, 'hashtree.read', { ref: ROOT_REF })).toMatchObject({ result: { ok: false, error: 'is-directory' } });
    expect(call(service, 'hashtree.read', { ref: encodeNhash(debian.sha256), options: { length: 2_000_000 } })).toMatchObject({ result: { ok: false, error: 'too-large' } });
    expect(call(service, 'hashtree.read', { ref: 'garbage' })).toMatchObject({ result: { ok: false, error: 'invalid-ref' } });
  });

  it('stores bytes and trees, then publishes and resolves a new root', () => {
    const service = createMockHashtreeService({ clock });
    const note = utf8Bytes('debian netinst verified\n');
    const hash = placeholderSha256(note);
    const put = call(service, 'hashtree.putBytes', { request: { data: note, options: { filename: 'note.txt', mime: 'text/plain', pin: true } } });
    expect(put).toEqual({
      type: 'hashtree.putBytes.result',
      id: 'q1',
      result: { ok: true, cid: { hash, key: mockHex(`chk:${hash}`), nhash: encodeNhash(hash, mockHex(`chk:${hash}`)) }, entry: { path: 'note.txt', type: 'file', cid: { hash, key: mockHex(`chk:${hash}`), nhash: encodeNhash(hash, mockHex(`chk:${hash}`)) }, name: 'note.txt', size: note.length, mime: 'text/plain' }, size: note.length },
    });
    expect(call(service, 'hashtree.pins', {}).pins).toEqual([{ ref: put.result.cid.nhash, cid: put.result.cid, bytesStored: note.length, createdAt: 1_767_225_600 }]);
    expect(call(service, 'hashtree.putBytes', { request: { data: 42 } })).toMatchObject({ result: { ok: false, error: 'invalid-request' } });

    const tree = call(service, 'hashtree.putTree', { request: { entries: [{ path: 'notes/note.txt', cid: { hash } }, { path: 'README', data: utf8Bytes('hi'), mime: 'text/plain' }], options: { visibility: 'unencrypted' } } });
    expect(tree.result.ok).toBe(true);
    expect(tree.result.size).toBe(note.length + 2);
    expect(tree.result.cid).toEqual({ hash: tree.result.cid.hash, nhash: encodeNhash(tree.result.cid.hash) });
    expect(call(service, 'hashtree.list', { ref: tree.result.cid.nhash, options: { recursive: true } }).result.entries.map((entry: { path: string }) => entry.path)).toEqual(['README', 'notes', 'notes/note.txt']);
    expect(call(service, 'hashtree.putTree', { request: { entries: [{ path: '../x', data: note }] } })).toMatchObject({ result: { ok: false, error: 'invalid-path' } });
    expect(call(service, 'hashtree.putTree', { request: { entries: [{ path: 'x', cid: { hash: '0'.repeat(64) } }] } })).toMatchObject({ result: { ok: false, error: 'not-found' } });

    const published = call(service, 'hashtree.publishRoot', { request: { cid: tree.result.cid, treeName: 'notes', visibility: 'unencrypted', relays: [MOCK_RELAY_URLS[0]] } });
    expect(published.result).toMatchObject({ ok: true, ref: `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/notes`, relays: { [MOCK_RELAY_URLS[0]!]: true } });
    expect(published.result.event).toMatchObject({ kind: 30064, pubkey: MOCK_HASHTREE_AUTHOR, created_at: 1_767_225_600, tags: [['d', 'notes'], ['l', 'hashtree'], ['hash', tree.result.cid.hash], ['visibility', 'unencrypted']] });
    expect(published.result.eventId).toBe(published.result.event.id);
    expect(call(service, 'hashtree.resolve', { ref: `${MOCK_HASHTREE_AUTHOR_NPUB}/notes` }).result.root).toMatchObject({ cid: tree.result.cid, treeName: 'notes', eventId: published.result.eventId });
    expect(call(service, 'hashtree.read', { ref: `${published.result.ref}/notes/note.txt` }).result.entry.cid.hash).toBe(hash);

    const secret = call(service, 'hashtree.publishRoot', { request: { cid: tree.result.cid, treeName: 'shared', visibility: 'link-visible' } });
    expect(secret.result.ref).toBe(`htree://${MOCK_HASHTREE_AUTHOR_NPUB}/shared#k=${mockHex('share:shared')}`);
    expect(call(service, 'hashtree.resolve', { ref: `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/shared` })).toMatchObject({ result: { ok: false, error: 'missing-key' } });
    expect(call(service, 'hashtree.resolve', { ref: secret.result.ref }).result.ok).toBe(true);
    expect(call(service, 'hashtree.publishRoot', { request: { cid: { hash: '0'.repeat(64) }, treeName: 'x' } })).toMatchObject({ result: { ok: false, error: 'not-found' } });
    expect(call(createMockHashtreeService({ signedIn: false }), 'hashtree.publishRoot', { request: { cid: tree.result.cid, treeName: 'x' } })).toMatchObject({ result: { ok: false, error: 'not-signed-in' } });
  });

  it('picks files, runs import/export jobs through advance(), and pushes progress/done', () => {
    const service = createMockHashtreeService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'hashtree.pickFiles', id: 'f1', options: { directory: true } } as NappletMessage, send);
    const fileSet = (sent[0] as NappletMessage & { result: { fileSet: { runtimeFileSetId: string; files: unknown[]; totalBytes: number; displayName: string } } }).result.fileSet;
    expect(fileSet).toMatchObject({ runtimeFileSetId: 'fs-1', totalBytes: 8 * 1024, displayName: 'distros' });
    expect(fileSet.files).toHaveLength(8);

    service.handleMessage('w1', { type: 'hashtree.importFiles', id: 'i1', request: { runtimeFileSetId: 'fs-1', visibility: 'unencrypted', pin: true, publish: { treeName: 'mirror' } } } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'hashtree.importFiles.result', id: 'i1', ack: { ok: true, jobId: 'ht-1', state: 'queued' } });
    expect(service.advance()).toBe(true);
    expect(sent[2]).toEqual({ type: 'hashtree.progress', jobId: 'ht-1', status: { ok: true, jobId: 'ht-1', kind: 'import', state: 'running', processedBytes: 4096, totalBytes: 8192, progress: 0.5 } });
    expect(service.advance('ht-1')).toBe(true);
    expect(sent[3]).toEqual({ type: 'hashtree.done', jobId: 'ht-1', status: { ok: true, jobId: 'ht-1', kind: 'import', state: 'complete', processedBytes: 8192, totalBytes: 8192, progress: 1, cid: { hash: MOCK_HASHTREE_ROOT_HASH, nhash: encodeNhash(MOCK_HASHTREE_ROOT_HASH) }, ref: `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/mirror` } });
    expect(service.advance()).toBe(false);
    expect(call(service, 'hashtree.job', { jobId: 'ht-1' })).toEqual({ type: 'hashtree.job.result', id: 'q1', status: (sent[3] as NappletMessage & { status: unknown }).status });
    expect(call(service, 'hashtree.pins', {}).pins[0]).toMatchObject({ ref: encodeNhash(MOCK_HASHTREE_ROOT_HASH), bytesStored: 8192 });
    expect(call(service, 'hashtree.resolve', { ref: `htree://${MOCK_HASHTREE_AUTHOR_NPUB}/mirror` }).result.root.cid.hash).toBe(MOCK_HASHTREE_ROOT_HASH);

    service.handleMessage('w1', { type: 'hashtree.exportFiles', id: 'e1', request: { ref: `${ROOT_REF}/SHA256SUMS`, destination: 'temporary' } } as NappletMessage, send);
    expect(sent[4]).toEqual({ type: 'hashtree.exportFiles.result', id: 'e1', ack: { ok: true, jobId: 'ht-2', state: 'queued' } });
    expect(call(service, 'hashtree.cancel', { jobId: 'ht-2' })).toMatchObject({ type: 'hashtree.cancel.result', status: { jobId: 'ht-2', kind: 'export', state: 'cancelled' } });
    expect(service.advance('ht-2')).toBe(false);
    expect(call(service, 'hashtree.job', { jobId: 'ht-2' }, 'w2')).toEqual({ type: 'hashtree.job.result', id: 'q1', error: 'job-not-found' });
    expect(call(service, 'hashtree.importFiles', { request: { runtimeFileSetId: 'fs-1' } }, 'w2')).toEqual({ type: 'hashtree.importFiles.result', id: 'q1', ack: { ok: false, error: 'not-found' } });

    service.setNextPick('cancel');
    expect(call(service, 'hashtree.pickFiles', {})).toEqual({ type: 'hashtree.pickFiles.result', id: 'q1', result: { ok: false, error: 'file-pick-cancelled' } });
    expect(call(service, 'hashtree.pickFiles', {}).result.fileSet).toMatchObject({ runtimeFileSetId: 'fs-3', displayName: debian.fileName, totalBytes: 1024 });
  });

  it('fails jobs with hashtree.error and auto-advances through the scheduler', () => {
    const queued: Array<() => void> = [];
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { queued.splice(queued.indexOf(fn), 1); }; } };
    const service = createMockHashtreeService({ autoAdvanceMs: 10, scheduler, jobSteps: 1 });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'hashtree.pickFiles', id: 'f1' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'hashtree.exportFiles', id: 'e1', request: { ref: encodeNhash(debian.sha256) } } as NappletMessage, send);
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent[2]).toMatchObject({ type: 'hashtree.done', jobId: 'ht-1', status: { state: 'complete', runtimeFileSetId: 'fs-2', cid: { hash: debian.sha256 } } });

    service.handleMessage('w1', { type: 'hashtree.exportFiles', id: 'e2', request: { ref: encodeNhash(debian.sha256) } } as NappletMessage, send);
    expect(service.failJob('ht-2', 'fetch-failed')).toBe(true);
    expect(queued).toHaveLength(0);
    expect(sent[4]).toEqual({ type: 'hashtree.error', jobId: 'ht-2', error: 'fetch-failed' });
    expect(service.failJob('ht-2')).toBe(false);
  });

  it('pins and unpins refs', () => {
    const service = createMockHashtreeService({ clock });
    expect(call(service, 'hashtree.pin', { request: { ref: ROOT_REF, label: 'distros' } })).toEqual({ type: 'hashtree.pin.result', id: 'q1', result: { ok: true, pin: { ref: ROOT_REF, cid: seededRoot.cid, label: 'distros', bytesStored: 0, createdAt: 1_767_225_600 } } });
    expect(call(service, 'hashtree.pin', { request: { ref: 'junk' } })).toMatchObject({ result: { ok: false, error: 'invalid-ref' } });
    expect(call(service, 'hashtree.unpin', { ref: ROOT_REF })).toMatchObject({ result: { ok: true, pin: { ref: ROOT_REF } } });
    expect(call(service, 'hashtree.unpin', { ref: ROOT_REF })).toEqual({ type: 'hashtree.unpin.result', id: 'q1', result: { ok: false, error: 'not-found' } });
  });

  it('cleans jobs and file sets on window destroy and resets to the seeded tree', () => {
    const queued: Array<() => void> = [];
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { queued.splice(queued.indexOf(fn), 1); }; } };
    const service = createMockHashtreeService({ autoAdvanceMs: 10, scheduler });
    call(service, 'hashtree.pickFiles', {}, 'w1');
    call(service, 'hashtree.importFiles', { request: { runtimeFileSetId: 'fs-1' } }, 'w1');
    expect(queued).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    expect(queued).toHaveLength(0);
    expect(service.mock.state().jobs.size).toBe(0);
    expect(service.mock.state().fileSets.size).toBe(0);

    call(service, 'hashtree.putBytes', { request: { data: new Uint8Array([1]) } });
    call(service, 'hashtree.pickFiles', {});
    call(service, 'hashtree.importFiles', { request: { runtimeFileSetId: 'fs-2' } });
    service.mock.reset();
    expect(queued).toHaveLength(0);
    expect(service.mock.state().nodes.size).toBe(MOCK_HASHTREE_NODES.size);
    expect(service.mock.state().roots.size).toBe(1);
    expect(service.mock.state().jobs.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });
});
