import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import {
  createFsService,
  FsServiceError,
  type FsBackend,
  type FsBackendChange,
} from './index.js';

function backendFixture(overrides: Partial<FsBackend> = {}): FsBackend {
  return {
    info: () => ({ roots: [], limits: { maxReadBytes: 8, maxWriteBytes: 8 } }),
    pickFile: () => ({ entries: [] }),
    pickFiles: () => ({ entries: [] }),
    pickDirectory: () => ({ entries: [] }),
    pickSaveFile: () => ({ entries: [] }),
    stat: (_windowId, path) => ({ path, kind: 'file' }),
    list: () => [],
    read: () => ({ data: '', offset: 0, bytesRead: 0, eof: true }),
    write: () => ({ bytesWritten: 0 }),
    mkdir: () => undefined,
    remove: () => undefined,
    move: () => undefined,
    watch: () => ({ close() {} }),
    ...overrides,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timed out');
}

describe('createFsService', () => {
  it('validates paths before prompting or invoking the filesystem backend', async () => {
    const read = vi.fn(() => ({ data: '', offset: 0, bytesRead: 0, eof: true }));
    const service = createFsService({ backend: backendFixture({ read }) });
    const authorizeOperation = vi.fn();
    service.onRegistered?.({ authorizeOperation } as never);
    const sent: NappletMessage[] = [];

    service.handleMessage('window-a', { type: 'fs.read', id: 'bad', path: '/workspace/../secret' } as NappletMessage, (message) => sent.push(message));

    expect(authorizeOperation).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'fs.read.result', id: 'bad', error: 'invalid-path' }]);
  });

  it('authorizes the picker and the picked exact path as separate operations', async () => {
    const pickFile = vi.fn(() => ({ entries: [{ path: '/picked-private', kind: 'file' as const, name: 'private.txt', permissions: ['read' as const] }] }));
    const read = vi.fn(() => ({ data: 'Ynl0ZXM=', offset: 0, bytesRead: 5, eof: true }));
    const service = createFsService({ backend: backendFixture({ pickFile, read }) });
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute) => ({ status: 'executed' as const, value: await execute(signal) }));
    service.onRegistered?.({ authorizeOperation } as never);
    const sent: NappletMessage[] = [];

    service.handleMessage('window-a', { type: 'fs.pickFile', id: 'pick' } as NappletMessage, (message) => sent.push(message));
    await waitFor(() => sent.length === 1);
    service.handleMessage('window-a', { type: 'fs.read', id: 'read', path: '/picked-private' } as NappletMessage, (message) => sent.push(message));
    await waitFor(() => sent.length === 2);

    expect(pickFile).toHaveBeenCalledWith('window-a', undefined, signal);
    expect(read).toHaveBeenCalledWith('window-a', '/picked-private', undefined, signal);
    expect(authorizeOperation.mock.calls[0]![2]).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'fs.pickFile', scope: { kind: 'exact', value: 'picker:pickFile' } }),
    ]));
    expect(authorizeOperation.mock.calls[1]![2]).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'fs.read', scope: { kind: 'exact', value: '/picked-private' } }),
    ]));
  });

  it('requires both move endpoints and closes revoked watches without late changes', async () => {
    let push: ((change: FsBackendChange) => void) | undefined;
    const close = vi.fn();
    const service = createFsService({ backend: backendFixture({
      watch: (_windowId, _path, _options, onChange) => { push = onChange; return { close }; },
    }) });
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    const authorizeOperation = vi.fn(async (_windowId, _operation, _requirements, execute) => ({ status: 'executed' as const, value: await execute(signal) }));
    service.onRegistered?.({ authorizeOperation } as never);
    const sent: NappletMessage[] = [];

    service.handleMessage('window-a', { type: 'fs.move', id: 'move', fromPath: '/workspace/a', toPath: '/workspace/private/b' } as NappletMessage, (message) => sent.push(message));
    await waitFor(() => sent.length === 1);
    expect(authorizeOperation.mock.calls[0]![2]).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: { kind: 'exact', value: '/workspace/a' } }),
      expect.objectContaining({ scope: { kind: 'directory', value: '/workspace/private' } }),
    ]));

    service.handleMessage('window-a', { type: 'fs.watch', id: 'watch', path: '/workspace' } as NappletMessage, (message) => sent.push(message));
    await waitFor(() => sent.length === 2);
    service.onPermissionRevoked?.('window-a');
    push?.({ path: '/workspace/late.txt', kind: 'modified' });
    expect(close).toHaveBeenCalledOnce();
    expect(sent).toHaveLength(2);
  });

  it('returns one same-id success envelope with the operation field', async () => {
    const service = createFsService({ backend: backendFixture() });
    const sent: NappletMessage[] = [];

    service.handleMessage('window-a', { type: 'fs.info', id: 'info-1' } as NappletMessage, (message) => sent.push(message));

    await waitFor(() => sent.length === 1);
    expect(sent).toEqual([{
      type: 'fs.info.result',
      id: 'info-1',
      info: { roots: [], limits: { maxReadBytes: 8, maxWriteBytes: 8 } },
    }]);
  });

  it('normalizes backend failures to error-only closed FS results', async () => {
    const service = createFsService({
      backend: backendFixture({ write: () => { throw new FsServiceError('conflict'); } }),
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'fs.write', id: 'write-1', path: '/workspace/a', data: '' } as NappletMessage,
      (message) => sent.push(message),
    );

    await waitFor(() => sent.length === 1);
    expect(sent).toEqual([{ type: 'fs.write.result', id: 'write-1', error: 'conflict' }]);
    expect(sent[0]).not.toHaveProperty('result');
  });

  it('scopes watch ids and pushed changes to the requesting window', async () => {
    let push: ((change: FsBackendChange) => void) | undefined;
    const close = vi.fn();
    const service = createFsService({
      backend: backendFixture({
        watch: (_windowId, _path, _options, onChange) => {
          push = onChange;
          return { close };
        },
      }),
    });
    const owner: NappletMessage[] = [];
    const other: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'fs.watch', id: 'watch-1', path: '/workspace' } as NappletMessage,
      (message) => owner.push(message),
    );
    await waitFor(() => owner.length === 1);
    const watchId = (owner[0] as NappletMessage & { watchId: string }).watchId;
    push?.({ path: '/workspace/a.txt', kind: 'modified' });
    service.handleMessage(
      'window-b',
      { type: 'fs.unwatch', id: 'foreign', watchId } as NappletMessage,
      (message) => other.push(message),
    );

    expect(owner[1]).toEqual({
      type: 'fs.changed',
      change: { watchId, path: '/workspace/a.txt', kind: 'modified' },
    });
    expect(owner[1]).not.toHaveProperty('id');
    expect(other).toEqual([{ type: 'fs.unwatch.result', id: 'foreign' }]);
    expect(close).not.toHaveBeenCalled();

    service.onWindowDestroyed?.('window-a');
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes a watch that resolves after its window is destroyed', async () => {
    let resolveWatch: ((watch: { close(): void }) => void) | undefined;
    let push: ((change: FsBackendChange) => void) | undefined;
    const close = vi.fn();
    const service = createFsService({
      backend: backendFixture({
        watch: (_windowId, _path, _options, onChange) => {
          push = onChange;
          return new Promise((resolve) => { resolveWatch = resolve; });
        },
      }),
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'fs.watch', id: 'watch-late', path: '/workspace' } as NappletMessage,
      (message) => sent.push(message),
    );
    await waitFor(() => resolveWatch !== undefined);
    service.onWindowDestroyed?.('window-a');
    resolveWatch?.({ close });
    await new Promise((resolve) => setTimeout(resolve, 0));
    push?.({ path: '/workspace/late.txt', kind: 'modified' });

    expect(close).toHaveBeenCalledOnce();
    expect(sent).toEqual([]);
  });

  it('does not emit a synchronous backend change before the watch is owned', async () => {
    let push: ((change: FsBackendChange) => void) | undefined;
    const service = createFsService({
      backend: backendFixture({
        watch: (_windowId, _path, _options, onChange) => {
          onChange({ path: '/workspace/initial.txt', kind: 'modified' });
          push = onChange;
          return { close() {} };
        },
      }),
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'fs.watch', id: 'watch-sync', path: '/workspace' } as NappletMessage,
      (message) => sent.push(message),
    );
    await waitFor(() => sent.length === 1);
    push?.({ path: '/workspace/live.txt', kind: 'modified' });

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ type: 'fs.watch.result', id: 'watch-sync', watchId: expect.any(String) });
    expect(sent[1]).toMatchObject({
      type: 'fs.changed',
      change: { path: '/workspace/live.txt', kind: 'modified' },
    });
  });
});
