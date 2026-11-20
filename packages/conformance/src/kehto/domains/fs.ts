import { createFsService, FsServiceError, type FsBackend, type FsBackendChange } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

type FsBackendNode = { kind: 'directory'; modifiedAt: number } | { kind: 'file'; data: Uint8Array; revision: number; modifiedAt: number };
type Watch = { path: string; recursive: boolean; onChange: (change: FsBackendChange) => void };
type WriteOptions = { mode?: string; offset?: number; ifRevision?: string; ifAbsent?: boolean };

/** The one visible root of the simulated filesystem. */
export const FS_ROOT = '/conformance';
const ALL_PERMISSIONS = ['read', 'write', 'create', 'delete', 'list', 'watch'] as const;
const LIMITS = { maxReadBytes: 65536, maxWriteBytes: 65536, maxWatchCount: 8 };

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(data: unknown): Uint8Array {
  if (typeof data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(data)) throw new FsServiceError('invalid-data');
  const binary = atob(data);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const parentOf = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/';
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
const within = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`) || base === '/';

/** In-memory tree with revisions and watches; mutations notify covering watches. */
function createTree() {
  let clock = 1790337600;
  let revisions = 0;
  const nodes = new Map<string, FsBackendNode>([['/', { kind: 'directory', modifiedAt: clock }], [FS_ROOT, { kind: 'directory', modifiedAt: clock }]]);
  const watches = new Set<Watch>();
  const node = (path: string): FsBackendNode => {
    const found = nodes.get(path);
    if (!found || !within(path, FS_ROOT) && path !== '/') throw new FsServiceError('not-found');
    return found;
  };
  const children = (path: string): string[] => [...nodes.keys()].filter((item) => item !== path && parentOf(item) === path);
  const notify = (path: string, kind: FsBackendChange['kind'], fromPath?: string): void => {
    for (const watch of watches) {
      const covered = path === watch.path || parentOf(path) === watch.path || (watch.recursive && within(path, watch.path));
      if (covered) watch.onChange({ path, kind, ...(fromPath ? { fromPath } : {}) });
    }
  };
  const putFile = (path: string, data: Uint8Array): void => {
    const existed = nodes.has(path);
    nodes.set(path, { kind: 'file', data, revision: revisions += 1, modifiedAt: clock += 1 });
    notify(path, existed ? 'modified' : 'created');
  };
  return { nodes, watches, node, children, notify, putFile, parentOf };
}

type Tree = ReturnType<typeof createTree>;

function writeFile(tree: Tree, path: string, data: unknown, options: WriteOptions = {}): { bytesWritten: number; size: number } {
  const bytes = decode(data);
  if (bytes.length > LIMITS.maxWriteBytes) throw new FsServiceError('too-large');
  const existing = tree.nodes.get(path);
  if (existing?.kind === 'directory') throw new FsServiceError('not-a-file');
  if (!existing && tree.nodes.get(parentOf(path))?.kind !== 'directory') throw new FsServiceError('not-found');
  if (options.ifAbsent === true && existing) throw new FsServiceError('conflict');
  if (options.ifRevision !== undefined && (!existing || String(existing.revision) !== options.ifRevision)) throw new FsServiceError('conflict');
  const mode = options.mode ?? 'replace';
  if ((mode === 'patch') !== (options.offset !== undefined)) throw new FsServiceError('invalid-data');
  const current = existing?.kind === 'file' ? existing.data : new Uint8Array();
  let next: Uint8Array;
  if (mode === 'replace') next = bytes;
  else if (mode === 'append') next = Uint8Array.from([...current, ...bytes]);
  else if (mode === 'patch') {
    const offset = options.offset ?? 0;
    next = new Uint8Array(Math.max(current.length, offset + bytes.length));
    next.set(current);
    next.set(bytes, offset);
  } else throw new FsServiceError('unsupported');
  tree.putFile(path, next);
  return { bytesWritten: bytes.length, size: next.length };
}

function removeEntry(tree: Tree, path: string, recursive: boolean | undefined): void {
  const target = tree.node(path);
  if (path === FS_ROOT || path === '/') throw new FsServiceError('policy-denied');
  const descendants = [...tree.nodes.keys()].filter((item) => item.startsWith(`${path}/`));
  if (target.kind === 'directory' && descendants.length && recursive !== true) throw new FsServiceError('conflict');
  for (const item of [...descendants, path]) tree.nodes.delete(item);
  tree.notify(path, 'deleted');
}

function moveEntry(tree: Tree, fromPath: string, toPath: string): void {
  tree.node(fromPath);
  if (tree.nodes.has(toPath)) throw new FsServiceError('already-exists');
  if (tree.nodes.get(parentOf(toPath))?.kind !== 'directory' || !within(toPath, FS_ROOT) || within(toPath, fromPath)) throw new FsServiceError('policy-denied');
  for (const item of [...tree.nodes.keys()].filter((key) => key === fromPath || key.startsWith(`${fromPath}/`))) {
    tree.nodes.set(`${toPath}${item.slice(fromPath.length)}`, tree.nodes.get(item)!);
    tree.nodes.delete(item);
  }
  tree.notify(toPath, 'moved', fromPath);
}

function createBackend(tree: Tree): FsBackend {
  const picked = (path: string, kind: 'file' | 'directory', permissions: readonly string[]) => ({ path, kind, name: nameOf(path), permissions: [...permissions] }) as never;
  return {
    info: () => ({ roots: [{ path: FS_ROOT, name: 'Conformance files', permissions: [...ALL_PERMISSIONS] }], limits: { ...LIMITS } }) as never,
    pickFile: () => ({ entries: [picked(`${FS_ROOT}/notes/readme.txt`, 'file', ['read'])] }),
    pickFiles: () => ({ entries: [picked(`${FS_ROOT}/notes/readme.txt`, 'file', ['read']), picked(`${FS_ROOT}/notes/todo.txt`, 'file', ['read'])] }),
    pickDirectory: () => ({ entries: [picked(`${FS_ROOT}/notes`, 'directory', ['read', 'list'])] }),
    pickSaveFile: () => ({ entries: [picked(`${FS_ROOT}/notes/saved.txt`, 'file', ['write', 'create'])] }),
    stat(_windowId, path) {
      const found = tree.node(path);
      return found.kind === 'file'
        ? { path, kind: 'file', size: found.data.length, modifiedAt: found.modifiedAt, revision: String(found.revision), permissions: [...ALL_PERMISSIONS] } as never
        : { path, kind: 'directory', modifiedAt: found.modifiedAt, permissions: [...ALL_PERMISSIONS] } as never;
    },
    list(_windowId, path) {
      if (tree.node(path).kind !== 'directory') throw new FsServiceError('not-a-directory');
      return tree.children(path).map((child) => {
        const entry = tree.nodes.get(child)!;
        return { name: nameOf(child), path: child, kind: entry.kind, ...(entry.kind === 'file' ? { size: entry.data.length } : {}) } as never;
      });
    },
    read(_windowId, path, options) {
      const found = tree.node(path);
      if (found.kind !== 'file') throw new FsServiceError('not-a-file');
      const offset = options?.offset ?? 0;
      const length = Math.min(options?.length ?? LIMITS.maxReadBytes, LIMITS.maxReadBytes);
      if ((options?.length ?? 0) > LIMITS.maxReadBytes) throw new FsServiceError('too-large');
      const slice = found.data.slice(offset, offset + length);
      return { data: encode(slice), offset, bytesRead: slice.length, eof: offset + slice.length >= found.data.length, size: found.data.length };
    },
    write: (_windowId, path, data, options) => writeFile(tree, path, data, options as WriteOptions | undefined),
    mkdir(_windowId, path, options) {
      if (tree.nodes.has(path)) throw new FsServiceError('already-exists');
      const missing: string[] = [];
      for (let cursor = path; !tree.nodes.has(cursor); cursor = parentOf(cursor)) missing.unshift(cursor);
      if (missing.length > 1 && options?.recursive !== true) throw new FsServiceError('not-found');
      if (!within(path, FS_ROOT)) throw new FsServiceError('policy-denied');
      for (const item of missing) { tree.nodes.set(item, { kind: 'directory', modifiedAt: 0 }); tree.notify(item, 'created'); }
    },
    remove: (_windowId, path, recursive) => removeEntry(tree, path, recursive),
    move: (_windowId, fromPath, toPath) => moveEntry(tree, fromPath, toPath),
    watch(_windowId, path, options, onChange) {
      tree.node(path);
      const watch: Watch = { path, recursive: options?.recursive === true, onChange };
      tree.watches.add(watch);
      return { close() { tree.watches.delete(watch); } };
    },
  };
}

/**
 * NAP-FS backend: the reference FS service over an in-memory tree.
 *
 * The one root is `/conformance`, seeded with `notes/readme.txt` ("hello") and
 * `notes/todo.txt`. Pickers resolve at once, without UI, to fixed entries:
 * `notes/readme.txt` (one file), both notes (files), `notes` (directory) and
 * `notes/saved.txt` (save target). `fs.externalWrite` (`{ path, text }`)
 * writes a file as another application would, notifying watches.
 */
export const FS_BACKEND: DomainBackendModule = {
  domain: 'fs',
  create() {
    const tree = createTree();
    tree.nodes.set(`${FS_ROOT}/notes`, { kind: 'directory', modifiedAt: 0 });
    tree.putFile(`${FS_ROOT}/notes/readme.txt`, new TextEncoder().encode('hello'));
    tree.putFile(`${FS_ROOT}/notes/todo.txt`, new TextEncoder().encode('- conform'));
    return {
      services: { fs: createFsService({ backend: createBackend(tree) }) },
      controls: {
        'fs.externalWrite': (payload) => {
          const request = payload as { path?: unknown; text?: unknown } | undefined;
          const path = typeof request?.path === 'string' ? request.path : `${FS_ROOT}/notes/readme.txt`;
          if (tree.nodes.get(parentOf(path))?.kind !== 'directory') return false;
          tree.putFile(path, new TextEncoder().encode(typeof request?.text === 'string' ? request.text : 'hello from elsewhere'));
          return true;
        },
      },
    };
  },
};
