/**
 * domains/git.ts — Mock NAP-GIT service.
 *
 * Spec: naps/NAP-GIT.md @ napplet/naps PR #137 head a73bf8de (draft)
 * Routes: git.open, git.close, git.refs, git.get, git.read, git.createCommit,
 *         git.updateRef, git.fetch, git.push, git.propose
 * Spec gaps / decisions:
 * - One shared repository (`distro-notes`, see `git-fixtures.ts`) backs every
 *   `open`; the object model uses real SHA-1 ids so fixtures match `git`.
 * - Author, committer, and tagger headers come from the `identity` option
 *   (default `Example <example@example.org> 0 +0000`, the draft's fixture).
 * - `remote-1` is an in-memory remote seeded with the local refs. `fetch`
 *   observes it, `push` fast-forwards it (`conflict` otherwise), and `propose`
 *   records a proposal with an `https://forge.example.org/...` locator.
 * - `publishPolicy: 'deny'` makes `push`/`propose` answer `denied`.
 * - Unknown request fields are rejected with `invalid-request`, as the draft
 *   requires; invalid or missing `id` is discarded. There are no pushes.
 * - `@napplet/nap` 0.32.0 ships no git types; shapes follow the draft.
 */
import { defineMockService } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { decodeBase64, encodeBase64, utf8Bytes, utf8Text } from './file-bytes.js';
import {
  DEFAULT_GIT_IDENTITY,
  GitObjectStore,
  decodeCommit,
  decodeTree,
  encodeCommit,
  encodeTree,
  seedDistroNotesRepo,
  tagTarget,
  type GitTreeEntryRaw,
  type GitTreeMode,
} from './git-fixtures.js';

export { DEFAULT_GIT_IDENTITY, GitObjectStore, seedDistroNotesRepo } from './git-fixtures.js';
export type { GitObjectKind, GitStoredObject, GitTreeEntryRaw, GitTreeMode, SeededGitRepo } from './git-fixtures.js';

/** Spec document the mock was written against. */
export const GIT_SPEC_REF: NapSpecRef = {
  nap: 'NAP-GIT',
  status: 'draft',
  source: 'pr',
  pr: 137,
  sha: 'a73bf8de',
  path: 'naps/NAP-GIT.md',
};

/** Every operation the mock advertises in `GitRepository.operations`. */
export const GIT_OPERATIONS: readonly string[] = Object.freeze(['open', 'close', 'refs', 'get', 'read', 'createCommit', 'updateRef', 'fetch', 'push', 'propose']);

/** `GitError.code` values. */
export type GitErrorCode = 'invalid-request' | 'invalid-handle' | 'invalid-cursor' | 'not-found' | 'denied' | 'cancelled' | 'unsupported' | 'conflict' | 'too-large' | 'busy' | 'unavailable' | 'integrity';

/**
 * `GitReceipt` record.
 *
 * @example
 * ```ts
 * const receipt: GitReceipt = { effect: 'ref', destination: 'remote-1:refs', status: 'accepted', oid: '…', ref: 'refs/heads/main' };
 * ```
 */
export interface GitReceipt {
  effect: 'objects' | 'ref' | 'proposal';
  destination: string;
  status: 'accepted' | 'rejected' | 'unknown';
  oid: string;
  ref?: string;
  locator?: string;
}

/**
 * One open repository handle.
 *
 * @example
 * ```ts
 * service.mock.state().handles.get('repo-1')?.windowId === 'w1';
 * ```
 */
export interface MockGitHandle {
  repository: string;
  windowId: string;
  closed: boolean;
  /** Pagination snapshots keyed by cursor prefix. */
  snapshots: Map<string, { args: string; items: unknown[] }>;
}

/**
 * A recorded proposal on the in-memory remote.
 *
 * @example
 * ```ts
 * const proposal: MockGitProposal = { target: 'refs/heads/main', base: '…', head: '…', title: 'Add sums', description: '', locator: 'https://forge.example.org/distro-notes/proposals/1' };
 * ```
 */
export interface MockGitProposal { target: string; base: string; head: string; title: string; description: string; locator: string }

/**
 * In-memory remote: observed refs and recorded proposals.
 *
 * @example
 * ```ts
 * service.mock.state().remotes.get('remote-1')?.refs.get('refs/heads/main');
 * ```
 */
export interface MockGitRemote { refs: Map<string, string>; proposals: MockGitProposal[] }

/**
 * In-memory state of the git mock.
 *
 * @example
 * ```ts
 * createMockGitService().mock.state().refs.get('refs/heads/main');
 * ```
 */
export interface MockGitState {
  /** Shared object store. */
  store: GitObjectStore;
  /** Local references. */
  refs: Map<string, string>;
  /** Remotes keyed by id. */
  remotes: Map<string, MockGitRemote>;
  /** Open handles keyed by repository id. */
  handles: Map<string, MockGitHandle>;
  /** Sequence counters. */
  counters: { handle: number; cursor: number; proposal: number };
}

/**
 * Options for `createMockGitService`.
 *
 * @example
 * ```ts
 * const service = createMockGitService({ publishPolicy: 'deny' });
 * ```
 */
export interface MockGitOptions extends MockServiceOptions {
  /** Author/committer header for created commits. Default `DEFAULT_GIT_IDENTITY`. */
  identity?: string;
  /** Whether `push`/`propose` are allowed. Default `'allow'`. */
  publishPolicy?: 'allow' | 'deny';
  /** Largest `read` length. Default 1 MiB. */
  maxReadBytes?: number;
  /** Default page size for `refs` and tree `get`. Default 100. */
  pageSize?: number;
}

/**
 * The git mock.
 *
 * @example
 * ```ts
 * const service = createMockGitService();
 * service.handleMessage('w1', { type: 'git.open', id: 'o1' }, send);
 * ```
 */
export type MockGitService = MockService<MockGitState>;

type Ctx = MockRouteContext<MockGitState>;
type Fail = { code: GitErrorCode; message?: string };
interface GitCore { identity: string; maxReadBytes: number; pageSize: number; publishPolicy: 'allow' | 'deny' }

const ALLOWED_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'git.open': ['type', 'id', 'source'],
  'git.close': ['type', 'id', 'repository'],
  'git.refs': ['type', 'id', 'repository', 'cursor', 'limit'],
  'git.get': ['type', 'id', 'repository', 'oid', 'cursor', 'limit'],
  'git.read': ['type', 'id', 'repository', 'oid', 'offset', 'length'],
  'git.createCommit': ['type', 'id', 'repository', 'request'],
  'git.updateRef': ['type', 'id', 'repository', 'request'],
  'git.fetch': ['type', 'id', 'repository', 'remote', 'ref'],
  'git.push': ['type', 'id', 'repository', 'request'],
  'git.propose': ['type', 'id', 'repository', 'request'],
});
const REQUEST_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'git.createCommit': ['parent', 'changes', 'message'],
  'git.updateRef': ['ref', 'expected', 'oid'],
  'git.push': ['remote', 'ref', 'oid'],
  'git.propose': ['remote', 'target', 'base', 'head', 'title', 'description'],
});

function fail(code: GitErrorCode, message?: string): never {
  throw { code, ...(message ? { message } : {}) } satisfies Fail;
}

function isOid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) && !/^0{40}$/.test(value);
}

function isBranch(value: unknown): value is string {
  return typeof value === 'string' && /^refs\/heads\/[^\s~^:?*[\\]+$/.test(value) && !value.endsWith('/') && !value.includes('..') && !value.endsWith('.lock');
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) return left[index]! - right[index]!;
  return left.length - right.length;
}

function pathSegments(encoded: unknown): string[] {
  const bytes = typeof encoded === 'string' ? decodeBase64(encoded) : null;
  if (!bytes || bytes.length === 0 || bytes.includes(0) || bytes.includes(0x5c)) fail('invalid-request', 'invalid path');
  const segments = utf8Text(bytes).split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..' || segment.toLowerCase() === '.git')) fail('invalid-request', 'invalid path');
  return segments;
}

type TreeMap = Map<string, { mode: GitTreeMode; oid: string } | TreeMap>;

function loadTree(store: GitObjectStore, oid: string | undefined): TreeMap {
  const out: TreeMap = new Map();
  if (!oid) return out;
  const object = store.get(oid);
  if (!object || object.kind !== 'tree') return out;
  for (const entry of decodeTree(object.body)) {
    out.set(utf8Text(entry.name), entry.mode === '040000' ? loadTree(store, entry.oid) : { mode: entry.mode, oid: entry.oid });
  }
  return out;
}

function saveTree(store: GitObjectStore, tree: TreeMap): string | undefined {
  const entries: GitTreeEntryRaw[] = [];
  for (const [name, value] of tree) {
    if (value instanceof Map) {
      const oid = saveTree(store, value);
      if (oid) entries.push({ name: utf8Bytes(name), mode: '040000', oid });
    } else {
      entries.push({ name: utf8Bytes(name), mode: value.mode, oid: value.oid });
    }
  }
  return entries.length === 0 ? undefined : store.put('tree', encodeTree(entries));
}

function applyChange(store: GitObjectStore, tree: TreeMap, change: Record<string, unknown>): void {
  const segments = pathSegments(change.path);
  let level = tree;
  for (const segment of segments.slice(0, -1)) {
    const next = level.get(segment);
    if (next && !(next instanceof Map)) fail('conflict', `${segment} is not a tree`);
    if (!next) {
      if (change.action === 'delete') fail('not-found');
      level.set(segment, new Map());
    }
    level = level.get(segment) as TreeMap;
  }
  const name = segments.at(-1)!;
  const existing = level.get(name);
  if (change.action === 'delete') {
    if (!existing) fail('not-found');
    if (existing instanceof Map) fail('conflict', 'cannot delete a tree');
    level.delete(name);
    return;
  }
  if (existing instanceof Map || (existing && existing.mode !== '100644' && existing.mode !== '100755')) fail('conflict', 'put replaces only regular files');
  const data = typeof change.data === 'string' ? decodeBase64(change.data) : null;
  if (!data) fail('invalid-request', 'invalid data');
  level.set(name, { mode: change.mode as GitTreeMode, oid: store.put('blob', data) });
}

function validateChange(change: Record<string, unknown>): void {
  if (typeof change !== 'object' || change === null) fail('invalid-request');
  const keys = Object.keys(change);
  if (change.action === 'put') {
    if (!['path', 'action', 'mode', 'data'].every((key) => keys.includes(key)) || keys.length !== 4) fail('invalid-request', 'put needs path, action, mode, data');
    if (change.mode !== '100644' && change.mode !== '100755') fail('invalid-request', 'invalid mode');
  } else if (change.action === 'delete') {
    if (keys.length !== 2 || !keys.includes('path')) fail('invalid-request', 'delete takes path and action only');
  } else {
    fail('invalid-request', 'invalid action');
  }
}

function validateChanges(changes: unknown): Record<string, unknown>[] {
  if (!Array.isArray(changes) || changes.length === 0) fail('invalid-request', 'changes must be non-empty');
  const paths: string[][] = [];
  for (const change of changes as Record<string, unknown>[]) {
    validateChange(change);
    const segments = pathSegments(change.path);
    for (const other of paths) {
      const shorter = Math.min(other.length, segments.length);
      if (other.slice(0, shorter).join('/') === segments.slice(0, shorter).join('/')) {
        fail(other.length === segments.length ? 'invalid-request' : 'conflict', 'paths overlap');
      }
    }
    paths.push(segments);
  }
  return changes as Record<string, unknown>[];
}

/** Validate the envelope's field set, run `operation`, and reply with `result` or the draft's `error` object. */
function guarded(context: Ctx, operation: () => unknown): void {
  if (typeof context.message.id !== 'string' || context.message.id === '') return;
  try {
    const allowed = ALLOWED_FIELDS[context.message.type] ?? [];
    for (const key of Object.keys(context.message)) if (!allowed.includes(key)) fail('invalid-request', `unknown field ${key}`);
    const requestFields = REQUEST_FIELDS[context.message.type];
    if (requestFields) {
      const request = context.message.request;
      if (typeof request !== 'object' || request === null) fail('invalid-request', 'request required');
      for (const key of Object.keys(request)) if (!requestFields.includes(key)) fail('invalid-request', `unknown request field ${key}`);
      for (const key of requestFields) if (!(key in request)) fail('invalid-request', `missing ${key}`);
    }
    context.reply({ result: operation() });
  } catch (error) {
    const failure = typeof error === 'object' && error !== null && 'code' in error ? error as Fail : { code: 'unavailable' as GitErrorCode };
    context.reply({ error: failure });
  }
}

function handle({ state, windowId, message }: Ctx): MockGitHandle {
  const found = typeof message.repository === 'string' ? state.handles.get(message.repository) : undefined;
  if (!found || found.windowId !== windowId || found.closed) fail('invalid-handle');
  return found;
}

function page<T>(core: GitCore, context: Ctx, owner: MockGitHandle, args: string, build: () => T[]): { items: T[]; next: string | null } {
  const { message, state } = context;
  const limit = message.limit === undefined ? core.pageSize : message.limit;
  if (!isInt(limit) || limit <= 0) fail('invalid-request', 'limit must be positive');
  let items: T[];
  let offset = 0;
  let key: string;
  if (message.cursor !== undefined) {
    const match = typeof message.cursor === 'string' ? /^(c\d+):(\d+)$/.exec(message.cursor) : null;
    const snapshot = match ? owner.snapshots.get(match[1]!) : undefined;
    if (!match || !snapshot || snapshot.args !== `${args}|${limit}`) fail('invalid-cursor');
    key = match[1]!;
    offset = Number(match[2]);
    items = snapshot.items as T[];
  } else {
    state.counters.cursor += 1;
    key = `c${state.counters.cursor}`;
    items = build();
    owner.snapshots.set(key, { args: `${args}|${limit}`, items });
  }
  const slice = items.slice(offset, offset + limit);
  const next = offset + limit < items.length ? `${key}:${offset + limit}` : null;
  if (next === null) owner.snapshots.delete(key);
  return { items: slice, next };
}

function objectOrFail(state: MockGitState, oid: unknown): { oid: string; kind: 'blob' | 'tree' | 'commit' | 'tag'; body: Uint8Array } {
  if (!isOid(oid)) fail('invalid-request', 'invalid oid');
  const object = state.store.get(oid);
  if (!object) fail('not-found');
  return { oid, ...object };
}

function commitOrFail(state: MockGitState, oid: unknown): string {
  const object = objectOrFail(state, oid);
  if (object.kind !== 'commit') fail('invalid-request', `${object.oid} is not a commit`);
  return object.oid;
}

function remoteOrFail(state: MockGitState, remote: unknown): MockGitRemote {
  const found = typeof remote === 'string' ? state.remotes.get(remote) : undefined;
  if (!found) fail('not-found', 'unknown remote');
  return found;
}

function openRoute(context: Ctx): Record<string, unknown> {
  const { message, state, windowId } = context;
  const source = message.source;
  if (source !== undefined) {
    if (typeof source !== 'string' || source === '' || source.startsWith('/') || source.startsWith('file:') || source.includes('\\')) fail('invalid-request', 'invalid source');
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(source)?.[1]?.toLowerCase();
    if (!scheme || !['https', 'nostr', 'ssh'].includes(scheme)) fail('unsupported', 'unsupported source scheme');
  }
  state.counters.handle += 1;
  const repository = `repo-${state.counters.handle}`;
  state.handles.set(repository, { repository, windowId, closed: false, snapshots: new Map() });
  return {
    repository,
    objectFormat: 'sha1',
    operations: [...GIT_OPERATIONS],
    remotes: [...state.remotes.keys()].map((remote) => ({ remote, operations: ['fetch', 'push', 'propose'] })),
  };
}

function getRoute(core: GitCore, context: Ctx): Record<string, unknown> {
  const owner = handle(context);
  const object = objectOrFail(context.state, context.message.oid);
  const base = { oid: object.oid, kind: object.kind, size: object.body.length };
  if (object.kind !== 'tree' && (context.message.cursor !== undefined || context.message.limit !== undefined)) fail('invalid-request', 'cursor/limit are valid only for trees');
  if (object.kind === 'blob') return base;
  if (object.kind === 'tag') return { ...base, target: tagTarget(object.body) };
  if (object.kind === 'commit') {
    const commit = decodeCommit(object.body);
    return { ...base, commit: { tree: commit.tree, parents: commit.parents, author: encodeBase64(utf8Bytes(commit.author)), committer: encodeBase64(utf8Bytes(commit.committer)), message: encodeBase64(utf8Bytes(commit.message)) } };
  }
  const result = page(core, context, owner, `get:${object.oid}`, () =>
    decodeTree(object.body).sort((left, right) => compareBytes(left.name, right.name)).map((entry) => ({ name: encodeBase64(entry.name), mode: entry.mode, oid: entry.oid })));
  return { ...base, entries: result.items, next: result.next };
}

function gitReadRoutes(core: GitCore): Record<string, MockRoute<MockGitState>> {
  return {
    'git.open': (context) => guarded(context, () => openRoute(context)),
    'git.close': (context) => guarded(context, () => {
      const found = typeof context.message.repository === 'string' ? context.state.handles.get(context.message.repository) : undefined;
      if (!found || found.windowId !== context.windowId) fail('invalid-handle');
      found.closed = true;
      found.snapshots.clear();
      return null;
    }),
    'git.refs': (context) => guarded(context, () => {
      const owner = handle(context);
      const result = page(core, context, owner, 'refs', () =>
        [...context.state.refs.entries()].map(([ref, oid]) => ({ ref, oid })).sort((left, right) => compareBytes(utf8Bytes(left.ref), utf8Bytes(right.ref))));
      return { entries: result.items, next: result.next };
    }),
    'git.get': (context) => guarded(context, () => getRoute(core, context)),
    'git.read': (context) => guarded(context, () => {
      handle(context);
      const { offset, length } = context.message;
      if (!isInt(offset) || !isInt(length) || offset < 0 || length < 0) fail('invalid-request', 'offset and length must be non-negative integers');
      if (length > core.maxReadBytes) fail('too-large');
      const object = objectOrFail(context.state, context.message.oid);
      const data = object.body.subarray(Math.min(offset, object.body.length), Math.min(offset + length, object.body.length));
      return { data: encodeBase64(data), offset, size: object.body.length, eof: offset + data.length >= object.body.length };
    }),
  };
}

function gitWriteRoutes(core: GitCore): Record<string, MockRoute<MockGitState>> {
  return {
    'git.createCommit': (context) => guarded(context, () => {
      handle(context);
      const { state } = context;
      const request = context.message.request as { parent: unknown; changes: unknown; message: unknown };
      if (typeof request.message !== 'string' || request.message === '' || request.message.includes('\0')) fail('invalid-request', 'invalid message');
      const parent = request.parent === null ? null : commitOrFail(state, request.parent);
      const changes = validateChanges(request.changes);
      const tree = loadTree(state.store, parent ? decodeCommit(state.store.get(parent)!.body).tree : undefined);
      for (const change of changes) applyChange(state.store, tree, change);
      const treeId = saveTree(state.store, tree) ?? state.store.put('tree', new Uint8Array(0));
      return { oid: state.store.put('commit', encodeCommit({ tree: treeId, parents: parent ? [parent] : [], author: core.identity, committer: core.identity, message: request.message })) };
    }),
    'git.updateRef': (context) => guarded(context, () => {
      handle(context);
      const { state } = context;
      const request = context.message.request as { ref: unknown; expected: unknown; oid: unknown };
      if (!isBranch(request.ref)) fail('invalid-request', 'ref must be refs/heads/…');
      if (request.expected === null && request.oid === null) fail('invalid-request', 'expected and oid cannot both be null');
      if (request.expected !== null && !isOid(request.expected)) fail('invalid-request', 'invalid expected');
      const target = request.oid === null ? null : commitOrFail(state, request.oid);
      const current = state.refs.get(request.ref) ?? null;
      if (current !== request.expected) fail('conflict');
      if (target === null) state.refs.delete(request.ref);
      else state.refs.set(request.ref, target);
      return { ref: request.ref, expected: request.expected, oid: target };
    }),
    'git.fetch': (context) => guarded(context, () => {
      handle(context);
      const remote = remoteOrFail(context.state, context.message.remote);
      const ref = context.message.ref;
      if (typeof ref !== 'string' || !(ref.startsWith('refs/heads/') || ref.startsWith('refs/tags/'))) fail('invalid-request', 'invalid ref');
      const oid = remote.refs.get(ref);
      if (!oid) fail('not-found');
      return { ref, oid };
    }),
    'git.push': (context) => guarded(context, () => {
      handle(context);
      const { state } = context;
      const request = context.message.request as { remote: unknown; ref: unknown; oid: unknown };
      if (core.publishPolicy === 'deny') fail('denied');
      const remote = remoteOrFail(state, request.remote);
      if (!isBranch(request.ref)) fail('invalid-request', 'ref must be refs/heads/…');
      const oid = commitOrFail(state, request.oid);
      const current = remote.refs.get(request.ref);
      if (current !== undefined && !state.store.isAncestor(current, oid)) fail('conflict', 'non-fast-forward');
      remote.refs.set(request.ref, oid);
      const receipts: GitReceipt[] = [
        { effect: 'objects', destination: `${request.remote}:objects`, status: 'accepted', oid },
        { effect: 'ref', destination: `${request.remote}:refs`, status: 'accepted', oid, ref: request.ref },
      ];
      return { outcome: 'complete', receipts };
    }),
    'git.propose': (context) => guarded(context, () => {
      handle(context);
      const { state } = context;
      const request = context.message.request as { remote: unknown; target: unknown; base: unknown; head: unknown; title: unknown; description: unknown };
      if (core.publishPolicy === 'deny') fail('denied');
      const remote = remoteOrFail(state, request.remote);
      if (!isBranch(request.target)) fail('invalid-request', 'target must be refs/heads/…');
      if (typeof request.title !== 'string' || request.title === '' || typeof request.description !== 'string') fail('invalid-request', 'title and description required');
      const base = commitOrFail(state, request.base);
      const head = commitOrFail(state, request.head);
      if (base === head || !state.store.isAncestor(base, head)) fail('conflict', 'base must be a proper ancestor of head');
      state.counters.proposal += 1;
      const locator = `https://forge.example.org/distro-notes/proposals/${state.counters.proposal}`;
      remote.proposals.push({ target: request.target, base, head, title: request.title, description: request.description, locator });
      const receipts: GitReceipt[] = [{ effect: 'proposal', destination: `${request.remote}:proposals`, status: 'accepted', oid: head, locator }];
      return { outcome: 'complete', receipts };
    }),
  };
}

/**
 * Create the NAP-GIT mock.
 *
 * @param options - Identity, publish policy, limits, and shared mock options.
 * @returns An `extension`-kind mock for the `git` domain.
 * @example
 * ```ts
 * const git = createMockGitService();
 * git.handleMessage('w1', { type: 'git.refs', id: 'r1', repository: 'repo-1' }, send);
 * ```
 */
export function createMockGitService(options: MockGitOptions = {}): MockGitService {
  const core: GitCore = {
    identity: options.identity ?? DEFAULT_GIT_IDENTITY,
    maxReadBytes: options.maxReadBytes ?? 1024 * 1024,
    pageSize: options.pageSize ?? 100,
    publishPolicy: options.publishPolicy ?? 'allow',
  };
  return defineMockService<MockGitState>({
    domain: 'git',
    version: '1.0.0',
    description: 'Mock NAP-GIT: in-memory distro-notes repository with real object ids',
    kind: 'extension',
    initialState: () => {
      const repo = seedDistroNotesRepo(core.identity);
      return {
        store: repo.store,
        refs: repo.refs,
        remotes: new Map([['remote-1', { refs: new Map(repo.refs), proposals: [] }]]),
        handles: new Map(),
        counters: { handle: 0, cursor: 0, proposal: 0 },
      };
    },
    routes: { ...gitReadRoutes(core), ...gitWriteRoutes(core) },
    onWindowDestroyed: (windowId, state) => {
      for (const [repository, owner] of state.handles) if (owner.windowId === windowId) state.handles.delete(repository);
    },
  }, options);
}

/** Registry row for the `git` domain. */
export const GIT_MOCK_ENTRY: MockDomainEntry = {
  domain: 'git',
  kind: 'extension',
  spec: GIT_SPEC_REF,
  create: (options) => createMockGitService(options),
};
