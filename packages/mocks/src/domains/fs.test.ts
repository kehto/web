import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_EPOCH_SECONDS } from '../fixtures/nostr.js';
import { encodeBase64, linuxDistroBytes, linuxDistroSums, utf8Bytes } from './file-bytes.js';
import { DEFAULT_FS_LIMITS, DEFAULT_FS_ROOTS, FS_MOCK_ENTRY, FS_SPEC_REF, createMockFsService } from './fs.js';

const debian = LINUX_DISTROS[0]!;
const ISO_DIR = '/downloads/iso';
const DEBIAN_PATH = `${ISO_DIR}/${debian.fileName}`;
const BASE = MOCK_EPOCH_SECONDS * 1000;
const clock = { now: () => BASE + 99_000 };
const ROUTES = ['fs.info', 'fs.pickFile', 'fs.pickFiles', 'fs.pickDirectory', 'fs.pickSaveFile', 'fs.stat', 'fs.list', 'fs.read', 'fs.write', 'fs.mkdir', 'fs.remove', 'fs.move', 'fs.watch', 'fs.unwatch'];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (message: NappletMessage) => { sent.push(message); } };
}

type Service = ReturnType<typeof createMockFsService>;

function call(service: Service, type: string, fields: Record<string, unknown>, windowId = 'w1', id = 'q1'): NappletMessage & Record<string, any> {
  const { sent, send } = sink();
  service.handleMessage(windowId, { type, id, ...fields } as NappletMessage, send);
  return sent[0] as NappletMessage & Record<string, any>;
}

describe('createMockFsService', () => {
  it('records the spec ref, descriptor, and registry entry', () => {
    const service = createMockFsService();
    expect(FS_SPEC_REF).toEqual({ nap: 'NAP-FS', status: 'draft', source: 'pr', pr: 88, sha: 'bd1b9e91', path: 'naps/NAP-FS.md' });
    expect(service.descriptor).toMatchObject({ name: 'fs', version: '1.0.0' });
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(ROUTES);
    expect(FS_MOCK_ENTRY).toMatchObject({ domain: 'fs', kind: 'service', spec: FS_SPEC_REF });
  });

  it('answers fs.info with curated roots and limits', () => {
    expect(call(createMockFsService({ limits: { maxWatchCount: 2 } }), 'fs.info', {})).toEqual({ type: 'fs.info.result', id: 'q1', info: { roots: [...DEFAULT_FS_ROOTS], limits: { ...DEFAULT_FS_LIMITS, maxWatchCount: 2 } } });
  });

  it('stats and lists the seeded catalog tree', () => {
    const service = createMockFsService();
    expect(call(service, 'fs.stat', { path: DEBIAN_PATH })).toEqual({
      type: 'fs.stat.result',
      id: 'q1',
      metadata: { path: DEBIAN_PATH, kind: 'file', size: 1024, revision: 'r1', modifiedAt: BASE, createdAt: BASE, permissions: ['read', 'write', 'create', 'delete', 'list', 'watch'] },
    });
    expect(call(service, 'fs.stat', { path: '/media' })).toMatchObject({ metadata: { path: '/media', kind: 'directory', permissions: ['read', 'list', 'watch'] } });
    const listed = call(service, 'fs.list', { path: ISO_DIR });
    expect(listed.entries).toHaveLength(9);
    expect(listed.entries[0]).toEqual({ name: debian.fileName, path: DEBIAN_PATH, kind: 'file', size: 1024, modifiedAt: BASE });
    expect(listed.entries.at(-1)).toEqual({ name: 'SHA256SUMS', path: `${ISO_DIR}/SHA256SUMS`, kind: 'file', size: linuxDistroSums(LINUX_DISTROS).length, modifiedAt: BASE + 9000 });
    expect(call(service, 'fs.list', { path: '/' })).toEqual({ type: 'fs.list.result', id: 'q1', error: 'not-found' });
    expect(call(service, 'fs.list', { path: DEBIAN_PATH })).toEqual({ type: 'fs.list.result', id: 'q1', error: 'not-a-directory' });
    expect(call(service, 'fs.stat', { path: '/downloads/../etc' })).toEqual({ type: 'fs.stat.result', id: 'q1', error: 'invalid-path' });
    expect(call(service, 'fs.stat', { path: 'downloads' })).toMatchObject({ error: 'invalid-path' });
    expect(call(service, 'fs.stat', { path: '/hidden/private.txt' })).toEqual({ type: 'fs.stat.result', id: 'q1', error: 'not-found' });
  });

  it('reads byte ranges as canonical base64', () => {
    const service = createMockFsService({ limits: { maxReadBytes: 512 } });
    const bytes = linuxDistroBytes(debian);
    expect(call(service, 'fs.read', { path: DEBIAN_PATH, options: { offset: 1000, length: 16 } })).toEqual({
      type: 'fs.read.result',
      id: 'q1',
      result: { data: encodeBase64(bytes.subarray(1000, 1016)), offset: 1000, bytesRead: 16, eof: false, size: 1024 },
    });
    expect(call(service, 'fs.read', { path: DEBIAN_PATH, options: { offset: 1016 } }).result).toEqual({ data: encodeBase64(bytes.subarray(1016)), offset: 1016, bytesRead: 8, eof: true, size: 1024 });
    expect(call(service, 'fs.read', { path: DEBIAN_PATH }).result).toMatchObject({ bytesRead: 512, eof: false });
    expect(call(service, 'fs.read', { path: DEBIAN_PATH, options: { length: 513 } })).toEqual({ type: 'fs.read.result', id: 'q1', error: 'too-large' });
    expect(call(service, 'fs.read', { path: ISO_DIR })).toEqual({ type: 'fs.read.result', id: 'q1', error: 'not-a-file' });
    expect(call(service, 'fs.read', { path: '/media/avatars/alice.png', options: { length: 8 } }).result.data).toBe('iVBORw0KGgo=');
  });

  it('writes in replace, append, and patch modes with revision preconditions', () => {
    const service = createMockFsService({ clock });
    const hello = encodeBase64(utf8Bytes('Hello world!'));
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: hello, options: { ifAbsent: true } })).toEqual({ type: 'fs.write.result', id: 'q1', result: { bytesWritten: 12, size: 12 } });
    expect(call(service, 'fs.stat', { path: '/downloads/note.txt' }).metadata).toMatchObject({ size: 12, revision: 'r101', createdAt: clock.now(), modifiedAt: clock.now() });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: hello, options: { ifAbsent: true } })).toEqual({ type: 'fs.write.result', id: 'q1', error: 'conflict' });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: 'AAECAw==', options: { mode: 'append', ifRevision: 'r101' } })).toEqual({ type: 'fs.write.result', id: 'q1', result: { bytesWritten: 4, size: 16 } });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: 'AAECAw==', options: { mode: 'append', ifRevision: 'r101' } })).toMatchObject({ error: 'conflict' });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: '/w==', options: { mode: 'patch', offset: 20 } })).toEqual({ type: 'fs.write.result', id: 'q1', result: { bytesWritten: 1, size: 21 } });
    expect(service.readFile('/downloads/note.txt')).toEqual(new Uint8Array([...utf8Bytes('Hello world!'), 0, 1, 2, 3, 0, 0, 0, 0, 255]));
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: 'AAECAw', options: { mode: 'replace' } })).toEqual({ type: 'fs.write.result', id: 'q1', error: 'invalid-data' });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: 'AAECAw==', options: { mode: 'replace', offset: 1 } })).toMatchObject({ error: 'invalid-data' });
    expect(call(service, 'fs.write', { path: '/downloads/note.txt', data: 'AAECAw==', options: { mode: 'patch' } })).toMatchObject({ error: 'invalid-data' });
    expect(call(service, 'fs.write', { path: '/media/new.txt', data: 'AAECAw==' })).toEqual({ type: 'fs.write.result', id: 'q1', error: 'permission-denied' });
    expect(call(service, 'fs.write', { path: '/downloads/nope/new.txt', data: 'AAECAw==' })).toMatchObject({ error: 'not-found' });
    expect(call(service, 'fs.write', { path: ISO_DIR, data: 'AAECAw==' })).toMatchObject({ error: 'not-a-file' });
    expect(call(createMockFsService({ limits: { maxWriteBytes: 2 } }), 'fs.write', { path: '/downloads/big', data: 'AAECAw==' })).toMatchObject({ error: 'too-large' });
  });

  it('creates, removes, and moves entries under policy', () => {
    const service = createMockFsService({ clock });
    expect(call(service, 'fs.mkdir', { path: '/downloads/projects/new', options: { recursive: true } })).toEqual({ type: 'fs.mkdir.result', id: 'q1' });
    expect(call(service, 'fs.mkdir', { path: '/downloads/projects/new' })).toEqual({ type: 'fs.mkdir.result', id: 'q1', error: 'already-exists' });
    expect(call(service, 'fs.mkdir', { path: '/downloads/missing/deep' })).toEqual({ type: 'fs.mkdir.result', id: 'q1', error: 'not-found' });
    expect(call(service, 'fs.mkdir', { path: `${DEBIAN_PATH}/child` })).toMatchObject({ error: 'not-a-directory' });
    expect(call(service, 'fs.mkdir', { path: '/media/x' })).toMatchObject({ error: 'permission-denied' });

    expect(call(service, 'fs.remove', { path: '/downloads/projects' })).toEqual({ type: 'fs.remove.result', id: 'q1', error: 'conflict' });
    expect(call(service, 'fs.remove', { path: '/downloads/projects', recursive: true })).toEqual({ type: 'fs.remove.result', id: 'q1' });
    expect(call(service, 'fs.remove', { path: '/downloads' })).toMatchObject({ error: 'policy-denied' });
    expect(call(service, 'fs.remove', { path: '/downloads/projects' })).toMatchObject({ error: 'not-found' });

    expect(call(service, 'fs.move', { fromPath: DEBIAN_PATH, toPath: '/downloads/debian.iso' })).toEqual({ type: 'fs.move.result', id: 'q1' });
    expect(call(service, 'fs.stat', { path: '/downloads/debian.iso' }).metadata).toMatchObject({ kind: 'file', size: 1024, revision: 'r1', modifiedAt: clock.now() });
    expect(call(service, 'fs.stat', { path: DEBIAN_PATH })).toMatchObject({ error: 'not-found' });
    expect(call(service, 'fs.move', { fromPath: '/downloads/debian.iso', toPath: `${ISO_DIR}/SHA256SUMS` })).toMatchObject({ error: 'already-exists' });
    expect(call(service, 'fs.move', { fromPath: '/downloads/debian.iso', toPath: '/media/debian.iso' })).toMatchObject({ error: 'unsupported' });
    expect(call(service, 'fs.move', { fromPath: ISO_DIR, toPath: `${ISO_DIR}/inner` })).toMatchObject({ error: 'conflict' });
    expect(call(service, 'fs.move', { fromPath: '/media/avatars/alice.png', toPath: '/media/alice.png' })).toMatchObject({ error: 'permission-denied' });
  });

  it('pushes fs.changed to covering watches and stops on unwatch', () => {
    const service = createMockFsService({ clock });
    const { sent, send } = sink();
    const from = (windowId: string, type: string, fields: Record<string, unknown>, id = 'q'): void => {
      service.handleMessage(windowId, { type, id, ...fields } as NappletMessage, send);
    };
    from('w1', 'fs.watch', { path: '/downloads', options: { recursive: true } }, 'x1');
    from('w1', 'fs.watch', { path: ISO_DIR }, 'x2');
    from('w2', 'fs.watch', { path: '/media' }, 'x3');
    from('w1', 'fs.watch', { path: '/downloads/missing' }, 'x4');
    expect(sent).toEqual([
      { type: 'fs.watch.result', id: 'x1', watchId: 'fs-watch-1' },
      { type: 'fs.watch.result', id: 'x2', watchId: 'fs-watch-2' },
      { type: 'fs.watch.result', id: 'x3', watchId: 'fs-watch-3' },
      { type: 'fs.watch.result', id: 'x4', error: 'not-found' },
    ]);

    from('w9', 'fs.write', { path: `${ISO_DIR}/note.txt`, data: 'AAECAw==' });
    expect(sent.slice(4)).toEqual([
      { type: 'fs.changed', change: { watchId: 'fs-watch-1', path: `${ISO_DIR}/note.txt`, kind: 'created' } },
      { type: 'fs.changed', change: { watchId: 'fs-watch-2', path: `${ISO_DIR}/note.txt`, kind: 'created' } },
      { type: 'fs.write.result', id: 'q', result: { bytesWritten: 4, size: 4 } },
    ]);
    from('w9', 'fs.move', { fromPath: `${ISO_DIR}/note.txt`, toPath: '/downloads/note.txt' });
    expect(sent.slice(7)).toEqual([
      { type: 'fs.changed', change: { watchId: 'fs-watch-1', path: '/downloads/note.txt', kind: 'moved', fromPath: `${ISO_DIR}/note.txt` } },
      { type: 'fs.changed', change: { watchId: 'fs-watch-2', path: '/downloads/note.txt', kind: 'moved', fromPath: `${ISO_DIR}/note.txt` } },
      { type: 'fs.move.result', id: 'q' },
    ]);
    expect(service.writeFile('/downloads/note.txt', utf8Bytes('host'))).toBe(true);
    expect(sent[10]).toEqual({ type: 'fs.changed', change: { watchId: 'fs-watch-1', path: '/downloads/note.txt', kind: 'modified' } });

    from('w2', 'fs.unwatch', { watchId: 'fs-watch-1' });
    expect(service.mock.state().watches.has('fs-watch-1')).toBe(true);
    from('w1', 'fs.unwatch', { watchId: 'fs-watch-1' });
    from('w1', 'fs.unwatch', { watchId: 'fs-watch-1' });
    expect(sent.slice(11)).toEqual([{ type: 'fs.unwatch.result', id: 'q' }, { type: 'fs.unwatch.result', id: 'q' }, { type: 'fs.unwatch.result', id: 'q' }]);
    from('w9', 'fs.remove', { path: '/downloads/note.txt' });
    expect(sent.slice(14)).toEqual([{ type: 'fs.remove.result', id: 'q' }]);

    const limited = createMockFsService({ limits: { maxWatchCount: 1 } });
    call(limited, 'fs.watch', { path: '/downloads' });
    expect(call(limited, 'fs.watch', { path: '/downloads' })).toMatchObject({ error: 'quota-exceeded' });
  });

  it('auto-resolves pickers to seeded choices and honors scripted picks', () => {
    const service = createMockFsService();
    expect(call(service, 'fs.pickFile', { options: { accept: [{ extension: '.iso' }] } })).toEqual({
      type: 'fs.pickFile.result',
      id: 'q1',
      result: { entries: [{ path: DEBIAN_PATH, kind: 'file', name: debian.fileName, permissions: ['read'], size: 1024, modifiedAt: BASE }] },
    });
    const many = call(service, 'fs.pickFiles', { options: { permissions: ['read', 'watch'] } });
    expect(many.result.entries).toHaveLength(8);
    expect(many.result.entries[1]).toMatchObject({ path: `${ISO_DIR}/${LINUX_DISTROS[1]!.fileName}`, permissions: ['read', 'watch'] });
    expect(call(service, 'fs.pickDirectory', {})).toEqual({ type: 'fs.pickDirectory.result', id: 'q1', result: { entries: [{ path: ISO_DIR, kind: 'directory', name: 'iso', permissions: ['read', 'list'], modifiedAt: BASE }] } });
    expect(call(service, 'fs.pickSaveFile', { options: { suggestedName: 'export.json' } })).toEqual({ type: 'fs.pickSaveFile.result', id: 'q1', result: { entries: [{ path: '/downloads/export.json', kind: 'file', name: 'export.json', permissions: ['write', 'create'] }] } });
    expect(call(service, 'fs.pickSaveFile', { options: { suggestedName: '../evil' } }).result.entries[0].path).toBe('/downloads/export.bin');
    service.setNextPick('cancelled');
    expect(call(service, 'fs.pickFile', {})).toEqual({ type: 'fs.pickFile.result', id: 'q1', error: 'cancelled' });
    service.setNextPick({ entries: [{ path: '/downloads/README.txt', kind: 'file', name: 'README.txt', permissions: ['read'] }] });
    expect(call(service, 'fs.pickFile', {}).result.entries[0].path).toBe('/downloads/README.txt');
  });

  it('drops watches on window destroy and capability revocation, and resets the tree', () => {
    const service = createMockFsService();
    call(service, 'fs.watch', { path: '/downloads' }, 'w1');
    call(service, 'fs.watch', { path: '/downloads' }, 'w2');
    call(service, 'fs.watch', { path: '/media' }, 'w3');
    service.onWindowDestroyed?.('w1');
    expect([...service.mock.state().watches.keys()]).toEqual(['fs-watch-2', 'fs-watch-3']);
    service.onCapabilityRevoked?.('w2', 'fs:write');
    expect(service.mock.state().watches.has('fs-watch-2')).toBe(true);
    service.onCapabilityRevoked?.('w2', 'fs:read');
    expect(service.mock.state().watches.has('fs-watch-2')).toBe(false);
    service.onCapabilityRevoked?.('w3', null);
    expect(service.mock.state().watches.size).toBe(0);

    call(service, 'fs.remove', { path: ISO_DIR, recursive: true });
    expect(call(service, 'fs.stat', { path: DEBIAN_PATH })).toMatchObject({ error: 'not-found' });
    service.mock.reset();
    expect(service.mock.sent).toEqual([]);
    expect(service.mock.state().counters).toEqual({ watch: 0, revision: 0 });
    expect(call(service, 'fs.stat', { path: DEBIAN_PATH }).metadata).toMatchObject({ size: 1024, revision: 'r1' });
  });
});
