/**
 * domains/identity.ts — Mock NAP-IDENTITY service.
 *
 * Spec: naps/NAP-IDENTITY.md @ napplet/naps master 43cb3a4e8555 (merged)
 * Routes: identity.getPublicKey, identity.getRelays, identity.getProfile,
 *         identity.getFollows, identity.getList, identity.getZaps,
 *         identity.getMutes, identity.getBlocked, identity.getBadges
 * Spec gaps / decisions:
 * - The shell user defaults to `alice`; profile (kind 0), relays (kind
 *   10002), follows (kind 3), mutes (kind 10000) and categorized lists come
 *   from the shared store so mutations through common/lists are visible here.
 * - `identity.getList` maps `listType` names to NIP-51 kinds: `bookmarks`
 *   (10003), `interests` (10015), `pins`/`pinned` (10001), `mutes` (10000),
 *   `communities` (10004), `emojis` (10030). Unknown names answer
 *   `entries: []` with `error: "unsupported list type"` as the NAP lists it.
 * - NIP-51 defines no pubkey block list, so `identity.getBlocked` returns
 *   `[]` without error (the NAP allows empty results for unsupported data).
 * - Zap receipts and badges are state-only fixtures (not kind 9735/8 events
 *   in the store) to keep the store focused on NIP-01 social kinds.
 * - When signed out, `getPublicKey` answers `""` and the other queries
 *   answer their empty defaults without `error`, since "no user" is not a
 *   failure in the NAP.
 * - `signIn()` / `signOut()` push `identity.changed` to every window that has
 *   talked to the mock (or to every runtime window when attached).
 */
import type { NappletMessage } from '@napplet/core';
import type { Badge, IdentityGetListMessage, ProfileData, RelayPermission, ZapReceipt } from '@napplet/nap/identity/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import { mockEventId } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { findMockAccount } from '../fixtures/nostr.js';
import { asRequest, createMockNostrStore, resolveMockUser, type MockNostrStore } from './nostr-store.js';

/** Spec document the mock was written against. */
export const IDENTITY_SPEC_REF: NapSpecRef = {
  nap: 'NAP-IDENTITY',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-IDENTITY.md',
};

/**
 * In-memory state of the identity mock.
 *
 * @example
 * ```ts
 * const state = createMockIdentityService().mock.state();
 * state.user === MOCK_ACCOUNTS[0].pubkey;
 * ```
 */
export interface MockIdentityState {
  /** Shared event store. */
  store: MockNostrStore;
  /** Current shell-user pubkey, or `''` when signed out. */
  user: string;
  /** Zap receipts reported by `identity.getZaps`. */
  zaps: ZapReceipt[];
  /** Badges reported by `identity.getBadges`. */
  badges: Badge[];
  /** Windows that have sent an identity request (recipients of `identity.changed`). */
  windows: Set<string>;
}

/**
 * Options for `createMockIdentityService`.
 *
 * @example
 * ```ts
 * const identity = createMockIdentityService({ user: 'bob' });
 * ```
 */
export interface MockIdentityOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Shell user (fixture name or hex pubkey); `''` starts signed out. Default `alice`. */
  user?: string;
  /** Zap receipts override. */
  zaps?: readonly ZapReceipt[];
  /** Badges override. */
  badges?: readonly Badge[];
}

/**
 * Identity mock with sign-in controls.
 *
 * @example
 * ```ts
 * const identity = createMockIdentityService();
 * identity.signOut();           // pushes identity.changed { pubkey: '' }
 * identity.signIn('bob');       // pushes identity.changed { pubkey: <bob> }
 * ```
 */
export type MockIdentityService = MockService<MockIdentityState> & {
  /** Switch the shell user and push `identity.changed`. */
  signIn(user: string): void;
  /** Clear the shell user and push `identity.changed { pubkey: '' }`. */
  signOut(): void;
};

/** `listType` → NIP-51 kind and the tag names whose values are returned. */
const LIST_TYPES: Readonly<Record<string, { kind: number; tags: readonly string[] }>> = Object.freeze({
  bookmarks: { kind: 10003, tags: ['e', 'a', 't', 'r'] },
  interests: { kind: 10015, tags: ['t', 'a'] },
  pins: { kind: 10001, tags: ['e'] },
  pinned: { kind: 10001, tags: ['e'] },
  mutes: { kind: 10000, tags: ['p'] },
  communities: { kind: 10004, tags: ['a'] },
  emojis: { kind: 10030, tags: ['emoji', 'a'] },
});

function defaultZaps(): ZapReceipt[] {
  const bob = findMockAccount('bob')!;
  const carol = findMockAccount('carol')!;
  return [
    { eventId: mockEventId('zap:bob:alice:1'), sender: bob.pubkey, amount: 21_000, content: 'Great post!' },
    { eventId: mockEventId('zap:carol:alice:1'), sender: carol.pubkey, amount: 5_000 },
  ];
}

function defaultBadges(): Badge[] {
  const erin = findMockAccount('erin')!;
  return [{
    id: `30009:${erin.pubkey}:early-adopter`,
    name: 'Early Adopter',
    description: 'Joined the mock relay before launch.',
    image: 'https://badges.example.org/early-adopter.png',
    thumbs: ['https://badges.example.org/early-adopter-64.png'],
    awardedBy: erin.pubkey,
  }];
}

/**
 * Parse kind-0 content into `ProfileData` (snake_case keys normalized).
 *
 * @param content - Kind-0 JSON content.
 * @returns Profile fields, or `null` when the content is not a JSON object.
 * @example
 * ```ts
 * parseMockProfile('{"name":"alice","display_name":"Alice"}')?.displayName === 'Alice';
 * ```
 */
export function parseMockProfile(content: string): ProfileData | null {
  let raw: unknown;
  try { raw = JSON.parse(content); } catch { return null; }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const profile: ProfileData = {};
  const pick = (key: keyof ProfileData, ...sources: string[]): void => {
    for (const source of sources) {
      if (typeof record[source] === 'string') { profile[key] = record[source] as string; return; }
    }
  };
  pick('name', 'name');
  pick('displayName', 'display_name', 'displayName');
  pick('about', 'about');
  pick('picture', 'picture');
  pick('banner', 'banner');
  pick('nip05', 'nip05');
  pick('lud16', 'lud16');
  pick('website', 'website');
  return profile;
}

type IdentityContext = MockRouteContext<MockIdentityState>;

function tagValues(state: MockIdentityState, kind: number, tags: readonly string[]): string[] {
  if (state.user === '') return [];
  const event = state.store.latest(kind, state.user);
  return event ? event.tags.filter((tag) => tags.includes(tag[0] ?? '') && typeof tag[1] === 'string').map((tag) => tag[1] as string) : [];
}

function handleGetRelays({ state, reply }: IdentityContext): void {
  const relays: Record<string, RelayPermission> = {};
  if (state.user !== '') {
    for (const entry of state.store.relayList(state.user) ?? []) relays[entry.url] = { read: entry.read, write: entry.write };
  }
  reply({ relays });
}

function handleGetProfile({ state, reply }: IdentityContext): void {
  const event = state.user === '' ? undefined : state.store.latest(0, state.user);
  reply({ profile: event ? parseMockProfile(event.content) : null });
}

function handleGetList({ message, state, reply }: IdentityContext): void {
  const { listType } = asRequest<IdentityGetListMessage>(message);
  const spec = typeof listType === 'string' && Object.hasOwn(LIST_TYPES, listType) ? LIST_TYPES[listType] : undefined;
  if (!spec) {
    reply({ entries: [], error: 'unsupported list type' });
    return;
  }
  reply({ entries: tagValues(state, spec.kind, spec.tags) });
}

/**
 * Create the NAP-IDENTITY mock.
 *
 * @param options - Store, shell user, fixtures, and shared mock options.
 * @returns An identity `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const identity = createMockIdentityService();
 * identity.handleMessage('w1', { type: 'identity.getPublicKey', id: 'q1' }, console.log);
 * ```
 */
export function createMockIdentityService(options: MockIdentityOptions = {}): MockIdentityService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;

  const track = (context: IdentityContext): void => { context.state.windows.add(context.windowId); };
  const route = (handler: (context: IdentityContext) => void) => (context: IdentityContext): void => {
    track(context);
    handler(context);
  };

  const base = defineMockService<MockIdentityState>({
    domain: 'identity',
    version: '1.0.0',
    description: 'Mock NAP-IDENTITY: read-only shell-user identity over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return {
        store,
        user: resolveMockUser(options.user),
        zaps: [...(options.zaps ?? defaultZaps())],
        badges: [...(options.badges ?? defaultBadges())],
        windows: new Set(),
      };
    },
    routes: {
      'identity.getPublicKey': route(({ state, reply }) => reply({ pubkey: state.user })),
      'identity.getRelays': route(handleGetRelays),
      'identity.getProfile': route(handleGetProfile),
      'identity.getFollows': route(({ state, reply }) => reply({ pubkeys: tagValues(state, 3, ['p']) })),
      'identity.getList': route(handleGetList),
      'identity.getZaps': route(({ state, reply }) => reply({ zaps: state.user === '' ? [] : [...state.zaps] })),
      'identity.getMutes': route(({ state, reply }) => reply({ pubkeys: tagValues(state, 10000, ['p']) })),
      'identity.getBlocked': route(({ reply }) => reply({ pubkeys: [] })),
      'identity.getBadges': route(({ state, reply }) => reply({ badges: state.user === '' ? [] : [...state.badges] })),
    },
    onWindowDestroyed: (windowId, state) => { state.windows.delete(windowId); },
  }, options);

  const announce = (): void => {
    const state = service.mock.state();
    const windows = service.mock.runtime?.listWindowIds() ?? [...state.windows];
    for (const windowId of windows) pushToWindow(service, windowId, { type: 'identity.changed', pubkey: state.user } as NappletMessage);
  };

  const service: MockIdentityService = Object.assign(base, {
    signIn(user: string): void {
      service.mock.state().user = resolveMockUser(user);
      announce();
    },
    signOut(): void {
      service.mock.state().user = '';
      announce();
    },
  });
  return service;
}

/** Registry row for the identity domain. */
export const IDENTITY_MOCK_ENTRY: MockDomainEntry = {
  domain: 'identity',
  kind: 'service',
  spec: IDENTITY_SPEC_REF,
  create: (options) => createMockIdentityService(options),
};
