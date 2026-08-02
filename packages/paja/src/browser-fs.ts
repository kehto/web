/** Real browser-backed NAP-FS implementation for Paja. */

import type {
  FsDirectoryEntry,
  FsInfo,
  FsMetadata,
  FsMkdirOptions,
  FsPermission,
  FsPickResult,
  FsReadResult,
  FsWatchOptions,
  FsWriteResult,
} from '@napplet/core';
import {
  FsServiceError,
  type FsBackend,
  type FsBackendChange,
  type FsBackendWatch,
} from '@kehto/services';
import type { SessionEntry } from '@kehto/shell';

import type { PajaUserActivationHandler } from './browser-device-services.js';
import {
  MAX_READ_BYTES,
  MAX_WATCH_COUNT,
  MAX_WRITE_BYTES,
  WATCH_INTERVAL_MS,
  WORKSPACE_PERMISSIONS,
  base64Bytes,
  browserPickers,
  browserStorage,
  child,
  encodeBase64,
  errorFromBrowser,
  parsePath,
  pickerOptions,
  randomMountId,
  requirePermission,
  revision,
  safePickedName,
  validateRange,
  type BackendWatchRecord,
  type BrowserDirectoryHandle,
  type BrowserFileHandle,
  type BrowserFsStorage,
  type BrowserHandle,
  type BrowserPickerApi,
  type Mount,
  type ParsedPath,
  type ResolvedEntry,
} from './browser-fs-support.js';

/** Options for the real Paja browser filesystem. */
export interface PajaBrowserFsOptions {
  /** Runtime-bound napplet identity used to scope the durable OPFS workspace. */
  getIdentity(windowId: string): Pick<SessionEntry, 'dTag' | 'aggregateHash'>;
  /** Host-owned user-activation broker used for browser picker calls. */
  userActivation?: PajaUserActivationHandler;
  /** Test/integration storage override. */
  storage?: BrowserFsStorage;
  /** Test/integration picker override. */
  pickerApi?: BrowserPickerApi;
}


/**
 * Probe OPFS and create Paja's persistent, identity-scoped browser backend.
 *
 * @param options - Identity, activation, and optional browser API overrides.
 * @returns A real backend, or `null` when OPFS cannot be opened.
 */
// aislop-ignore-next-line complexity/function-too-long -- Keep authority-bearing handles and grants closure-private.
export async function createPajaBrowserFsBackend(options: PajaBrowserFsOptions): Promise<FsBackend | null> {
  const storage = options.storage ?? browserStorage();
  if (!storage) return null;
  let storageRoot: BrowserDirectoryHandle;
  try {
    storageRoot = await storage.getDirectory();
  } catch {
    return null;
  }

  const pickers = options.pickerApi ?? browserPickers();
  const workspaceCache = new Map<string, Promise<BrowserDirectoryHandle>>();
  const pickedByWindow = new Map<string, Map<string, Mount>>();
  const backendWatches = new Set<BackendWatchRecord>();
  let mutationTail = Promise.resolve();

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const previous = mutationTail;
    let release: (() => void) | undefined;
    mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
    }
  }

  async function identityKey(windowId: string): Promise<string> {
    const identity = options.getIdentity(windowId);
    const bytes = new TextEncoder().encode(`${identity.dTag}\u0000${identity.aggregateHash}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function workspace(windowId: string): Promise<BrowserDirectoryHandle> {
    const key = await identityKey(windowId);
    let pending = workspaceCache.get(key);
    if (!pending) {
      pending = (async () => {
        const packageRoot = await storageRoot.getDirectoryHandle('kehto-paja-fs', { create: true });
        const versionRoot = await packageRoot.getDirectoryHandle('v1', { create: true });
        const identityRoot = await versionRoot.getDirectoryHandle(key, { create: true });
        return identityRoot.getDirectoryHandle('workspace', { create: true });
      })().catch((error) => { throw errorFromBrowser(error); });
      workspaceCache.set(key, pending);
    }
    return pending;
  }

  async function mountFor(windowId: string, parsed: ParsedPath): Promise<{ mount: Mount; rest: string[] }> {
    if (parsed.segments[0] === 'workspace') {
      const handle = await workspace(windowId);
      return {
        mount: {
          rootPath: '/workspace',
          handle,
          permissions: new Set(WORKSPACE_PERMISSIONS),
          key: `workspace:${await identityKey(windowId)}`,
        },
        rest: parsed.segments.slice(1),
      };
    }
    if (parsed.segments.length >= 1) {
      const rootPath = `/${parsed.segments[0]}`;
      const mount = pickedByWindow.get(windowId)?.get(rootPath);
      if (mount) return { mount, rest: parsed.segments.slice(1) };
    }
    throw new FsServiceError('not-found');
  }

  async function resolveExisting(windowId: string, value: unknown): Promise<ResolvedEntry> {
    const parsed = parsePath(value);
    const { mount, rest } = await mountFor(windowId, parsed);
    let current = mount.handle;
    for (const segment of rest) {
      if (current.kind !== 'directory') throw new FsServiceError('not-found');
      const next = await child(current as BrowserDirectoryHandle, segment);
      if (!next) throw new FsServiceError('not-found');
      current = next;
    }
    return { ...mount, path: parsed.path, handle: current };
  }

  async function resolveParent(windowId: string, value: unknown): Promise<{
    parsed: ParsedPath;
    mount: Mount;
    parent: BrowserDirectoryHandle;
    name: string;
  }> {
    const parsed = parsePath(value);
    if (parsed.segments.length < 2) throw new FsServiceError('invalid-path');
    const name = parsed.segments.at(-1)!;
    const parentPath = `/${parsed.segments.slice(0, -1).join('/')}`;
    const resolved = await resolveExisting(windowId, parentPath);
    if (resolved.handle.kind !== 'directory') throw new FsServiceError('not-a-directory');
    return { parsed, mount: resolved, parent: resolved.handle as BrowserDirectoryHandle, name };
  }

  async function metadata(entry: ResolvedEntry): Promise<FsMetadata> {
    if (entry.handle.kind === 'directory') {
      return { path: entry.path, kind: 'directory', permissions: [...entry.permissions] };
    }
    const file = await (entry.handle as BrowserFileHandle).getFile().catch((error) => { throw errorFromBrowser(error); });
    return {
      path: entry.path,
      kind: 'file',
      size: file.size,
      modifiedAt: file.lastModified,
      permissions: [...entry.permissions],
      revision: await revision(file),
    };
  }

  function grant(windowId: string, handle: BrowserHandle, permissions: FsPermission[]): Mount {
    const token = randomMountId();
    const rootPath = `/picked-${token}`;
    const mount: Mount = {
      rootPath,
      handle,
      permissions: new Set(permissions),
      key: `picked:${windowId}:${token}`,
    };
    let grants = pickedByWindow.get(windowId);
    if (!grants) {
      grants = new Map();
      pickedByWindow.set(windowId, grants);
    }
    grants.set(rootPath, mount);
    return mount;
  }

  async function pickedResult(windowId: string, handles: BrowserHandle[], permissions: FsPermission[]): Promise<FsPickResult> {
    const entries = await Promise.all(handles.map(async (handle) => {
      const mount = grant(windowId, handle, permissions);
      if (handle.kind === 'directory') {
        return { path: mount.rootPath, kind: 'directory' as const, name: safePickedName(handle.name), permissions };
      }
      const file = await (handle as BrowserFileHandle).getFile();
      return {
        path: mount.rootPath,
        kind: 'file' as const,
        name: safePickedName(handle.name),
        permissions,
        size: file.size,
        modifiedAt: file.lastModified,
      };
    }));
    return { entries };
  }

  async function runPicker<T>(
    windowId: string,
    kind: 'file' | 'files' | 'directory' | 'save-file',
    description: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!options.userActivation) throw new FsServiceError('unsupported');
    try {
      return await options.userActivation.run({ action: 'fs', windowId, kind, description }, operation);
    } catch (error) {
      if (error instanceof Error && /request denied|activation unavailable/u.test(error.message)) {
        throw new FsServiceError('policy-denied');
      }
      throw errorFromBrowser(error);
    }
  }

  async function snapshotEntry(entry: ResolvedEntry, recursive: boolean): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>();
    async function visit(path: string, handle: BrowserHandle, descend: boolean): Promise<void> {
      if (handle.kind === 'file') {
        const file = await (handle as BrowserFileHandle).getFile();
        snapshot.set(path, `file:${file.size}:${file.lastModified}`);
        return;
      }
      snapshot.set(path, 'directory');
      for await (const [name, childHandle] of (handle as BrowserDirectoryHandle).entries()) {
        const childPath = `${path}/${name.normalize('NFC')}`;
        if (childHandle.kind === 'file' || descend) await visit(childPath, childHandle, descend);
        else snapshot.set(childPath, 'directory');
      }
    }
    await visit(entry.path, entry.handle, recursive);
    return snapshot;
  }

  function covered(watch: BackendWatchRecord, path: string): boolean {
    if (!watch.directory) return path === watch.path;
    if (path === watch.path) return true;
    if (!path.startsWith(`${watch.path}/`)) return false;
    return watch.recursive || !path.slice(watch.path.length + 1).includes('/');
  }

  function emitMutation(change: FsBackendChange): void {
    for (const watch of backendWatches) {
      if (watch.closed || (!covered(watch, change.path) && (!change.fromPath || !covered(watch, change.fromPath)))) continue;
      watch.onChange(change);
    }
  }

  async function pollWatch(watch: BackendWatchRecord): Promise<void> {
    if (watch.closed) return;
    let next: Map<string, string>;
    try {
      next = await snapshotEntry(await resolveExisting(watch.windowId, watch.path), watch.recursive);
    } catch (error) {
      if (errorFromBrowser(error).code === 'not-found' && watch.snapshot.size > 0) {
        watch.onChange({ path: watch.path, kind: 'deleted' });
        watch.snapshot = new Map();
      }
      return;
    }
    for (const [path, state] of next) {
      const previous = watch.snapshot.get(path);
      if (previous === undefined) watch.onChange({ path, kind: 'created' });
      else if (previous !== state) watch.onChange({ path, kind: 'modified' });
    }
    for (const path of watch.snapshot.keys()) {
      if (!next.has(path)) watch.onChange({ path, kind: 'deleted' });
    }
    watch.snapshot = next;
  }

  const backend: FsBackend = {
    info(): FsInfo {
      return {
        roots: [{
          path: '/workspace',
          name: 'Napplet workspace',
          description: 'Persistent files scoped to this napplet identity',
          permissions: [...WORKSPACE_PERMISSIONS],
        }],
        limits: {
          maxReadBytes: MAX_READ_BYTES,
          maxWriteBytes: MAX_WRITE_BYTES,
          maxWatchCount: MAX_WATCH_COUNT,
        },
      };
    },

    async pickFile(windowId, pickerHints) {
      if (!pickers.showOpenFilePicker) throw new FsServiceError('unsupported');
      const handles = await runPicker(windowId, 'file', pickerHints?.description ?? 'Choose one file', () =>
        pickers.showOpenFilePicker!({ ...pickerOptions(pickerHints), multiple: false }));
      if (handles.length !== 1) throw new FsServiceError(handles.length === 0 ? 'cancelled' : 'io-error');
      return pickedResult(windowId, handles, ['read']);
    },

    async pickFiles(windowId, pickerHints) {
      if (!pickers.showOpenFilePicker) throw new FsServiceError('unsupported');
      const handles = await runPicker(windowId, 'files', pickerHints?.description ?? 'Choose files', () =>
        pickers.showOpenFilePicker!(pickerOptions(pickerHints, true)));
      if (handles.length === 0) throw new FsServiceError('cancelled');
      return pickedResult(windowId, handles, ['read']);
    },

    async pickDirectory(windowId, pickerHints) {
      if (!pickers.showDirectoryPicker) throw new FsServiceError('unsupported');
      const handle = await runPicker(windowId, 'directory', pickerHints?.description ?? 'Choose a directory', () =>
        pickers.showDirectoryPicker!({ mode: 'read' }));
      return pickedResult(windowId, [handle], ['read', 'list', 'watch']);
    },

    async pickSaveFile(windowId, pickerHints) {
      if (!pickers.showSaveFilePicker) throw new FsServiceError('unsupported');
      const handle = await runPicker(windowId, 'save-file', pickerHints?.description ?? 'Choose a save destination', () =>
        pickers.showSaveFilePicker!(pickerOptions(pickerHints)));
      return pickedResult(windowId, [handle], ['read', 'write', 'create']);
    },

    async stat(windowId, path) {
      if (parsePath(path).path === '/') {
        return { path: '/', kind: 'directory', permissions: ['list'] };
      }
      const entry = await resolveExisting(windowId, path);
      return metadata(entry);
    },

    async list(windowId, path): Promise<FsDirectoryEntry[]> {
      if (parsePath(path).path === '/') {
        const entries: FsDirectoryEntry[] = [{ name: 'workspace', path: '/workspace', kind: 'directory' }];
        for (const mount of pickedByWindow.get(windowId)?.values() ?? []) {
          const name = mount.rootPath.slice(1);
          if (mount.handle.kind === 'file') {
            const file = await (mount.handle as BrowserFileHandle).getFile();
            entries.push({ name, path: mount.rootPath, kind: 'file', size: file.size, modifiedAt: file.lastModified });
          } else {
            entries.push({ name, path: mount.rootPath, kind: 'directory' });
          }
        }
        return entries;
      }
      const entry = await resolveExisting(windowId, path);
      requirePermission(entry, 'list');
      if (entry.handle.kind !== 'directory') throw new FsServiceError('not-a-directory');
      const entries: FsDirectoryEntry[] = [];
      try {
        for await (const [name, handle] of (entry.handle as BrowserDirectoryHandle).entries()) {
          const normalizedName = name.normalize('NFC');
          if (handle.kind === 'file') {
            const file = await (handle as BrowserFileHandle).getFile();
            entries.push({ name: normalizedName, path: `${entry.path}/${normalizedName}`, kind: 'file', size: file.size, modifiedAt: file.lastModified });
          } else {
            entries.push({ name: normalizedName, path: `${entry.path}/${normalizedName}`, kind: 'directory' });
          }
        }
      } catch (error) {
        throw errorFromBrowser(error);
      }
      return entries;
    },

    async read(windowId, path, readOptions): Promise<FsReadResult> {
      const entry = await resolveExisting(windowId, path);
      requirePermission(entry, 'read');
      if (entry.handle.kind !== 'file') throw new FsServiceError('not-a-file');
      const { offset, length } = validateRange(readOptions);
      try {
        const file = await (entry.handle as BrowserFileHandle).getFile();
        const start = Math.min(offset, file.size);
        const bytes = new Uint8Array(await file.slice(start, Math.min(start + length, file.size)).arrayBuffer());
        return {
          data: encodeBase64(bytes),
          offset,
          bytesRead: bytes.byteLength,
          eof: offset + bytes.byteLength >= file.size,
          size: file.size,
        };
      } catch (error) {
        throw errorFromBrowser(error);
      }
    },

    async write(windowId, path, data, writeOptions): Promise<FsWriteResult> {
      return mutate(async () => {
        const bytes = base64Bytes(data);
        const mode = writeOptions?.mode ?? 'replace';
        const offset = writeOptions?.offset;
        if (!['replace', 'append', 'patch'].includes(mode)) throw new FsServiceError('invalid-data');
        if ((mode === 'replace' || mode === 'append') && offset !== undefined) throw new FsServiceError('invalid-data');
        if (mode === 'patch' && (!Number.isSafeInteger(offset) || (offset ?? -1) < 0)) throw new FsServiceError('invalid-data');
        const parent = await resolveParent(windowId, path);
        let existing = await child(parent.parent, parent.name);
        if (existing?.kind === 'directory') throw new FsServiceError('not-a-file');
        if (writeOptions?.ifAbsent === true && existing) throw new FsServiceError('conflict');
        if (existing) requirePermission(parent.mount, 'write');
        else requirePermission(parent.mount, 'create');
        if (writeOptions?.ifRevision !== undefined) {
          if (!existing) throw new FsServiceError('conflict');
          const current = await (existing as BrowserFileHandle).getFile();
          if (await revision(current) !== writeOptions.ifRevision) throw new FsServiceError('conflict');
        }
        try {
          const handle = existing as BrowserFileHandle | null
            ?? await parent.parent.getFileHandle(parent.name, { create: true });
          const fileBefore = await handle.getFile();
          const writable = await handle.createWritable({ keepExistingData: mode !== 'replace' });
          try {
            if (mode === 'append') await writable.seek(fileBefore.size);
            if (mode === 'patch') await writable.seek(offset!);
            await writable.write(bytes);
            await writable.close();
          } catch (error) {
            await writable.abort?.(error).catch(() => undefined);
            throw error;
          }
          const fileAfter = await handle.getFile();
          emitMutation({ path: parent.parsed.path, kind: existing ? 'modified' : 'created' });
          existing = handle;
          return { bytesWritten: bytes.byteLength, size: fileAfter.size };
        } catch (error) {
          throw errorFromBrowser(error);
        }
      });
    },

    async mkdir(windowId, path, mkdirOptions?: FsMkdirOptions): Promise<void> {
      return mutate(async () => {
        const parsed = parsePath(path);
        const { mount, rest } = await mountFor(windowId, parsed);
        requirePermission(mount, 'create');
        if (rest.length === 0) throw new FsServiceError('already-exists');
        let directory = mount.handle;
        if (directory.kind !== 'directory') throw new FsServiceError('not-a-directory');
        try {
          for (let index = 0; index < rest.length; index += 1) {
            const segment = rest[index]!;
            const existing = await child(directory as BrowserDirectoryHandle, segment);
            if (existing) {
              if (existing.kind !== 'directory') throw new FsServiceError('conflict');
              if (index === rest.length - 1) throw new FsServiceError('already-exists');
              directory = existing;
              continue;
            }
            if (index < rest.length - 1 && mkdirOptions?.recursive !== true) throw new FsServiceError('not-found');
            directory = await (directory as BrowserDirectoryHandle).getDirectoryHandle(segment, { create: true });
          }
          emitMutation({ path: parsed.path, kind: 'created' });
        } catch (error) {
          throw errorFromBrowser(error);
        }
      });
    },

    async remove(windowId, path, recursive): Promise<void> {
      return mutate(async () => {
        const parent = await resolveParent(windowId, path);
        requirePermission(parent.mount, 'delete');
        const existing = await child(parent.parent, parent.name);
        if (!existing) throw new FsServiceError('not-found');
        try {
          await parent.parent.removeEntry(parent.name, { recursive: recursive === true });
          emitMutation({ path: parent.parsed.path, kind: 'deleted' });
        } catch (error) {
          throw errorFromBrowser(error);
        }
      });
    },

    async move(windowId, fromPath, toPath): Promise<void> {
      return mutate(async () => {
        const source = await resolveExisting(windowId, fromPath);
        const destination = await resolveParent(windowId, toPath);
        requirePermission(source, 'delete');
        requirePermission(destination.mount, 'create');
        if (source.key !== destination.mount.key) throw new FsServiceError('unsupported');
        if (source.handle.kind === 'directory' && destination.parsed.path.startsWith(`${source.path}/`)) {
          throw new FsServiceError('conflict');
        }
        if (await child(destination.parent, destination.name)) throw new FsServiceError('already-exists');
        if (typeof source.handle.move !== 'function') throw new FsServiceError('unsupported');
        try {
          await source.handle.move(destination.parent, destination.name);
          emitMutation({ path: destination.parsed.path, fromPath: source.path, kind: 'moved' });
        } catch (error) {
          throw errorFromBrowser(error);
        }
      });
    },

    async watch(windowId, path, watchOptions?: FsWatchOptions, onChange?: (change: FsBackendChange) => void): Promise<FsBackendWatch> {
      const count = [...backendWatches].filter((watch) => watch.windowId === windowId && !watch.closed).length;
      if (count >= MAX_WATCH_COUNT) throw new FsServiceError('policy-denied');
      const entry = await resolveExisting(windowId, path);
      requirePermission(entry, 'watch');
      const callback = onChange ?? (() => undefined);
      const record: BackendWatchRecord = {
        windowId,
        path: entry.path,
        directory: entry.handle.kind === 'directory',
        recursive: watchOptions?.recursive === true,
        onChange: callback,
        snapshot: await snapshotEntry(entry, watchOptions?.recursive === true),
        closed: false,
      };
      record.timer = setInterval(() => { void pollWatch(record); }, WATCH_INTERVAL_MS);
      backendWatches.add(record);
      return {
        close() {
          if (record.closed) return;
          record.closed = true;
          if (record.timer !== undefined) clearInterval(record.timer);
          backendWatches.delete(record);
        },
      };
    },

    onWindowDestroyed(windowId): void {
      pickedByWindow.delete(windowId);
      for (const watch of backendWatches) {
        if (watch.windowId !== windowId) continue;
        watch.closed = true;
        if (watch.timer !== undefined) clearInterval(watch.timer);
        backendWatches.delete(watch);
      }
    },

    close(): void {
      pickedByWindow.clear();
      for (const watch of backendWatches) {
        watch.closed = true;
        if (watch.timer !== undefined) clearInterval(watch.timer);
      }
      backendWatches.clear();
    },
  };

  return backend;
}
