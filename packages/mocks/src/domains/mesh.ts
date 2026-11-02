/**
 * domains/mesh.ts — Mock NAP-MESH extension.
 *
 * Spec: naps/NAP-MESH.md @ napplet/naps PR #122 head bf9a4722244e (draft)
 * Routes: mesh.info, mesh.publish, mesh.subscribe, mesh.close, mesh.blobs
 * Pushes: mesh.event, mesh.eose, mesh.closed
 * Spec gaps / decisions:
 * - The circle is a fixed seeded graph: five fixture accounts at 1–3 hops.
 *   A publish "reaches" every reachable member within the clamped budget;
 *   reach is recorded in `state.reach` so a test can assert the fan-out.
 * - Member backlog is delivered synchronously right after `mesh.eose`
 *   (the draft allows either side of eose).
 * - Error strings are not fixed by the draft; the mock uses `invalid
 *   template`, `invalid ttl`, `missing subId`, `invalid filters`,
 *   `invalid hashes`, `too many hashes`, `mesh not granted`.
 * - Re-subscribing with a live `subId` replaces the old subscription.
 * - Offline circle: publish still works locally (budget reported after
 *   clamp, reach empty); `info.peers` and `blobs.peers` are 0.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { NostrEvent, NostrFilter } from '@napplet/core';
import { DEFAULT_CLOCK, defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { MOCK_ACCOUNTS, MOCK_EVENTS, buildMockEvent, matchesNostrFilter, type MockAccount } from '../fixtures/nostr.js';

/**
 * NAP-MESH draft the mock implements.
 *
 * @example
 * ```ts
 * MESH_SPEC_REF.pr === 122;
 * ```
 */
export const MESH_SPEC_REF: NapSpecRef = {
  nap: 'NAP-MESH',
  status: 'draft',
  source: 'pr',
  pr: 122,
  sha: 'bf9a4722244e',
  path: 'naps/NAP-MESH.md',
};

/**
 * One circle member as seen from this device.
 *
 * @example
 * ```ts
 * const bob = service.mock.state().members.find((m) => m.name === 'bob');
 * bob?.hops === 1;
 * ```
 */
export interface MockMeshMember {
  /** Fixture account name. */
  name: string;
  /** Member pubkey. */
  pubkey: string;
  /** Circle hops from this device (1 = paired directly). */
  hops: number;
  /** Whether the member is reachable right now. */
  reachable: boolean;
  /** sha256 hashes of blobs the member holds. */
  blobs: string[];
  /** Events kept on the member's device (its backlog). */
  kept: NostrEvent[];
}

/**
 * One live subscription.
 *
 * @example
 * ```ts
 * service.mock.state().subscriptions.get('win-1:room')?.ttl;
 * ```
 */
export interface MockMeshSubscription {
  /** Napplet-chosen id. */
  subId: string;
  /** Owning window. */
  windowId: string;
  /** NIP-01 filters. */
  filters: NostrFilter[];
  /** Effective backlog hop budget. */
  ttl: number;
  /** Event ids already delivered (dedupe). */
  delivered: Set<string>;
}

/**
 * In-memory state of the mock mesh extension.
 *
 * @example
 * ```ts
 * service.mock.state().reach.get(eventId); // member names that received it
 * ```
 */
export interface MockMeshState {
  /** Circle transport running. */
  online: boolean;
  /** The user's hop caps. */
  limits: { publishTtl: number; subscribeTtl: number };
  /** The shell user. */
  owner: MockAccount;
  /** Circle members. */
  members: MockMeshMember[];
  /** Non-ephemeral events kept on this device. */
  kept: NostrEvent[];
  /** `${windowId}:${subId}` → subscription. */
  subscriptions: Map<string, MockMeshSubscription>;
  /** Published event id → member names it reached. */
  reach: Map<string, Set<string>>;
}

/**
 * Options for `createMockMeshService`.
 *
 * @example
 * ```ts
 * const mesh = createMockMeshService({ publishTtl: 1, subscribeTtl: 1 });
 * ```
 */
export interface MockMeshOptions extends MockServiceOptions {
  /** Publish hop cap. Default 3. */
  publishTtl?: number;
  /** Subscribe backlog hop cap. Default 2. */
  subscribeTtl?: number;
  /** Initial transport state. Default `true`. */
  online?: boolean;
}

/**
 * Mock mesh extension with circle controls.
 *
 * @example
 * ```ts
 * const mesh = createMockMeshService();
 * mesh.inject('bob', { kind: 1, content: 'hello from bob' });
 * ```
 */
export type MockMeshService = MockService<MockMeshState> & {
  /** A member's event arrives at this device; returns the signed event, or `undefined` for a non-member. */
  inject(fromName: string, template: { kind: number; content: string; tags?: string[][] }): NostrEvent | undefined;
  /** Bring the circle transport up or down. */
  setOnline(online: boolean): void;
};

type Context = MockRouteContext<MockMeshState>;

const HEX64 = /^[0-9a-f]{64}$/;
const SEED_MEMBERS: ReadonlyArray<{ name: string; hops: number; blobs: readonly number[] }> = Object.freeze([
  { name: 'bob', hops: 1, blobs: [0, 3] },
  { name: 'carol', hops: 1, blobs: [0, 1, 2, 3, 4, 5, 6, 7] },
  { name: 'dave', hops: 2, blobs: [2] },
  { name: 'erin', hops: 2, blobs: [] },
  { name: 'frank', hops: 3, blobs: [6, 7] },
]);

function isEphemeral(kind: number): boolean {
  return kind >= 20_000 && kind <= 29_999;
}

function validTtl(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isTemplate(value: unknown): value is { kind: number; content: string; tags?: string[][] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(data.kind) || (data.kind as number) < 0 || typeof data.content !== 'string') return false;
  return data.tags === undefined || (Array.isArray(data.tags) && data.tags.every((tag) => Array.isArray(tag) && tag.every((item) => typeof item === 'string')));
}

function parseFilters(value: unknown): NostrFilter[] | null {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) return null;
  for (const item of items) if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
  return items as NostrFilter[];
}

function seedState(options: MockMeshOptions): MockMeshState {
  const owner = MOCK_ACCOUNTS[0] as MockAccount;
  const members = SEED_MEMBERS.map((seed) => {
    const account = MOCK_ACCOUNTS.find((item) => item.name === seed.name) as MockAccount;
    return {
      name: seed.name,
      pubkey: account.pubkey,
      hops: seed.hops,
      reachable: true,
      blobs: seed.blobs.map((index) => (LINUX_DISTROS[index] as (typeof LINUX_DISTROS)[number]).sha256),
      kept: MOCK_EVENTS.filter((event) => event.kind === 1 && event.pubkey === account.pubkey),
    };
  });
  return {
    online: options.online ?? true,
    limits: { publishTtl: options.publishTtl ?? 3, subscribeTtl: options.subscribeTtl ?? 2 },
    owner,
    members,
    kept: [],
    subscriptions: new Map(),
    reach: new Map(),
  };
}

function reachablePeers(state: MockMeshState): MockMeshMember[] {
  return state.online ? state.members.filter((item) => item.hops === 1 && item.reachable) : [];
}

function infoRoute({ state, reply }: Context): void {
  reply({ online: state.online, peers: reachablePeers(state).length, limits: { ...state.limits } });
}

function blobsRoute({ message, state, reply, fail }: Context): void {
  const hashes = message.hashes;
  if (!Array.isArray(hashes) || !hashes.every((item) => typeof item === 'string' && HEX64.test(item))) { fail('invalid hashes'); return; }
  if (hashes.length > 64) { fail('too many hashes'); return; }
  const peers = reachablePeers(state);
  const blobs: Record<string, number> = {};
  for (const hash of hashes as string[]) blobs[hash] = peers.filter((member) => member.blobs.includes(hash)).length;
  reply({ peers: peers.length, blobs });
}

/**
 * Create the mock NAP-MESH extension.
 *
 * @param options - Hop caps and transport state.
 * @returns An extension handler (every route published with `null` capability) with mock controls.
 * @example
 * ```ts
 * const mesh = createMockMeshService();
 * mesh.handleMessage('win-1', { type: 'mesh.info', id: 'i1' }, console.log);
 * ```
 */
export function createMockMeshService(options: MockMeshOptions = {}): MockMeshService {
  const deliver = (sub: MockMeshSubscription, event: NostrEvent): void => {
    if (sub.delivered.has(event.id) || !sub.filters.some((filter) => matchesNostrFilter(event, filter))) return;
    sub.delivered.add(event.id);
    pushToWindow(service, sub.windowId, { type: 'mesh.event', subId: sub.subId, result: { event } } as NappletMessage);
  };
  const deliverAll = (state: MockMeshState, event: NostrEvent): void => {
    for (const sub of state.subscriptions.values()) deliver(sub, event);
  };
  const now = (context: Context): number => Math.floor(context.clock.now() / 1000);

  const publishRoute = (context: Context): void => {
    const { message, windowId, state, reply, rng } = context;
    if (!isTemplate(message.event)) { reply({ ok: false, error: 'invalid template' }); return; }
    if (message.ttl !== undefined && !validTtl(message.ttl)) { reply({ ok: false, error: 'invalid ttl' }); return; }
    const ttl = Math.min(message.ttl ?? state.limits.publishTtl, state.limits.publishTtl);
    const template = message.event;
    const event = buildMockEvent(`mesh:${windowId}:${rng.hex(8)}`, {
      kind: template.kind, pubkey: state.owner.pubkey, content: template.content, tags: template.tags ?? [], created_at: now(context),
    });
    if (!isEphemeral(event.kind)) state.kept.push(event);
    const reached = state.online ? state.members.filter((member) => member.reachable && member.hops <= ttl) : [];
    state.reach.set(event.id, new Set(reached.map((member) => member.name)));
    for (const member of reached) if (!isEphemeral(event.kind)) member.kept.push(event);
    reply({ ok: true, event, eventId: event.id, ttl });
    deliverAll(state, event);
  };

  const subscribeRoute = ({ message, windowId, state, fail }: Context): void => {
    if (typeof message.subId !== 'string' || message.subId.length === 0) { fail('missing subId'); return; }
    const filters = parseFilters(message.filters);
    if (!filters) { fail('invalid filters'); return; }
    if (message.ttl !== undefined && !validTtl(message.ttl)) { fail('invalid ttl'); return; }
    const ttl = Math.min(message.ttl ?? state.limits.subscribeTtl, state.limits.subscribeTtl);
    const sub: MockMeshSubscription = { subId: message.subId, windowId, filters, ttl, delivered: new Set() };
    state.subscriptions.set(`${windowId}:${sub.subId}`, sub);
    for (const event of state.kept) deliver(sub, event);
    pushToWindow(service, windowId, { type: 'mesh.eose', subId: sub.subId, ttl } as NappletMessage);
    if (!state.online) return;
    for (const member of state.members) {
      if (!member.reachable || member.hops > ttl) continue;
      for (const event of member.kept) deliver(sub, event);
    }
  };

  const closeRoute = ({ message, windowId, state }: Context): void => {
    if (typeof message.subId === 'string') state.subscriptions.delete(`${windowId}:${message.subId}`);
  };

  const base = defineMockService<MockMeshState>({
    domain: 'mesh',
    version: '1.0.0',
    description: 'Mock NAP-MESH: hop-limited publish/subscribe over a seeded circle of fixture accounts',
    kind: 'extension',
    pushes: { 'mesh.event': null, 'mesh.eose': null, 'mesh.closed': null },
    initialState: () => seedState(options),
    routes: {
      'mesh.info': infoRoute,
      'mesh.publish': publishRoute,
      'mesh.subscribe': subscribeRoute,
      'mesh.close': closeRoute,
      'mesh.blobs': blobsRoute,
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [key, sub] of state.subscriptions) if (sub.windowId === windowId) state.subscriptions.delete(key);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability !== null && !capability.startsWith('mesh')) return;
      for (const [key, sub] of state.subscriptions) {
        if (sub.windowId !== windowId) continue;
        state.subscriptions.delete(key);
        pushToWindow(service, windowId, { type: 'mesh.closed', subId: sub.subId, reason: 'mesh not granted' } as NappletMessage);
      }
    },
  }, options);

  const service: MockMeshService = Object.assign(base, {
    inject(fromName: string, template: { kind: number; content: string; tags?: string[][] }): NostrEvent | undefined {
      const state = base.mock.state();
      const member = state.members.find((item) => item.name === fromName);
      if (!member || !state.online || !isTemplate(template)) return undefined;
      const stamp = Math.floor((options.clock ?? DEFAULT_CLOCK).now() / 1000);
      const event = buildMockEvent(`mesh:inject:${member.name}:${member.kept.length}`, {
        kind: template.kind, pubkey: member.pubkey, content: template.content, tags: template.tags ?? [], created_at: stamp,
      });
      if (!isEphemeral(event.kind)) { state.kept.push(event); member.kept.push(event); }
      deliverAll(state, event);
      return event;
    },
    setOnline(online: boolean): void {
      base.mock.state().online = online;
    },
  });
  return service;
}

/**
 * Registry row for the `mesh` domain.
 *
 * @example
 * ```ts
 * MESH_MOCK_ENTRY.create?.({ seed: 1 }).descriptor.name === 'mesh';
 * ```
 */
export const MESH_MOCK_ENTRY: MockDomainEntry = {
  domain: 'mesh',
  kind: 'extension',
  spec: MESH_SPEC_REF,
  create: (options) => createMockMeshService(options),
};
