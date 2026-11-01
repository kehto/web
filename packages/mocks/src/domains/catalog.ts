/**
 * domains/catalog.ts — Mock NAP-CATALOG extension service.
 *
 * Spec: naps/NAP-CATALOG.md @ napplet/naps PR #95 head 1020ae53 (draft)
 * Routes: catalog.get
 * Spec gaps / decisions:
 *   - The snapshot is built from the same `MOCK_NAPPLETS` fixture the intent
 *     mock uses, so `NappletDescriptor.id` equals `IntentCandidate.id`.
 *   - `currentHandler` follows the intent mock's implicit-dispatch rule: the
 *     user default when eligible, else the sole candidate, else `null`
 *     (several candidates and no default would need a chooser).
 *   - Role-less napplets are included with empty `archetypes`; root and
 *     snapshot manifests omit `dTag`.
 *   - `unavailable: true` answers every request with
 *     `error: 'catalog unavailable'` and no `snapshot`.
 *   - No ACL capability exists for `catalog`; the route is published with
 *     `null` in `messageCapabilities`.
 */
import { defineMockService } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_NAPPLETS, mockContractsFor, parseMockConvention, resolveMockHandler, type MockNapplet, type MockNappletKind } from './intent-fixtures.js';

/** Spec document read when this mock was written. */
export const CATALOG_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CATALOG',
  status: 'draft',
  source: 'pr',
  pr: 95,
  sha: '1020ae53',
  path: 'naps/NAP-CATALOG.md',
};

/** Verified napplet identity (`NappletIdentity`). */
export interface MockCatalogIdentity {
  /** Manifest kind. */
  kind: MockNappletKind;
  /** Publisher pubkey. */
  pubkey: string;
  /** Manifest event id. */
  eventId: string;
  /** `d` value; present only for kind 35129. */
  dTag?: string;
  /** Verified artifact hash. */
  artifactHash: string;
}

/** One accepted intent (`IntentDescriptor`). */
export interface MockCatalogIntent {
  /** Intent name, e.g. `open`. */
  intent: string;
  /** Stable queryless convention identity. */
  convention: string;
  /** Advertised parameter names, in order. */
  parameters: string[];
}

/** One advertised role (`ArchetypeDescriptor`). */
export interface MockCatalogArchetype {
  /** Role slug. */
  archetype: string;
  /** Accepted intents for the role. */
  intents: MockCatalogIntent[];
}

/** One catalog entry (`NappletDescriptor`). */
export interface MockCatalogNapplet {
  /** Opaque runtime selector (shared with intent). */
  id: string;
  /** Verified identity. */
  identity: MockCatalogIdentity;
  /** Human-readable title. */
  title?: string;
  /** Plain-text manifest content. */
  description: string;
  /** Required domains. */
  requires: string[];
  /** Optional domains. */
  optional: string[];
  /** Advertised roles (empty when none). */
  archetypes: MockCatalogArchetype[];
}

/** Current handler state for one role (`ArchetypeHandler`). */
export interface MockCatalogHandler {
  /** Role slug. */
  archetype: string;
  /** Selected napplet `id`, or `null`. */
  currentHandler: string | null;
}

/** Point-in-time catalog (`CatalogSnapshot`). */
export interface MockCatalogSnapshot {
  /** Napplets available to the caller. */
  napplets: MockCatalogNapplet[];
  /** One entry per archetype advertised by the returned napplets. */
  handlers: MockCatalogHandler[];
}

/**
 * In-memory state of the catalog mock.
 *
 * @example
 * ```ts
 * service.mock.state().requests; // 1 after one catalog.get
 * ```
 */
export interface MockCatalogState {
  /** Installed catalog. */
  napplets: MockNapplet[];
  /** User default handler per archetype. */
  defaults: Map<string, string>;
  /** Number of `catalog.get` requests answered. */
  requests: number;
}

/**
 * Options for `createMockCatalogService`.
 *
 * @example
 * ```ts
 * const options: MockCatalogOptions = { defaults: { feed: 'catalog-note-viewer' } };
 * ```
 */
export interface MockCatalogOptions extends MockServiceOptions {
  /** Installed catalog. Default `MOCK_NAPPLETS`. */
  napplets?: readonly MockNapplet[];
  /** Initial user defaults per archetype. */
  defaults?: Readonly<Record<string, string>>;
  /** Answer every request with `error: 'catalog unavailable'`. */
  unavailable?: boolean;
}

/**
 * The catalog mock service with its `setDefault` control.
 *
 * @example
 * ```ts
 * const catalog = createMockCatalogService();
 * catalog.setDefault('feed', 'catalog-note-viewer');
 * ```
 */
export type MockCatalogService = MockService<MockCatalogState> & {
  /**
   * Set or clear the user's default handler for a role (affects
   * `currentHandler` in later snapshots; NAP-CATALOG has no push).
   *
   * @param archetype - Role slug.
   * @param catalogId - Default handler id, or `null` to clear.
   */
  setDefault(archetype: string, catalogId: string | null): void;
};

function describe(napplet: MockNapplet): MockCatalogNapplet {
  return {
    id: napplet.id,
    identity: {
      kind: napplet.kind,
      pubkey: napplet.pubkey,
      eventId: napplet.eventId,
      ...(napplet.kind === 35129 && napplet.dTag ? { dTag: napplet.dTag } : {}),
      artifactHash: napplet.artifactHash,
    },
    ...(napplet.title ? { title: napplet.title } : {}),
    description: napplet.description,
    requires: [...napplet.requires],
    optional: [...napplet.optional],
    archetypes: napplet.roles.map((archetype) => ({
      archetype,
      intents: mockContractsFor(napplet, archetype).map((contract) => ({
        intent: parseMockConvention(contract.convention)?.action ?? '',
        convention: contract.convention,
        parameters: [...contract.params],
      })),
    })),
  };
}

/**
 * Build a catalog snapshot from installed napplets.
 *
 * @param napplets - Installed napplets.
 * @param defaults - User defaults per archetype.
 * @returns The snapshot with one handler row per advertised archetype.
 * @example
 * ```ts
 * mockCatalogSnapshot(MOCK_NAPPLETS, new Map()).handlers;
 * // [{ archetype: 'profile', currentHandler: 'catalog-profile-viewer' }, ...]
 * ```
 */
export function mockCatalogSnapshot(napplets: readonly MockNapplet[], defaults: ReadonlyMap<string, string>): MockCatalogSnapshot {
  const described = napplets.map(describe);
  const archetypes = [...new Set(described.flatMap((entry) => entry.archetypes.map((role) => role.archetype)))];
  return {
    napplets: described,
    handlers: archetypes.map((archetype) => ({ archetype, currentHandler: resolveMockHandler(napplets, archetype, defaults) })),
  };
}

/**
 * Create the NAP-CATALOG mock.
 *
 * @param options - Catalog, defaults, availability, and shared mock options.
 * @returns The catalog mock service.
 * @example
 * ```ts
 * const catalog = createMockCatalogService();
 * catalog.handleMessage('w1', { type: 'catalog.get', id: 'c1' }, send);
 * // → { type: 'catalog.get.result', id: 'c1', snapshot: { napplets: [...], handlers: [...] } }
 * ```
 */
export function createMockCatalogService(options: MockCatalogOptions = {}): MockCatalogService {
  const base = defineMockService<MockCatalogState>({
    domain: 'catalog',
    version: '1.0.0',
    description: 'Mock NAP-CATALOG read-only napplet catalog',
    kind: 'extension',
    initialState: () => ({
      napplets: [...(options.napplets ?? MOCK_NAPPLETS)],
      defaults: new Map(Object.entries(options.defaults ?? {})),
      requests: 0,
    }),
    routes: {
      'catalog.get': ({ state, reply, fail }) => {
        state.requests += 1;
        if (options.unavailable) return fail('catalog unavailable');
        reply({ snapshot: mockCatalogSnapshot(state.napplets, state.defaults) });
      },
    },
  }, options);

  const service: MockCatalogService = Object.assign(base, {
    setDefault(archetype: string, catalogId: string | null): void {
      const state = base.mock.state();
      if (catalogId === null) state.defaults.delete(archetype);
      else state.defaults.set(archetype, catalogId);
    },
  });
  return service;
}

/** Registry row for the catalog mock. */
export const CATALOG_MOCK_ENTRY: MockDomainEntry = {
  domain: 'catalog',
  kind: 'extension',
  spec: CATALOG_SPEC_REF,
  create: (options) => createMockCatalogService(options),
};
