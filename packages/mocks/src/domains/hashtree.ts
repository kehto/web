/**
 * domains/hashtree.ts — Mock NAP-HASHTREE service.
 *
 * Spec: naps/NAP-HASHTREE.md @ napplet/naps PR #73 head 67997706 (draft)
 * Routes: hashtree.capabilities, hashtree.parseRef, hashtree.resolve,
 *         hashtree.stat, hashtree.list, hashtree.read, hashtree.putBytes,
 *         hashtree.putTree, hashtree.publishRoot, hashtree.pickFiles,
 *         hashtree.importFiles, hashtree.exportFiles, hashtree.pins,
 *         hashtree.pin, hashtree.unpin, hashtree.job, hashtree.cancel
 * Pushes: hashtree.progress, hashtree.done, hashtree.error
 * Spec gaps / decisions:
 * - Content hashes are `mockHex` placeholders, not HTS-01 MessagePack digests;
 *   `nhash` values are real bech32 encodings of a TLV `0 = hash` (`1 = key`).
 * - The seeded tree (`hashtree-fixtures.ts`) is published as
 *   `htree://<alice>/distros` with `unencrypted` visibility. `public`
 *   visibility derives a placeholder CHK key `mockHex('chk:<hash>')`.
 * - Private roots resolve only when `signedIn`; link-visible roots require the
 *   matching `#k=` share secret (`missing-key` otherwise).
 * - Import/export jobs are driven by `advance()` (or `autoAdvanceMs`), pushing
 *   `hashtree.progress` per step and `hashtree.done` on completion. Importing
 *   the default picked file set yields the seeded root CID.
 * - `blob`/`data` cross the wire as `ArrayBuffer`/`Uint8Array` (projection-native
 *   byte objects). `@napplet/nap` 0.32.0 ships no hashtree types; shapes follow the draft.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { NostrEvent } from '@napplet/core';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import type { MockRoute, MockRouteContext } from '../core/handler.js';
import { mockHex, mockPubkey } from '../core/rng.js';
import type { MockDomainEntry, MockScheduler, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_RELAY_URLS, buildMockEvent } from '../fixtures/nostr.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { hexToBytes, placeholderSha256, sniffMime, toBytes } from './file-bytes.js';
import {
  MOCK_HASHTREE_AUTHOR,
  MOCK_HASHTREE_NODES,
  MOCK_HASHTREE_ROOT_EVENT,
  MOCK_HASHTREE_ROOT_HASH,
  MOCK_HASHTREE_TREE_NAME,
  encodeBech32,
  encodeNhash,
  identifierToPubkey,
  parseHashtreeRef,
  walkHashtree,
  type HashtreeCapabilities,
  type HashtreeCid,
  type HashtreeEntry,
  type HashtreeJobStatus,
  type HashtreePin,
  type HashtreeResolvedRoot,
  type HashtreeRuntimeFileSet,
  type HashtreeVisibility,
  type MockHashtreeNode,
} from './hashtree-fixtures.js';

export { parseHashtreeRef } from './hashtree-fixtures.js';
export type {
  HashtreeCapabilities,
  HashtreeCid,
  HashtreeEntry,
  HashtreeJobState,
  HashtreeJobStatus,
  HashtreePin,
  HashtreeRef,
  HashtreeResolvedRoot,
  HashtreeRuntimeFileSet,
  HashtreeVisibility,
  MockHashtreeNode,
} from './hashtree-fixtures.js';

/** Spec document the mock was written against. */
export const HASHTREE_SPEC_REF: NapSpecRef = {
  nap: 'NAP-HASHTREE',
  status: 'draft',
  source: 'pr',
  pr: 73,
  sha: '67997706',
  path: 'naps/NAP-HASHTREE.md',
};

/**
 * A seeded or published mutable root.
 *
 * @example
 * ```ts
 * const root = service.mock.state().roots.get(`${MOCK_HASHTREE_AUTHOR}/distros`);
 * ```
 */
export interface MockHashtreeRoot {
  cid: HashtreeCid;
  author: string;
  treeName: string;
  visibility: HashtreeVisibility;
  event: NostrEvent;
  shareSecret?: string;
}

/**
 * One import/export job.
 *
 * @example
 * ```ts
 * service.mock.state().jobs.get('ht-1')?.status.state === 'queued';
 * ```
 */
export interface MockHashtreeJob {
  windowId: string;
  status: HashtreeJobStatus;
  step: number;
  steps: number;
  /** Final status fields applied on completion. */
  outcome: Partial<HashtreeJobStatus>;
}

/**
 * In-memory state of the hashtree mock.
 *
 * @example
 * ```ts
 * createMockHashtreeService().mock.state().roots.size === 1;
 * ```
 */
export interface MockHashtreeState {
  /** Every node keyed by content hash (seeded plus written). */
  nodes: Map<string, MockHashtreeNode>;
  /** Mutable roots keyed by `<pubkey>/<treeName>`. */
  roots: Map<string, MockHashtreeRoot>;
  /** Pins keyed by ref. */
  pins: Map<string, HashtreePin>;
  /** Jobs keyed by job id. */
  jobs: Map<string, MockHashtreeJob>;
  /** Runtime file sets keyed by id, with the owning window. */
  fileSets: Map<string, { windowId: string; fileSet: HashtreeRuntimeFileSet }>;
  /** Scripted outcome for the next `pickFiles`. */
  nextPick?: HashtreeRuntimeFileSet | 'cancel';
  /** Auto-advance timers keyed by job id. */
  timers: Map<string, () => void>;
  /** Sequence counters. */
  counters: { job: number; fileSet: number; root: number };
}

/**
 * Options for `createMockHashtreeService`.
 *
 * @example
 * ```ts
 * const service = createMockHashtreeService({ signedIn: false, jobSteps: 4 });
 * ```
 */
export interface MockHashtreeOptions extends MockServiceOptions {
  /** Overrides merged over the default capability flags. */
  capabilities?: Partial<HashtreeCapabilities>;
  /** Whether a shell-user signer is connected. Default `true`. */
  signedIn?: boolean;
  /** Shell-user pubkey for `publishRoot`. Default `alice`. */
  userPubkey?: string;
  /** Steps a job takes to complete. Default 2. */
  jobSteps?: number;
  /** When set, jobs advance automatically every this many ms. */
  autoAdvanceMs?: number;
}

/**
 * The hashtree mock with job and picker controls.
 *
 * @example
 * ```ts
 * const service = createMockHashtreeService();
 * service.setNextPick('cancel');
 * service.advance();
 * ```
 */
export type MockHashtreeService = MockService<MockHashtreeState> & {
  /**
   * Advance one or every queued/running job by one step.
   *
   * @param jobId - Only this job; omit for all.
   * @returns Whether any job advanced.
   */
  advance(jobId?: string): boolean;
  /**
   * Fail a job, pushing `hashtree.error`.
   *
   * @param jobId - Job to fail.
   * @param error - Error code. Default `store-failed`.
   * @returns Whether the job existed and was still in progress.
   */
  failJob(jobId: string, error?: string): boolean;
  /**
   * Script the next `pickFiles` outcome.
   *
   * @param pick - A file set, or `'cancel'` for `file-pick-cancelled`.
   */
  setNextPick(pick: HashtreeRuntimeFileSet | 'cancel'): void;
};

const DEFAULT_CAPABILITIES: HashtreeCapabilities = {
  canReadImmutable: true,
  canResolveMutable: true,
  canWrite: true,
  canPublishRoots: true,
  canPin: true,
  canImportRuntimeFiles: true,
  canExportRuntimeFiles: true,
  supportsFips: false,
  supportsBlossom: true,
  supportsLocalStore: true,
  maxReadBytes: 1024 * 1024,
  maxWriteBytes: 1024 * 1024,
};

type Ctx = MockRouteContext<MockHashtreeState>;
type Locate = { ok: true; node: MockHashtreeNode; path: string; root: HashtreeResolvedRoot } | { ok: false; error: string; reason?: string };
interface HashtreeCore {
  capabilities: HashtreeCapabilities;
  signedIn: boolean;
  userPubkey: string;
  userNpub: string;
  steps: number;
  scheduler: MockScheduler;
  clockNow: () => number;
  maxRead: number;
  maxWrite: number;
  autoAdvanceMs: number | undefined;
  service: MockHashtreeService | undefined;
}
interface PublishRequest { cid: HashtreeCid; treeName: string; visibility: HashtreeVisibility; shareSecret?: string; content?: string }

function cidOf(node: MockHashtreeNode, key?: string): HashtreeCid {
  return { hash: node.hash, ...(key ? { key } : {}), nhash: encodeNhash(node.hash, key) };
}

function toEntry(node: MockHashtreeNode, path: string, key?: string): HashtreeEntry {
  return {
    path,
    type: node.type,
    cid: cidOf(node, key),
    name: node.name,
    ...(node.type === 'file' ? { size: node.bytes!.length, mime: node.mime } : {}),
  };
}

function locate(core: HashtreeCore, state: MockHashtreeState, refText: unknown): Locate {
  const ref = parseHashtreeRef(refText as string);
  if (!ref) return { ok: false, error: 'invalid-ref' };
  if (ref.cid) {
    const node = state.nodes.get(ref.cid.hash);
    return node ? { ok: true, node, path: node.name, root: { cid: cidOf(node, ref.cid.key) } } : { ok: false, error: 'not-found' };
  }
  const pubkey = identifierToPubkey(ref.identifier!);
  if (!pubkey) return { ok: false, error: 'invalid-ref', reason: 'identifier must be npub or hex' };
  const root = state.roots.get(`${pubkey}/${ref.treePath}`);
  if (!root) return { ok: false, error: 'not-found' };
  if (root.visibility === 'private' && !core.signedIn) return { ok: false, error: 'not-signed-in' };
  if (root.visibility === 'link-visible' && ref.shareSecret !== root.shareSecret) return { ok: false, error: 'missing-key' };
  const segments = ref.entryPath ? ref.entryPath.split('/') : [];
  const node = walkHashtree(state.nodes, root.cid.hash, segments);
  if (!node) return { ok: false, error: 'not-found' };
  const resolved: HashtreeResolvedRoot = { cid: root.cid, ref, rootResult: { event: root.event }, eventId: root.event.id, author: root.author, treeName: root.treeName, visibility: root.visibility };
  return { ok: true, node, path: ref.entryPath || root.treeName, root: resolved };
}

function listEntries(state: MockHashtreeState, node: MockHashtreeNode, base: string, recursive: boolean, out: HashtreeEntry[]): void {
  for (const child of node.entries ?? []) {
    const childNode = state.nodes.get(child.hash);
    if (!childNode) continue;
    const path = base ? `${base}/${child.name}` : child.name;
    out.push(toEntry(childNode, path));
    if (recursive && childNode.type === 'dir') listEntries(state, childNode, path, true, out);
  }
}

function storeFile(state: MockHashtreeState, bytes: Uint8Array, name: string, mime: string | undefined, visibility: HashtreeVisibility): { node: MockHashtreeNode; key?: string } {
  const hash = placeholderSha256(bytes);
  const node: MockHashtreeNode = { hash, type: 'file', name, bytes, mime: mime ?? sniffMime(bytes) };
  state.nodes.set(hash, node);
  return visibility === 'unencrypted' ? { node } : { node, key: mockHex(`chk:${hash}`) };
}

function storeDir(state: MockHashtreeState, name: string, children: Map<string, MockHashtreeNode>): MockHashtreeNode {
  const entries = [...children.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([childName, child]) => ({ name: childName, hash: child.hash }));
  const hash = mockHex(`htree:dir:${entries.map((entry) => `${entry.name}=${entry.hash}`).join(',')}`);
  const node: MockHashtreeNode = { hash, type: 'dir', name, entries };
  state.nodes.set(hash, node);
  return node;
}

function publish(core: HashtreeCore, state: MockHashtreeState, request: PublishRequest): MockHashtreeRoot {
  state.counters.root += 1;
  const { cid, treeName, visibility } = request;
  const tags = [['d', treeName], ['l', 'hashtree'], ['hash', cid.hash], ['visibility', visibility]];
  if (visibility === 'public' && cid.key) tags.push(['key', cid.key]);
  const event = buildMockEvent(`hashtree:root:${core.userPubkey}:${treeName}:${state.counters.root}`, { kind: 30064, pubkey: core.userPubkey, tags, content: request.content ?? '', created_at: Math.floor(core.clockNow() / 1000) });
  const root: MockHashtreeRoot = { cid, author: core.userPubkey, treeName, visibility, event, ...(request.shareSecret ? { shareSecret: request.shareSecret } : {}) };
  state.roots.set(`${core.userPubkey}/${treeName}`, root);
  return root;
}

function rootRef(core: HashtreeCore, root: MockHashtreeRoot): string {
  return `htree://${core.userNpub}/${encodeURIComponent(root.treeName)}${root.shareSecret ? `#k=${root.shareSecret}` : root.visibility === 'private' ? '#private' : ''}`;
}

function shareSecretFor(visibility: HashtreeVisibility, treeName: string, supplied: string | undefined): string | undefined {
  return visibility === 'link-visible' ? supplied ?? mockHex(`share:${treeName}`) : undefined;
}

function pinAt(core: HashtreeCore, state: MockHashtreeState, cid: HashtreeCid, bytesStored: number): void {
  state.pins.set(cid.nhash!, { ref: cid.nhash!, cid, bytesStored, createdAt: Math.floor(core.clockNow() / 1000) });
}

function defaultFileSet(state: MockHashtreeState, directory: boolean): HashtreeRuntimeFileSet {
  state.counters.fileSet += 1;
  const files = LINUX_DISTROS.map((image) => toEntry(state.nodes.get(image.sha256)!, `${image.id}/${image.fileName}`));
  const chosen = directory ? files : files.slice(0, 1);
  return { runtimeFileSetId: `fs-${state.counters.fileSet}`, files: chosen, totalBytes: chosen.reduce((sum, file) => sum + (file.size ?? 0), 0), displayName: directory ? MOCK_HASHTREE_TREE_NAME : chosen[0]!.name! };
}

function advanceOne(core: HashtreeCore, state: MockHashtreeState, jobId: string, job: MockHashtreeJob): boolean {
  if (job.status.state !== 'queued' && job.status.state !== 'running') return false;
  job.step += 1;
  const done = job.step >= job.steps;
  const processed = done ? job.status.totalBytes : Math.floor((job.status.totalBytes * job.step) / job.steps);
  job.status = { ...job.status, state: done ? 'complete' : 'running', processedBytes: processed, progress: done ? 1 : job.step / job.steps, ...(done ? job.outcome : {}) };
  if (done) { state.timers.get(jobId)?.(); state.timers.delete(jobId); }
  if (core.service) pushToWindow(core.service, job.windowId, { type: done ? 'hashtree.done' : 'hashtree.progress', jobId, status: job.status } as NappletMessage);
  return true;
}

function scheduleAdvance(core: HashtreeCore, state: MockHashtreeState, jobId: string, delayMs: number): void {
  state.timers.set(jobId, core.scheduler.schedule(delayMs, () => {
    state.timers.delete(jobId);
    const job = state.jobs.get(jobId);
    if (job && advanceOne(core, state, jobId, job) && job.step < job.steps) scheduleAdvance(core, state, jobId, delayMs);
  }));
}

function startJob(core: HashtreeCore, context: Ctx, kind: 'import' | 'export', totalBytes: number, outcome: Partial<HashtreeJobStatus>): HashtreeJobStatus {
  const { state, windowId } = context;
  state.counters.job += 1;
  const jobId = `ht-${state.counters.job}`;
  const status: HashtreeJobStatus = { ok: true, jobId, kind, state: 'queued', processedBytes: 0, totalBytes, progress: 0 };
  state.jobs.set(jobId, { windowId, status, step: 0, steps: core.steps, outcome });
  if (core.autoAdvanceMs !== undefined) scheduleAdvance(core, state, jobId, core.autoAdvanceMs);
  return status;
}

type TreeLevel = Map<string, MockHashtreeNode | TreeLevel>;
type PutTreeEntry = { path?: string; data?: unknown; cid?: HashtreeCid; mime?: string };

function buildTree(state: MockHashtreeState, entries: PutTreeEntry[], visibility: HashtreeVisibility): { root: MockHashtreeNode; total: number } | { error: string } {
  const tree: TreeLevel = new Map();
  let total = 0;
  for (const entry of entries) {
    const segments = typeof entry.path === 'string' ? entry.path.split('/') : [];
    if (segments.length === 0 || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return { error: 'invalid-path' };
    let node: MockHashtreeNode | undefined;
    if (entry.cid) node = state.nodes.get(entry.cid.hash);
    else {
      const bytes = toBytes(entry.data);
      if (!bytes) return { error: 'invalid-request' };
      node = storeFile(state, bytes, segments.at(-1)!, entry.mime, visibility).node;
    }
    if (!node) return { error: 'not-found' };
    total += node.bytes?.length ?? 0;
    let level = tree;
    for (const segment of segments.slice(0, -1)) {
      if (!(level.get(segment) instanceof Map)) level.set(segment, new Map());
      level = level.get(segment) as TreeLevel;
    }
    level.set(segments.at(-1)!, node);
  }
  const build = (name: string, level: TreeLevel): MockHashtreeNode => {
    const children = new Map<string, MockHashtreeNode>();
    for (const [childName, value] of level) children.set(childName, value instanceof Map ? build(childName, value) : value);
    return storeDir(state, name, children);
  };
  return { root: build('', tree), total };
}

function readRoutes(core: HashtreeCore): Record<string, MockRoute<MockHashtreeState>> {
  return {
    'hashtree.capabilities': ({ reply }) => reply({ capabilities: core.capabilities }),
    'hashtree.parseRef': ({ message, reply }) => {
      const ref = parseHashtreeRef(message.ref as string);
      reply({ result: ref ? { ok: true, ref } : { ok: false, error: 'invalid-ref' } });
    },
    'hashtree.resolve': ({ message, state, reply }) => {
      const located = locate(core, state, message.ref);
      reply({ result: located.ok ? { ok: true, root: located.root } : { ok: false, error: located.error, ...(located.reason ? { reason: located.reason } : {}) } });
    },
    'hashtree.stat': ({ message, state, reply }) => {
      const located = locate(core, state, message.ref);
      reply({ result: located.ok ? { ok: true, entry: toEntry(located.node, located.path, located.root.cid.key) } : { ok: false, error: located.error } });
    },
    'hashtree.list': ({ message, state, reply }) => {
      const located = locate(core, state, message.ref);
      if (!located.ok) { reply({ result: { ok: false, entries: [], error: located.error } }); return; }
      if (located.node.type !== 'dir') { reply({ result: { ok: false, entries: [], error: 'not-directory' } }); return; }
      const listOptions = (message.options ?? {}) as { recursive?: boolean; limit?: number };
      const entries: HashtreeEntry[] = [];
      listEntries(state, located.node, '', listOptions.recursive === true, entries);
      const limit = typeof listOptions.limit === 'number' ? listOptions.limit : entries.length;
      reply({ result: { ok: true, entries: entries.slice(0, limit), root: located.root, ...(entries.length > limit ? { truncated: true } : {}) } });
    },
    'hashtree.read': ({ message, state, reply }) => {
      const located = locate(core, state, message.ref);
      if (!located.ok) { reply({ result: { ok: false, error: located.error } }); return; }
      if (located.node.type === 'dir') { reply({ result: { ok: false, error: 'is-directory' } }); return; }
      const readOptions = (message.options ?? {}) as { offset?: number; length?: number; maxBytes?: number };
      const bytes = located.node.bytes!;
      const offset = Math.max(0, readOptions.offset ?? 0);
      if ((readOptions.length ?? 0) > core.maxRead) { reply({ result: { ok: false, error: 'too-large' } }); return; }
      const length = Math.min(readOptions.length ?? bytes.length - offset, readOptions.maxBytes ?? core.maxRead);
      reply({ result: { ok: true, blob: bytes.slice(offset, offset + length).buffer, entry: toEntry(located.node, located.path, located.root.cid.key), root: located.root } });
    },
  };
}

function writeRoutes(core: HashtreeCore): Record<string, MockRoute<MockHashtreeState>> {
  return {
    'hashtree.putBytes': ({ message, state, reply }) => {
      const request = message.request as { data?: unknown; options?: { visibility?: HashtreeVisibility; mime?: string; filename?: string; pin?: boolean } } | undefined;
      const bytes = toBytes(request?.data);
      if (!bytes) { reply({ result: { ok: false, error: 'invalid-request', reason: 'data must be bytes' } }); return; }
      if (bytes.length > core.maxWrite) { reply({ result: { ok: false, error: 'too-large' } }); return; }
      const putOptions = request!.options ?? {};
      const { node, key } = storeFile(state, bytes, putOptions.filename ?? placeholderSha256(bytes), putOptions.mime, putOptions.visibility ?? 'public');
      const cid = cidOf(node, key);
      if (putOptions.pin) pinAt(core, state, cid, bytes.length);
      reply({ result: { ok: true, cid, entry: toEntry(node, node.name, key), size: bytes.length } });
    },
    'hashtree.putTree': ({ message, state, reply }) => {
      const request = message.request as { entries?: PutTreeEntry[]; options?: { visibility?: HashtreeVisibility; pin?: boolean } } | undefined;
      if (!Array.isArray(request?.entries) || request.entries.length === 0) { reply({ result: { ok: false, error: 'invalid-tree' } }); return; }
      const visibility = request.options?.visibility ?? 'public';
      const built = buildTree(state, request.entries, visibility);
      if ('error' in built) { reply({ result: { ok: false, error: built.error } }); return; }
      const cid = cidOf(built.root, visibility === 'unencrypted' ? undefined : mockHex(`chk:${built.root.hash}`));
      if (request.options?.pin) pinAt(core, state, cid, built.total);
      reply({ result: { ok: true, cid, entry: toEntry(built.root, '', cid.key), size: built.total } });
    },
    'hashtree.publishRoot': ({ message, state, reply }) => {
      const request = message.request as { cid?: HashtreeCid; treeName?: string; content?: string; visibility?: HashtreeVisibility; shareSecret?: string; relays?: string[] } | undefined;
      if (!request?.cid?.hash || typeof request.treeName !== 'string' || request.treeName === '') { reply({ result: { ok: false, error: 'invalid-request' } }); return; }
      if (!core.signedIn) { reply({ result: { ok: false, error: 'not-signed-in' } }); return; }
      if (!state.nodes.has(request.cid.hash)) { reply({ result: { ok: false, error: 'not-found' } }); return; }
      const visibility = request.visibility ?? 'public';
      const root = publish(core, state, { cid: request.cid, treeName: request.treeName, visibility, shareSecret: shareSecretFor(visibility, request.treeName, request.shareSecret), content: request.content });
      const relays = Object.fromEntries((request.relays ?? [...MOCK_RELAY_URLS]).map((relay) => [relay, true]));
      reply({ result: { ok: true, eventId: root.event.id, event: root.event, ref: rootRef(core, root), relays } });
    },
  };
}

function importRoute(core: HashtreeCore, context: Ctx): void {
  const { windowId, message, state, reply } = context;
  const request = message.request as { runtimeFileSetId?: string; visibility?: HashtreeVisibility; pin?: boolean; publish?: { treeName: string; visibility?: HashtreeVisibility; shareSecret?: string; content?: string } } | undefined;
  const owned = typeof request?.runtimeFileSetId === 'string' ? state.fileSets.get(request.runtimeFileSetId) : undefined;
  if (!owned || owned.windowId !== windowId) { reply({ ack: { ok: false, error: 'not-found' } }); return; }
  const visibility = request!.visibility ?? 'public';
  const rootHash = owned.fileSet.displayName === MOCK_HASHTREE_TREE_NAME ? MOCK_HASHTREE_ROOT_HASH : owned.fileSet.files[0]?.cid.hash ?? mockHex(`import:${owned.fileSet.runtimeFileSetId}`);
  const key = visibility === 'unencrypted' ? undefined : mockHex(`chk:${rootHash}`);
  const cid: HashtreeCid = { hash: rootHash, ...(key ? { key } : {}), nhash: encodeNhash(rootHash, key) };
  const outcome: Partial<HashtreeJobStatus> = { cid };
  const target = request!.publish;
  if (target?.treeName && core.signedIn) {
    const publishVisibility = target.visibility ?? visibility;
    outcome.ref = rootRef(core, publish(core, state, { cid, treeName: target.treeName, visibility: publishVisibility, shareSecret: shareSecretFor(publishVisibility, target.treeName, target.shareSecret), content: target.content }));
  }
  if (request!.pin) pinAt(core, state, cid, owned.fileSet.totalBytes);
  const status = startJob(core, context, 'import', owned.fileSet.totalBytes, outcome);
  reply({ ack: { ok: true, jobId: status.jobId, state: status.state } });
}

function jobRoutes(core: HashtreeCore): Record<string, MockRoute<MockHashtreeState>> {
  return {
    'hashtree.pickFiles': ({ windowId, message, state, reply }) => {
      const scripted = state.nextPick;
      state.nextPick = undefined;
      if (scripted === 'cancel') { reply({ result: { ok: false, error: 'file-pick-cancelled' } }); return; }
      const fileSet = scripted ?? defaultFileSet(state, (message.options as { directory?: boolean } | undefined)?.directory === true);
      state.fileSets.set(fileSet.runtimeFileSetId, { windowId, fileSet });
      reply({ result: { ok: true, fileSet } });
    },
    'hashtree.importFiles': (context) => importRoute(core, context),
    'hashtree.exportFiles': (context) => {
      const { windowId, message, state, reply } = context;
      const request = message.request as { ref?: string; destination?: string } | undefined;
      const located = locate(core, state, request?.ref);
      if (!located.ok) { reply({ ack: { ok: false, error: located.error } }); return; }
      state.counters.fileSet += 1;
      const runtimeFileSetId = `fs-${state.counters.fileSet}`;
      const files: HashtreeEntry[] = [];
      if (located.node.type === 'dir') listEntries(state, located.node, '', true, files);
      else files.push(toEntry(located.node, located.path));
      const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
      state.fileSets.set(runtimeFileSetId, { windowId, fileSet: { runtimeFileSetId, files, totalBytes, displayName: located.node.name } });
      const status = startJob(core, context, 'export', totalBytes, { runtimeFileSetId, cid: located.root.cid, ref: request!.ref! });
      reply({ ack: { ok: true, jobId: status.jobId, state: status.state } });
    },
    'hashtree.pins': ({ state, reply }) => reply({ pins: [...state.pins.values()] }),
    'hashtree.pin': ({ message, state, reply }) => {
      const request = message.request as { ref?: string; label?: string } | undefined;
      const located = locate(core, state, request?.ref);
      if (!located.ok) { reply({ result: { ok: false, error: located.error } }); return; }
      const size = located.node.type === 'file' ? located.node.bytes!.length : 0;
      const pin: HashtreePin = { ref: request!.ref!, cid: located.root.cid, ...(request!.label ? { label: request!.label } : {}), bytesStored: size, createdAt: Math.floor(core.clockNow() / 1000) };
      state.pins.set(pin.ref, pin);
      reply({ result: { ok: true, pin } });
    },
    'hashtree.unpin': ({ message, state, reply }) => {
      const pin = typeof message.ref === 'string' ? state.pins.get(message.ref) : undefined;
      if (!pin) { reply({ result: { ok: false, error: 'not-found' } }); return; }
      state.pins.delete(pin.ref);
      reply({ result: { ok: true, pin } });
    },
    'hashtree.job': ({ windowId, message, state, reply, fail }) => {
      const job = typeof message.jobId === 'string' ? state.jobs.get(message.jobId) : undefined;
      if (!job || job.windowId !== windowId) { fail('job-not-found'); return; }
      reply({ status: job.status });
    },
    'hashtree.cancel': ({ windowId, message, state, reply, fail }) => {
      const jobId = message.jobId;
      const job = typeof jobId === 'string' ? state.jobs.get(jobId) : undefined;
      if (!job || job.windowId !== windowId) { fail('job-not-found'); return; }
      if (job.status.state === 'queued' || job.status.state === 'running') {
        state.timers.get(jobId as string)?.();
        state.timers.delete(jobId as string);
        job.status = { ...job.status, state: 'cancelled' };
      }
      reply({ status: job.status });
    },
  };
}

function initialState(): MockHashtreeState {
  const seededRoot: MockHashtreeRoot = { cid: { hash: MOCK_HASHTREE_ROOT_HASH, nhash: encodeNhash(MOCK_HASHTREE_ROOT_HASH) }, author: MOCK_HASHTREE_AUTHOR, treeName: MOCK_HASHTREE_TREE_NAME, visibility: 'unencrypted', event: MOCK_HASHTREE_ROOT_EVENT };
  return {
    nodes: new Map(MOCK_HASHTREE_NODES),
    roots: new Map([[`${MOCK_HASHTREE_AUTHOR}/${MOCK_HASHTREE_TREE_NAME}`, seededRoot]]),
    pins: new Map(),
    jobs: new Map(),
    fileSets: new Map(),
    timers: new Map(),
    counters: { job: 0, fileSet: 0, root: 0 },
  };
}

function attachControls(core: HashtreeCore, service: MockHashtreeService): void {
  const baseReset = service.mock.reset;
  Object.defineProperty(service.mock, 'reset', {
    value: () => {
      for (const cancel of service.mock.state().timers.values()) cancel();
      baseReset();
    },
  });
  Object.defineProperty(service, 'advance', {
    value: (jobId?: string): boolean => {
      const state = service.mock.state();
      const jobs = jobId ? [[jobId, state.jobs.get(jobId)] as const] : [...state.jobs.entries()];
      let advanced = false;
      for (const [id, job] of jobs) if (job && advanceOne(core, state, id, job)) advanced = true;
      return advanced;
    },
  });
  Object.defineProperty(service, 'failJob', {
    value: (jobId: string, error = 'store-failed'): boolean => {
      const state = service.mock.state();
      const job = state.jobs.get(jobId);
      if (!job || (job.status.state !== 'queued' && job.status.state !== 'running')) return false;
      state.timers.get(jobId)?.();
      state.timers.delete(jobId);
      job.status = { ...job.status, ok: false, state: 'error', error };
      pushToWindow(service, job.windowId, { type: 'hashtree.error', jobId, error } as NappletMessage);
      return true;
    },
  });
  Object.defineProperty(service, 'setNextPick', {
    value: (pick: HashtreeRuntimeFileSet | 'cancel'): void => { service.mock.state().nextPick = pick; },
  });
}

/**
 * Create the NAP-HASHTREE mock.
 *
 * @param options - Capabilities, signer state, job pacing, and shared mock options.
 * @returns An `extension`-kind mock for the `hashtree` domain.
 * @example
 * ```ts
 * const hashtree = createMockHashtreeService();
 * hashtree.handleMessage('w1', { type: 'hashtree.list', id: 'l1', ref: `htree://${MOCK_HASHTREE_AUTHOR}/distros` }, send);
 * ```
 */
export function createMockHashtreeService(options: MockHashtreeOptions = {}): MockHashtreeService {
  const capabilities: HashtreeCapabilities = { ...DEFAULT_CAPABILITIES, ...options.capabilities };
  const userPubkey = options.userPubkey ?? mockPubkey('alice');
  const core: HashtreeCore = {
    capabilities,
    signedIn: options.signedIn ?? true,
    userPubkey,
    userNpub: encodeBech32('npub', hexToBytes(userPubkey)),
    steps: Math.max(1, options.jobSteps ?? 2),
    scheduler: options.scheduler ?? DEFAULT_SCHEDULER,
    clockNow: () => (options.clock ?? DEFAULT_CLOCK).now(),
    maxRead: capabilities.maxReadBytes ?? Number.POSITIVE_INFINITY,
    maxWrite: capabilities.maxWriteBytes ?? Number.POSITIVE_INFINITY,
    autoAdvanceMs: options.autoAdvanceMs,
    service: undefined,
  };
  const service = defineMockService<MockHashtreeState>({
    domain: 'hashtree',
    version: '1.0.0',
    description: 'Mock NAP-HASHTREE: seeded distro document tree with jobs and pins',
    kind: 'extension',
    pushes: { 'hashtree.progress': null, 'hashtree.done': null, 'hashtree.error': null },
    initialState,
    routes: { ...readRoutes(core), ...writeRoutes(core), ...jobRoutes(core) },
    onWindowDestroyed: (windowId, state) => {
      for (const [jobId, job] of state.jobs) {
        if (job.windowId !== windowId) continue;
        state.timers.get(jobId)?.();
        state.timers.delete(jobId);
        state.jobs.delete(jobId);
      }
      for (const [id, owned] of state.fileSets) if (owned.windowId === windowId) state.fileSets.delete(id);
    },
  }, options) as MockHashtreeService;
  core.service = service;
  attachControls(core, service);
  return service;
}

/** Registry row for the `hashtree` domain. */
export const HASHTREE_MOCK_ENTRY: MockDomainEntry = {
  domain: 'hashtree',
  kind: 'extension',
  spec: HASHTREE_SPEC_REF,
  create: (options) => createMockHashtreeService(options),
};
