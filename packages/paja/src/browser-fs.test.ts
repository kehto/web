import { describe, expect, it, vi } from 'vitest';
import { FsServiceError, type FsBackend, type FsBackendWatch } from '@kehto/services';

import { createPajaBrowserFsBackend } from './browser-fs.js';
import { base64Bytes, MAX_WRITE_BYTES, revision } from './browser-fs-support.js';

abstract class MemoryHandle {
  abstract readonly kind: 'file' | 'directory';
  parent: MemoryDirectory | null = null;
  constructor(public name: string) {}

  async move(destination: MemoryDirectory, name = this.name): Promise<void> {
    if (destination.children.has(name)) throw new DOMException('exists', 'InvalidModificationError');
    this.parent?.children.delete(this.name);
    this.parent = destination;
    this.name = name;
    destination.children.set(name, this);
  }
}

class MemoryFile extends MemoryHandle {
  readonly kind = 'file' as const;
  data = new Uint8Array();
  modified = 1;

  async getFile() {
    const snapshot = this.data.slice();
    return {
      size: snapshot.byteLength,
      lastModified: this.modified,
      async arrayBuffer(): Promise<ArrayBuffer> {
        return snapshot.buffer as ArrayBuffer;
      },
      slice(start = 0, end = snapshot.byteLength) {
        const part = snapshot.slice(start, end);
        return { async arrayBuffer(): Promise<ArrayBuffer> { return part.buffer as ArrayBuffer; } };
      },
    };
  }

  async createWritable(options?: { keepExistingData?: boolean }) {
    let draft = options?.keepExistingData ? this.data.slice() : new Uint8Array();
    let position = 0;
    let aborted = false;
    return {
      write: async (value: BufferSource) => {
        const input = ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : new Uint8Array(value);
        const size = Math.max(draft.byteLength, position + input.byteLength);
        const next = new Uint8Array(size);
        next.set(draft);
        next.set(input, position);
        draft = next;
        position += input.byteLength;
      },
      seek: async (next: number) => { position = next; },
      close: async () => {
        if (aborted) return;
        this.data = draft;
        this.modified += 1;
      },
      abort: async () => { aborted = true; },
    };
  }
}

class MemoryDirectory extends MemoryHandle {
  readonly kind = 'directory' as const;
  readonly children = new Map<string, MemoryHandle>();

  async *entries(): AsyncIterableIterator<[string, MemoryHandle]> {
    yield* this.children.entries();
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFile> {
    const existing = this.children.get(name);
    if (existing?.kind === 'file') return existing as MemoryFile;
    if (existing) throw new DOMException('wrong kind', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const file = new MemoryFile(name);
    file.parent = this;
    this.children.set(name, file);
    return file;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryDirectory> {
    const existing = this.children.get(name);
    if (existing?.kind === 'directory') return existing as MemoryDirectory;
    if (existing) throw new DOMException('wrong kind', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing', 'NotFoundError');
    const directory = new MemoryDirectory(name);
    directory.parent = this;
    this.children.set(name, directory);
    return directory;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const existing = this.children.get(name);
    if (!existing) throw new DOMException('missing', 'NotFoundError');
    if (existing.kind === 'directory' && (existing as MemoryDirectory).children.size > 0 && !options?.recursive) {
      throw new DOMException('not empty', 'InvalidModificationError');
    }
    this.children.delete(name);
  }
}

async function backend(
  root: MemoryDirectory,
  identity = { dTag: 'notes', aggregateHash: 'hash-a' },
  extras: Record<string, unknown> = {},
): Promise<FsBackend> {
  const result = await createPajaBrowserFsBackend({
    getIdentity: () => identity,
    storage: { getDirectory: async () => root },
    ...extras,
  });
  if (!result) throw new Error('expected OPFS backend');
  return result;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timed out');
}

function code(error: unknown): string | undefined {
  return error instanceof FsServiceError ? error.code : undefined;
}

describe('createPajaBrowserFsBackend', () => {
  it('rejects oversized encoded writes before base64 decoding', () => {
    const encodedLength = Math.ceil((MAX_WRITE_BYTES + 1) / 3) * 4;
    const encoded = `${'A'.repeat(encodedLength - 1)}=`;
    const decode = vi.spyOn(globalThis, 'atob');

    expect(() => base64Bytes(encoded)).toThrow(expect.objectContaining({ code: 'too-large' }));
    expect(decode).not.toHaveBeenCalled();

    decode.mockRestore();
  });

  it('rejects oversized revision candidates before reading file bytes', async () => {
    const arrayBuffer = vi.fn<() => Promise<ArrayBuffer>>();
    const file = { size: 16 * 1024 * 1024 + 1, lastModified: 0, arrayBuffer, slice: vi.fn() };

    await expect(revision(file)).rejects.toSatisfy((error: unknown) => code(error) === 'too-large');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('persists real bytes in an identity-scoped OPFS workspace with revisions and ranges', async () => {
    const root = new MemoryDirectory('root');
    const first = await backend(root);

    await expect(first.write('window-a', '/workspace/note.txt', 'SGVsbG8=', { ifAbsent: true })).resolves.toEqual({
      bytesWritten: 5,
      size: 5,
    });
    const before = await first.stat('window-a', '/workspace/note.txt');
    await expect(first.read('window-a', '/workspace/note.txt', { offset: 1, length: 3 })).resolves.toEqual({
      data: 'ZWxs',
      offset: 1,
      bytesRead: 3,
      eof: false,
      size: 5,
    });
    await first.write('window-a', '/workspace/note.txt', 'IQ==', { mode: 'append', ifRevision: before.revision });
    await expect(first.write('window-a', '/workspace/note.txt', 'WA==', { ifRevision: before.revision })).rejects.toSatisfy(
      (error: unknown) => code(error) === 'conflict',
    );
    await Promise.all([
      first.write('window-a', '/workspace/note.txt', 'YQ==', { mode: 'append' }),
      first.write('window-a', '/workspace/note.txt', 'Yg==', { mode: 'append' }),
    ]);

    const reopened = await backend(root);
    await expect(reopened.read('window-z', '/workspace/note.txt')).resolves.toMatchObject({ data: 'SGVsbG8hYWI=', size: 8 });
    const isolated = await backend(root, { dTag: 'other', aggregateHash: 'hash-b' });
    await expect(isolated.stat('window-b', '/workspace/note.txt')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'not-found',
    );
    expect((await first.info('window-a')).roots).toEqual([
      expect.objectContaining({ path: '/workspace', name: 'Napplet workspace' }),
    ]);
    await expect(first.stat('window-a', '/')).resolves.toMatchObject({ path: '/', kind: 'directory' });
    await expect(first.list('window-a', '/')).resolves.toContainEqual({
      name: 'workspace', path: '/workspace', kind: 'directory',
    });
  });

  it('rejects traversal, native separators, and non-canonical base64 before mutation', async () => {
    const fs = await backend(new MemoryDirectory('root'));

    for (const path of ['/workspace/../escape', '/workspace//escape', '/workspace\\escape', '/C:/escape']) {
      await expect(fs.write('window-a', path, '')).rejects.toSatisfy(
        (error: unknown) => code(error) === 'invalid-path',
      );
    }
    await expect(fs.write('window-a', '/workspace/bad.bin', 'TQ')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'invalid-data',
    );
    await expect(fs.stat('window-a', '/workspace/bad.bin')).rejects.toSatisfy(
      (error: unknown) => code(error) === 'not-found',
    );
  });

  it('performs directory mutation, atomic handle moves, removal, and real watch invalidation', async () => {
    const fs = await backend(new MemoryDirectory('root'));
    const changes: Array<{ path: string; kind: string; fromPath?: string }> = [];
    const watch = await fs.watch('window-a', '/workspace', { recursive: true }, (change) => changes.push(change));

    await fs.mkdir('window-a', '/workspace/projects/demo', { recursive: true });
    await fs.write('window-a', '/workspace/projects/demo/a.txt', 'YQ==');
    await fs.move('window-a', '/workspace/projects/demo/a.txt', '/workspace/projects/demo/b.txt');
    expect(await fs.list('window-a', '/workspace/projects/demo')).toEqual([
      expect.objectContaining({ name: 'b.txt', path: '/workspace/projects/demo/b.txt', kind: 'file' }),
    ]);
    await fs.remove('window-a', '/workspace/projects', true);

    expect(changes).toEqual(expect.arrayContaining([
      { path: '/workspace/projects/demo', kind: 'created' },
      { path: '/workspace/projects/demo/a.txt', kind: 'created' },
      { path: '/workspace/projects/demo/b.txt', fromPath: '/workspace/projects/demo/a.txt', kind: 'moved' },
      { path: '/workspace/projects', kind: 'deleted' },
    ]));
    await watch.close();
  });

  it('does not register a browser watch after its window is destroyed during path resolution', async () => {
    const root = new MemoryDirectory('root');
    const fs = await backend(root);
    const getDirectoryHandle = root.getDirectoryHandle.bind(root);
    let releaseResolution: (() => void) | undefined;
    let delayed = true;
    root.getDirectoryHandle = async (name, options) => {
      if (delayed) {
        delayed = false;
        await new Promise<void>((resolve) => { releaseResolution = resolve; });
      }
      return getDirectoryHandle(name, options);
    };
    const interval = vi.spyOn(globalThis, 'setInterval');
    let watch: FsBackendWatch | undefined;
    let error: unknown;

    const pending = Promise.resolve(fs.watch('window-a', '/workspace', undefined, () => undefined))
      .then((handle) => { watch = handle; })
      .catch((reason: unknown) => { error = reason; });
    await waitFor(() => releaseResolution !== undefined);
    fs.onWindowDestroyed?.('window-a');
    releaseResolution?.();
    await pending;
    await watch?.close();
    interval.mockRestore();

    expect(code(error)).toBe('cancelled');
    expect(watch).toBeUndefined();
    expect(interval).not.toHaveBeenCalled();
  });

  it('maps browser picker handles to session-only virtual paths through host activation', async () => {
    const external = new MemoryFile('/Users/alice/private.txt');
    external.name = 'private.txt';
    external.data = new TextEncoder().encode('picked bytes');
    const activation = { run: vi.fn(async (_request, operation: () => Promise<unknown>) => operation()) };
    const fs = await backend(new MemoryDirectory('root'), undefined, {
      userActivation: activation,
      pickerApi: { showOpenFilePicker: async () => [external] },
    });

    const picked = await fs.pickFile('window-a', { accept: [{ extension: '.txt' }] });
    expect(picked.entries).toHaveLength(1);
    expect(picked.entries[0]!.path).toMatch(/^\/picked-[^/]+$/);
    expect(picked.entries[0]!.name).toBe('private.txt');
    expect(picked.entries[0]!.path).not.toContain('Users');
    await expect(fs.read('window-a', picked.entries[0]!.path)).resolves.toMatchObject({ data: 'cGlja2VkIGJ5dGVz' });
    expect(activation.run).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'fs', windowId: 'window-a', kind: 'file' }),
      expect.any(Function),
    );

    fs.onWindowDestroyed?.('window-a');
    await expect(fs.stat('window-a', picked.entries[0]!.path)).rejects.toSatisfy(
      (error: unknown) => code(error) === 'not-found',
    );
  });
});
