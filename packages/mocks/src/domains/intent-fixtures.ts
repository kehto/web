/**
 * domains/intent-fixtures.ts — Installed-napplet catalog shared by the
 * NAP-INTENT and NAP-CATALOG mocks so both report the same identifiers,
 * roles, and convention contracts.
 *
 * Manifests are modeled after NIP-5D `z` (role) and `i` (accepted
 * convention + parameter names) tags. Identities are deterministic
 * placeholders: pubkeys come from `fixtures/nostr.ts`, event ids and artifact
 * hashes from `mockHex`.
 */
import { mockEventId, mockHex } from '../core/rng.js';
import { findMockAccount } from '../fixtures/nostr.js';

/** Napplet manifest kinds recognized by catalogs. */
export type MockNappletKind = 5129 | 15129 | 35129;

/**
 * One accepted convention advertised by an `i` tag.
 *
 * @example
 * ```ts
 * const contract: MockIntentContract = { convention: 'napplet:profile/open', params: ['pubkey'] };
 * ```
 */
export interface MockIntentContract {
  /** Stable, queryless convention identity, e.g. `napplet:note/open`. */
  convention: string;
  /** Parameter names advertised after the convention, in order. */
  params: readonly string[];
}

/**
 * One installed napplet as both domains see it.
 *
 * @example
 * ```ts
 * const viewer = MOCK_NAPPLETS.find((n) => n.id === 'catalog-profile-viewer');
 * viewer?.roles; // ['profile']
 * ```
 */
export interface MockNapplet {
  /** Runtime-assigned catalog identifier (shared by intent and catalog). */
  id: string;
  /** Verified manifest kind. */
  kind: MockNappletKind;
  /** Publisher pubkey (64 hex). */
  pubkey: string;
  /** Verified manifest event id (64 hex). */
  eventId: string;
  /** Manifest `d` value; present only for kind 35129. */
  dTag?: string;
  /** Verified artifact hash (64 hex). */
  artifactHash: string;
  /** Human-readable title. */
  title?: string;
  /** Plain-text manifest content. */
  description: string;
  /** Bare domains from `R` tags. */
  requires: readonly string[];
  /** Bare domains from `O` tags. */
  optional: readonly string[];
  /** Roles from `z` tags. */
  roles: readonly string[];
  /** Accepted conventions from `i` tags. */
  intents: readonly MockIntentContract[];
}

function named(
  id: string,
  account: string,
  dTag: string,
  fields: Pick<MockNapplet, 'title' | 'description' | 'requires' | 'optional' | 'roles' | 'intents'>,
): MockNapplet {
  const pubkey = findMockAccount(account)?.pubkey ?? mockHex(`pubkey:${account}`);
  return { id, kind: 35129, pubkey, eventId: mockEventId(`manifest:${dTag}`), dTag, artifactHash: mockHex(`artifact:${dTag}`), ...fields };
}

/**
 * Three installed napplets: two intent handlers (profile viewer; note/feed
 * viewer) and one role-less root-manifest napplet that acts as a source.
 *
 * @example
 * ```ts
 * MOCK_NAPPLETS.map((n) => n.id);
 * // ['catalog-profile-viewer', 'catalog-note-viewer', 'catalog-distro-tracker']
 * ```
 */
export const MOCK_NAPPLETS: readonly MockNapplet[] = Object.freeze([
  named('catalog-profile-viewer', 'alice', 'profile-viewer', {
    title: 'Profile Viewer',
    description: 'Displays a Nostr profile.',
    requires: ['relay'],
    optional: ['theme'],
    roles: ['profile'],
    intents: [{ convention: 'napplet:profile/open', params: ['pubkey'] }],
  }),
  named('catalog-note-viewer', 'bob', 'note-viewer', {
    title: 'Note Viewer',
    description: 'Displays a Nostr note or a filtered feed.',
    requires: ['relay', 'storage'],
    optional: ['theme', 'intent'],
    roles: ['note', 'feed'],
    intents: [
      { convention: 'napplet:note/open', params: ['id'] },
      { convention: 'napplet:feed/open', params: [] },
      { convention: 'napplet:feed/edit', params: ['filters', 'relays'] },
    ],
  }),
  {
    id: 'catalog-distro-tracker',
    kind: 15129,
    pubkey: findMockAccount('carol')?.pubkey ?? mockHex('pubkey:carol'),
    eventId: mockEventId('manifest:distro-tracker'),
    artifactHash: mockHex('artifact:distro-tracker'),
    title: 'Distro Tracker',
    description: 'Tracks Linux distribution releases.',
    requires: ['storage'],
    optional: ['notify'],
    roles: [],
    intents: [],
  },
]);

const CONVENTION = /^napplet:([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/;

/**
 * Split a stable convention identity into archetype and action.
 *
 * @param convention - Candidate convention text.
 * @returns The parts, or `undefined` when not a queryless `napplet:<a>/<b>`.
 * @example
 * ```ts
 * parseMockConvention('napplet:note/open'); // { archetype: 'note', action: 'open' }
 * ```
 */
export function parseMockConvention(convention: unknown): { archetype: string; action: string } | undefined {
  if (typeof convention !== 'string') return undefined;
  const match = CONVENTION.exec(convention);
  return match ? { archetype: match[1] as string, action: match[2] as string } : undefined;
}

/**
 * Contracts a napplet advertises for one role: `i` tags whose archetype
 * segment matches a `z` role of the same manifest.
 *
 * @param napplet - Installed napplet.
 * @param archetype - Role slug.
 * @returns Eligible contracts (empty when the role is not advertised).
 * @example
 * ```ts
 * mockContractsFor(MOCK_NAPPLETS[1]!, 'feed').length === 2;
 * ```
 */
export function mockContractsFor(napplet: MockNapplet, archetype: string): MockIntentContract[] {
  if (!napplet.roles.includes(archetype)) return [];
  return napplet.intents.filter((contract) => parseMockConvention(contract.convention)?.archetype === archetype);
}

/**
 * Every archetype advertised with at least one eligible contract.
 *
 * @param napplets - Installed napplets.
 * @returns Unique archetypes in first-seen order.
 * @example
 * ```ts
 * mockArchetypes(MOCK_NAPPLETS); // ['profile', 'note', 'feed']
 * ```
 */
export function mockArchetypes(napplets: readonly MockNapplet[]): string[] {
  const seen = new Set<string>();
  for (const napplet of napplets) {
    for (const role of napplet.roles) if (mockContractsFor(napplet, role).length > 0) seen.add(role);
  }
  return [...seen];
}

/**
 * The implicit dispatch target for a role: the user default when it is an
 * eligible candidate, else the sole candidate, else `null` (a chooser would
 * be needed).
 *
 * @param napplets - Installed napplets.
 * @param archetype - Role slug.
 * @param defaults - User default handler per archetype.
 * @returns Catalog id or `null`.
 * @example
 * ```ts
 * resolveMockHandler(MOCK_NAPPLETS, 'profile', new Map()) === 'catalog-profile-viewer';
 * ```
 */
export function resolveMockHandler(napplets: readonly MockNapplet[], archetype: string, defaults: ReadonlyMap<string, string>): string | null {
  const candidates = napplets.filter((napplet) => mockContractsFor(napplet, archetype).length > 0);
  const preferred = defaults.get(archetype);
  if (preferred && candidates.some((napplet) => napplet.id === preferred)) return preferred;
  return candidates.length === 1 ? (candidates[0] as MockNapplet).id : null;
}

/**
 * NIP-01 coordinate (`35129:<pubkey>:<d>`) of a named napplet.
 *
 * @param napplet - Installed napplet.
 * @returns The coordinate, or `undefined` for root and snapshot manifests.
 * @example
 * ```ts
 * mockNappletAddress(MOCK_NAPPLETS[0]!)?.startsWith('35129:');
 * ```
 */
export function mockNappletAddress(napplet: MockNapplet): string | undefined {
  return napplet.kind === 35129 && napplet.dTag ? `${napplet.kind}:${napplet.pubkey}:${napplet.dTag}` : undefined;
}
