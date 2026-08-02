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
});
