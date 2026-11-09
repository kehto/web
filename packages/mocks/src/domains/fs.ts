/**
 * domains/fs.ts — Mock NAP-FS service.
 *
 * Spec: naps/NAP-FS.md @ napplet/naps PR #88 head bd1b9e91 (draft)
 * Routes: fs.info, fs.pickFile, fs.pickFiles, fs.pickDirectory, fs.pickSaveFile,
 *         fs.stat, fs.list, fs.read, fs.write, fs.mkdir, fs.remove, fs.move,
 *         fs.watch, fs.unwatch
 * Pushes: fs.changed
 * Spec gaps / decisions:
 * - Two seeded roots: `/downloads` (every permission) holding
 *   `/downloads/iso/<catalog file>` placeholder images plus `SHA256SUMS`, and
 *   `/media` (read/list/watch) holding placeholder avatars. Paths outside a
 *   root are `not-found` so hidden paths stay indistinguishable from absent ones.
 * - Pickers resolve without UI to a seeded choice (first catalog image, every
 *   catalog image, `/downloads/iso`, or `/downloads/<suggestedName>`);
 *   `setNextPick()` scripts the next outcome, including `cancelled`.
 * - Paths are NFC-normalized and compared case-sensitively. Revisions are
 *   exposed (`r<n>`) so `ifRevision` is honored.
 * - Moving onto an existing destination is `already-exists`; cross-root moves
 *   are `unsupported`; removing a root itself is `policy-denied`.
 * - `fs.changed` is emitted synchronously for every mutation to watches that
 *   cover the path (direct children, or descendants for recursive watches).
 */
import type { NappletMessage } from '@kehto/runtime';
import type {
  FsDirectoryEntry,
  FsError,
  FsInfo,
  FsLimits,
  FsMetadata,
  FsPermission,
  FsPickOptions,
  FsPickResult,
  FsPickedEntry,
  FsRoot,
} from '@napplet/nap/fs/types';
import { DEFAULT_CLOCK, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_ACCOUNTS, MOCK_EPOCH_SECONDS } from '../fixtures/nostr.js';
import { decodeBase64, encodeBase64, linuxDistroBytes, linuxDistroSums, placeholderPng, utf8Bytes } from './file-bytes.js';

export type { FsChange } from '@napplet/nap/fs/types';
export type { FsDirectoryEntry, FsError, FsInfo, FsLimits, FsMetadata, FsPermission, FsPickOptions, FsPickResult, FsPickedEntry, FsRoot };

/** Spec document the mock was written against. */
export const FS_SPEC_REF: NapSpecRef = {
  nap: 'NAP-FS',
  status: 'draft',
  source: 'pr',
  pr: 88,
  sha: 'bd1b9e91',
  path: 'naps/NAP-FS.md',
};

/** Every `FsPermission`, in spec order. */
export const ALL_FS_PERMISSIONS: readonly FsPermission[] = Object.freeze(['read', 'write', 'create', 'delete', 'list', 'watch']);

/** Default visible roots. */
export const DEFAULT_FS_ROOTS: readonly FsRoot[] = Object.freeze([
  { path: '/downloads', name: 'Downloads', permissions: [...ALL_FS_PERMISSIONS], description: 'Downloaded distribution images' },
  { path: '/media', name: 'Media', permissions: ['read', 'list', 'watch'] },
]);

/** Default limits. */
export const DEFAULT_FS_LIMITS: FsLimits = Object.freeze({ maxReadBytes: 1024 * 1024, maxWriteBytes: 1024 * 1024, maxWatchCount: 16 });

/**
 * One node of the virtual filesystem.
 *
 * @example
 * ```ts
 * const iso = service.mock.state().root.children?.get('downloads')?.children?.get('iso');
 * ```
 */
export interface MockFsNode {
  kind: 'file' | 'directory';
  name: string;
  bytes?: Uint8Array;
  children?: Map<string, MockFsNode>;
  createdAt: number;
  modifiedAt: number;
  revision?: string;
}

/**
 * In-memory state of the fs mock.
 *
 * @example
 * ```ts
 * createMockFsService().mock.state().watches.size === 0;
 * ```
 */
export interface MockFsState {
  /** Virtual root directory (`/`). */
  root: MockFsNode;
  /** Active watches keyed by watch id. */
  watches: Map<string, { windowId: string; path: string; recursive: boolean }>;
  /** Sequence counters. */
  counters: { watch: number; revision: number };
  /** Scripted outcome for the next picker call. */
  nextPick?: FsPickResult | 'cancelled';
}

/**
 * Options for `createMockFsService`.
 *
 * @example
 * ```ts
 * const service = createMockFsService({ limits: { maxReadBytes: 64 } });
 * ```
 */
export interface MockFsOptions extends MockServiceOptions {
  /** Visible roots. Default `DEFAULT_FS_ROOTS`. Seeded content lives under `/downloads` and `/media`. */
  roots?: readonly FsRoot[];
  /** Limit overrides merged over `DEFAULT_FS_LIMITS`. */
  limits?: Partial<FsLimits>;
}

/**
 * The fs mock with picker and host-side mutation controls.
 *
 * @example
 * ```ts
 * const service = createMockFsService();
 * service.setNextPick('cancelled');
 * service.writeFile('/downloads/note.txt', new TextEncoder().encode('hi'));
 * ```
 */
export type MockFsService = MockService<MockFsState> & {
  /**
   * Script the next picker outcome.
   *
   * @param pick - Entries to return, or `'cancelled'`.
   */
  setNextPick(pick: FsPickResult | 'cancelled'): void;
  /**
   * Read a file's bytes directly.
   *
   * @param path - Virtual absolute path.
   * @returns Bytes, or `undefined` when absent or a directory.
   */
  readFile(path: string): Uint8Array | undefined;
  /**
   * Write a file from the host side (bypasses permissions), emitting `fs.changed`.
   *
   * @param path - Virtual absolute path whose parent exists.
   * @param bytes - New content.
   * @returns Whether the write happened.
   */
  writeFile(path: string, bytes: Uint8Array): boolean;
};

type Ctx = MockRouteContext<MockFsState>;
type Found = { node: MockFsNode; parent: MockFsNode | undefined; segments: string[] };
type RootWithSegments = FsRoot & { segments: string[] };
interface FsCore { limits: FsLimits; info: FsInfo; roots: RootWithSegments[]; service: MockFsService | undefined }

const BAD_CHARS = /[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩\\]/;

function parsePath(path: unknown): string[] | null {
  if (typeof path !== 'string' || !path.startsWith('/') || BAD_CHARS.test(path)) return null;
  if (path === '/') return [];
  const segments = path.slice(1).normalize('NFC').split('/');
  return segments.some((segment) => segment === '' || segment === '.' || segment === '..') ? null : segments;
}

function joinPath(segments: readonly string[]): string {
  return `/${segments.join('/')}`;
}

function isPrefix(prefix: readonly string[], segments: readonly string[]): boolean {
  return prefix.length <= segments.length && prefix.every((segment, index) => segments[index] === segment);
}

function dir(name: string, at: number, children: Array<[string, MockFsNode]> = []): MockFsNode {
  return { kind: 'directory', name, children: new Map(children), createdAt: at, modifiedAt: at };
}

function file(name: string, bytes: Uint8Array, at: number, revision: string): MockFsNode {
  return { kind: 'file', name, bytes, createdAt: at, modifiedAt: at, revision };
}

function seedRoot(): MockFsNode {
  const base = MOCK_EPOCH_SECONDS * 1000;
  const isoFiles: Array<[string, MockFsNode]> = LINUX_DISTROS.map((image, index) => [image.fileName, file(image.fileName, linuxDistroBytes(image), base + index * 1000, `r${index + 1}`)]);
  isoFiles.push(['SHA256SUMS', file('SHA256SUMS', utf8Bytes(linuxDistroSums(LINUX_DISTROS)), base + 9000, 'r9')]);
  const avatars: Array<[string, MockFsNode]> = MOCK_ACCOUNTS.map((account, index) => [`${account.name}.png`, file(`${account.name}.png`, placeholderPng(`avatar:${account.name}`), base + 20000 + index * 1000, `r${20 + index}`)]);
  return dir('', base, [
    ['downloads', dir('downloads', base, [
      ['iso', dir('iso', base, isoFiles)],
      ['README.txt', file('README.txt', utf8Bytes('Verify every image against SHA256SUMS before flashing.\n'), base + 10000, 'r10')],
    ])],
    ['media', dir('media', base, [['avatars', dir('avatars', base, avatars)]])],
  ]);
}

function rootFor(core: FsCore, segments: readonly string[]): RootWithSegments | undefined {
  return core.roots.find((root) => isPrefix(root.segments, segments));
}

function find(state: MockFsState, segments: readonly string[]): Found | undefined {
  let parent: MockFsNode | undefined;
  let node: MockFsNode = state.root;
  for (const segment of segments) {
    const next = node.children?.get(segment);
    if (!next) return undefined;
    parent = node;
    node = next;
  }
  return { node, parent, segments: [...segments] };
}

/** Resolve a path through the path model and root policy; throws an FsError code. */
function authorize(core: FsCore, state: MockFsState, path: unknown, permission: FsPermission, mustExist = true): { segments: string[]; root: FsRoot; found?: Found } {
  const segments = parsePath(path);
  if (!segments) throw 'invalid-path' as FsError;
  const root = rootFor(core, segments);
  if (!root) throw 'not-found' as FsError;
  if (!root.permissions.includes(permission)) throw 'permission-denied' as FsError;
  const found = find(state, segments);
  if (!found && mustExist) throw 'not-found' as FsError;
  return { segments, root, ...(found ? { found } : {}) };
}

function metadata(node: MockFsNode, segments: readonly string[], root: FsRoot): FsMetadata {
  return {
    path: joinPath(segments),
    kind: node.kind,
    ...(node.kind === 'file' ? { size: node.bytes!.length, revision: node.revision } : {}),
    modifiedAt: node.modifiedAt,
    createdAt: node.createdAt,
    permissions: [...root.permissions],
  };
}

function covers(watchPath: string, recursive: boolean, target: string): boolean {
  if (target === watchPath) return true;
  const parent = target.slice(0, target.lastIndexOf('/')) || '/';
  return parent === watchPath || (recursive && target.startsWith(watchPath === '/' ? '/' : `${watchPath}/`));
}

function emit(core: FsCore, state: MockFsState, path: string, kind: 'created' | 'modified' | 'deleted' | 'moved', fromPath?: string): void {
  for (const [watchId, watch] of state.watches) {
    if (!covers(watch.path, watch.recursive, path) && !(fromPath && covers(watch.path, watch.recursive, fromPath))) continue;
    if (core.service) pushToWindow(core.service, watch.windowId, { type: 'fs.changed', change: { watchId, path, kind, ...(fromPath ? { fromPath } : {}) } } as NappletMessage);
  }
}

function nextRevision(state: MockFsState): string {
  state.counters.revision += 1;
  return `r${100 + state.counters.revision}`;
}

/** Run `operation`, replying with its fields on success or `{ error }` on a thrown FsError. */
function guarded(context: Ctx, operation: () => Record<string, unknown> | undefined): void {
  try {
    context.reply(operation());
  } catch (error) {
    context.reply({ error: typeof error === 'string' ? error : 'io-error' });
  }
}

function pick(core: FsCore, context: Ctx, kind: 'file' | 'files' | 'directory' | 'save'): Record<string, unknown> {
  const scripted = context.state.nextPick;
  context.state.nextPick = undefined;
  if (scripted === 'cancelled') throw 'cancelled' as FsError;
  if (scripted) return { result: scripted };
  const pickOptions = (context.message.options ?? {}) as FsPickOptions;
  const iso = find(context.state, ['downloads', 'iso'])!;
  const entry = (node: MockFsNode, segments: string[], permissions: FsPermission[]): FsPickedEntry => ({
    path: joinPath(segments),
    kind: node.kind,
    name: node.name,
    permissions: pickOptions.permissions?.filter((permission) => rootFor(core, segments)?.permissions.includes(permission)) ?? permissions,
    ...(node.kind === 'file' ? { size: node.bytes!.length } : {}),
    modifiedAt: node.modifiedAt,
  });
  const images = LINUX_DISTROS.map((image) => entry(iso.node.children!.get(image.fileName)!, ['downloads', 'iso', image.fileName], ['read']));
  if (kind === 'file') return { result: { entries: images.slice(0, 1) } };
  if (kind === 'files') return { result: { entries: images } };
  if (kind === 'directory') return { result: { entries: [entry(iso.node, ['downloads', 'iso'], ['read', 'list'])] } };
  const name = pickOptions.suggestedName && parsePath(`/${pickOptions.suggestedName}`)?.length === 1 ? pickOptions.suggestedName : 'export.bin';
  return { result: { entries: [{ path: `/downloads/${name}`, kind: 'file', name, permissions: ['write', 'create'] }] } };
}

function read(core: FsCore, context: Ctx): Record<string, unknown> {
  const { found } = authorize(core, context.state, context.message.path, 'read');
  if (found!.node.kind !== 'file') throw 'not-a-file' as FsError;
  const readOptions = (context.message.options ?? {}) as { offset?: number; length?: number };
  const offset = readOptions.offset ?? 0;
  const length = readOptions.length ?? core.limits.maxReadBytes;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 0) throw 'invalid-data' as FsError;
  if (length > core.limits.maxReadBytes) throw 'too-large' as FsError;
  const bytes = found!.node.bytes!;
  const chunk = bytes.subarray(Math.min(offset, bytes.length), Math.min(offset + length, bytes.length));
  return { result: { data: encodeBase64(chunk), offset, bytesRead: chunk.length, eof: offset + chunk.length >= bytes.length, size: bytes.length } };
}

function write(core: FsCore, context: Ctx): Record<string, unknown> {
  const { message, state, clock } = context;
  const bytes = decodeBase64(message.data as string);
  if (!bytes) throw 'invalid-data' as FsError;
  if (bytes.length > core.limits.maxWriteBytes) throw 'too-large' as FsError;
  const writeOptions = (message.options ?? {}) as { mode?: string; offset?: number; ifRevision?: string; ifAbsent?: boolean };
  const mode = writeOptions.mode ?? 'replace';
  if (!['replace', 'append', 'patch'].includes(mode)) throw 'invalid-data' as FsError;
  if ((mode === 'patch') !== (typeof writeOptions.offset === 'number')) throw 'invalid-data' as FsError;
  if (writeOptions.offset !== undefined && (writeOptions.offset < 0 || !Number.isInteger(writeOptions.offset))) throw 'invalid-data' as FsError;
  const segments = parsePath(message.path);
  if (!segments || segments.length === 0) throw 'invalid-path' as FsError;
  const existing = find(state, segments);
  const { root } = authorize(core, state, message.path, existing ? 'write' : 'create', false);
  if (existing?.node.kind === 'directory') throw 'not-a-file' as FsError;
  if (writeOptions.ifAbsent === true && existing) throw 'conflict' as FsError;
  if (writeOptions.ifRevision !== undefined && existing?.node.revision !== writeOptions.ifRevision) throw 'conflict' as FsError;
  const parent = find(state, segments.slice(0, -1));
  if (!parent) throw 'not-found' as FsError;
  if (parent.node.kind !== 'directory') throw 'not-a-directory' as FsError;
  if (!existing && !root.permissions.includes('create')) throw 'permission-denied' as FsError;
  const current = existing?.node.bytes ?? new Uint8Array(0);
  let next: Uint8Array;
  if (mode === 'replace') next = bytes;
  else if (mode === 'append') { next = new Uint8Array(current.length + bytes.length); next.set(current); next.set(bytes, current.length); }
  else {
    const offset = writeOptions.offset!;
    next = new Uint8Array(Math.max(current.length, offset + bytes.length));
    next.set(current);
    next.set(bytes, offset);
  }
  const now = clock.now();
  const name = segments.at(-1)!;
  if (existing) {
    existing.node.bytes = next;
    existing.node.modifiedAt = now;
    existing.node.revision = nextRevision(state);
  } else {
    parent.node.children!.set(name, file(name, next, now, nextRevision(state)));
    parent.node.modifiedAt = now;
  }
  emit(core, state, joinPath(segments), existing ? 'modified' : 'created');
  return { result: { bytesWritten: bytes.length, size: next.length } };
}

function mkdir(core: FsCore, context: Ctx): undefined {
  const { message, state, clock } = context;
  const { segments, found } = authorize(core, state, message.path, 'create', false);
  if (found) throw 'already-exists' as FsError;
  const recursive = (message.options as { recursive?: boolean } | undefined)?.recursive === true;
  let node = state.root;
  for (let depth = 0; depth < segments.length; depth += 1) {
    const segment = segments[depth]!;
    let child = node.children?.get(segment);
    if (!child) {
      if (!recursive && depth < segments.length - 1) throw 'not-found' as FsError;
      child = dir(segment, clock.now());
      node.children!.set(segment, child);
      node.modifiedAt = clock.now();
      emit(core, state, joinPath(segments.slice(0, depth + 1)), 'created');
    } else if (child.kind !== 'directory') {
      throw 'not-a-directory' as FsError;
    }
    node = child;
  }
  return undefined;
}

function remove(core: FsCore, context: Ctx): undefined {
  const { message, state, clock } = context;
  const { segments, found } = authorize(core, state, message.path, 'delete');
  if (core.roots.some((root) => root.segments.length === segments.length && isPrefix(root.segments, segments))) throw 'policy-denied' as FsError;
  const { node, parent } = found!;
  if (node.kind === 'directory' && node.children!.size > 0 && message.recursive !== true) throw 'conflict' as FsError;
  parent!.children!.delete(node.name);
  parent!.modifiedAt = clock.now();
  emit(core, state, joinPath(segments), 'deleted');
  return undefined;
}

function move(core: FsCore, context: Ctx): undefined {
  const { message, state, clock } = context;
  const from = authorize(core, state, message.fromPath, 'delete');
  const toSegments = parsePath(message.toPath);
  if (!toSegments) throw 'invalid-path' as FsError;
  if (from.root.path !== rootFor(core, toSegments)?.path) throw 'unsupported' as FsError;
  const to = authorize(core, state, message.toPath, 'create', false);
  if (to.found) throw 'already-exists' as FsError;
  if (isPrefix(from.segments, to.segments)) throw 'conflict' as FsError;
  const destinationParent = find(state, to.segments.slice(0, -1));
  if (!destinationParent) throw 'not-found' as FsError;
  if (destinationParent.node.kind !== 'directory') throw 'not-a-directory' as FsError;
  const { node, parent } = from.found!;
  parent!.children!.delete(node.name);
  node.name = to.segments.at(-1)!;
  node.modifiedAt = clock.now();
  destinationParent.node.children!.set(node.name, node);
  emit(core, state, joinPath(to.segments), 'moved', joinPath(from.segments));
  return undefined;
}

function watch(core: FsCore, context: Ctx): Record<string, unknown> {
  const { state, windowId, message } = context;
  const { segments } = authorize(core, state, message.path, 'watch');
  const active = [...state.watches.values()].filter((item) => item.windowId === windowId).length;
  if (core.limits.maxWatchCount !== undefined && active >= core.limits.maxWatchCount) throw 'quota-exceeded' as FsError;
  state.counters.watch += 1;
  const watchId = `fs-watch-${state.counters.watch}`;
  state.watches.set(watchId, { windowId, path: joinPath(segments), recursive: (message.options as { recursive?: boolean } | undefined)?.recursive === true });
  return { watchId };
}

function fsRoutes(core: FsCore): Record<string, MockRoute<MockFsState>> {
  return {
    'fs.info': ({ reply }) => reply({ info: core.info }),
    'fs.pickFile': (context) => guarded(context, () => pick(core, context, 'file')),
    'fs.pickFiles': (context) => guarded(context, () => pick(core, context, 'files')),
    'fs.pickDirectory': (context) => guarded(context, () => pick(core, context, 'directory')),
    'fs.pickSaveFile': (context) => guarded(context, () => pick(core, context, 'save')),
    'fs.stat': (context) => guarded(context, () => {
      const { segments, root, found } = authorize(core, context.state, context.message.path, 'read');
      return { metadata: metadata(found!.node, segments, root) };
    }),
    'fs.list': (context) => guarded(context, () => {
      const { segments, found } = authorize(core, context.state, context.message.path, 'list');
      if (found!.node.kind !== 'directory') throw 'not-a-directory' as FsError;
      const entries: FsDirectoryEntry[] = [...found!.node.children!.values()].map((child) => ({
        name: child.name,
        path: joinPath([...segments, child.name]),
        kind: child.kind,
        ...(child.kind === 'file' ? { size: child.bytes!.length } : {}),
        modifiedAt: child.modifiedAt,
      }));
      return { entries };
    }),
    'fs.read': (context) => guarded(context, () => read(core, context)),
    'fs.write': (context) => guarded(context, () => write(core, context)),
    'fs.mkdir': (context) => guarded(context, () => mkdir(core, context)),
    'fs.remove': (context) => guarded(context, () => remove(core, context)),
    'fs.move': (context) => guarded(context, () => move(core, context)),
    'fs.watch': (context) => guarded(context, () => watch(core, context)),
    'fs.unwatch': ({ state, windowId, message, reply }) => {
      const owned = typeof message.watchId === 'string' ? state.watches.get(message.watchId) : undefined;
      if (owned && owned.windowId === windowId) state.watches.delete(message.watchId as string);
      reply();
    },
  };
}

function dropWindowWatches(windowId: string, state: MockFsState): void {
  for (const [watchId, owned] of state.watches) if (owned.windowId === windowId) state.watches.delete(watchId);
}

/**
 * Create the NAP-FS mock.
 *
 * @param options - Roots, limits, and shared mock options.
 * @returns A `service`-kind mock for the `fs` domain.
 * @example
 * ```ts
 * const fs = createMockFsService();
 * fs.handleMessage('w1', { type: 'fs.list', id: 'l1', path: '/downloads/iso' }, send);
 * ```
 */
export function createMockFsService(options: MockFsOptions = {}): MockFsService {
  const roots = (options.roots ?? DEFAULT_FS_ROOTS).map((root) => ({ ...root, segments: parsePath(root.path) ?? [] }));
  const limits: FsLimits = { ...DEFAULT_FS_LIMITS, ...options.limits };
  const core: FsCore = { limits, info: { roots: roots.map(({ segments: _segments, ...root }) => root), limits }, roots, service: undefined };

  const service = defineMockService<MockFsState>({
    domain: 'fs',
    version: '1.0.0',
    description: 'Mock NAP-FS: seeded /downloads/iso tree with pickers and watches',
    kind: 'service',
    initialState: () => ({ root: seedRoot(), watches: new Map(), counters: { watch: 0, revision: 0 } }),
    routes: fsRoutes(core),
    onWindowDestroyed: dropWindowWatches,
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null || capability === 'fs:read') dropWindowWatches(windowId, state);
    },
  }, options) as MockFsService;
  core.service = service;

  Object.defineProperty(service, 'setNextPick', { value: (next: FsPickResult | 'cancelled') => { service.mock.state().nextPick = next; } });
  Object.defineProperty(service, 'readFile', {
    value: (path: string): Uint8Array | undefined => {
      const segments = parsePath(path);
      const found = segments ? find(service.mock.state(), segments) : undefined;
      return found?.node.kind === 'file' ? found.node.bytes : undefined;
    },
  });
  Object.defineProperty(service, 'writeFile', {
    value: (path: string, bytes: Uint8Array): boolean => {
      const state = service.mock.state();
      const segments = parsePath(path);
      const parent = segments && segments.length > 0 ? find(state, segments.slice(0, -1)) : undefined;
      if (!segments || !parent || parent.node.kind !== 'directory') return false;
      const name = segments.at(-1)!;
      const existing = parent.node.children!.get(name);
      if (existing?.kind === 'directory') return false;
      const now = (options.clock ?? DEFAULT_CLOCK).now();
      if (existing) { existing.bytes = bytes; existing.modifiedAt = now; existing.revision = nextRevision(state); }
      else parent.node.children!.set(name, file(name, bytes, now, nextRevision(state)));
      emit(core, state, joinPath(segments), existing ? 'modified' : 'created');
      return true;
    },
  });
  return service;
}

/** Registry row for the `fs` domain. */
export const FS_MOCK_ENTRY: MockDomainEntry = {
  domain: 'fs',
  kind: 'service',
  spec: FS_SPEC_REF,
  create: (options) => createMockFsService(options),
};
