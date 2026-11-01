/**
 * registry.ts — Inventory of every NAP domain with its mock and spec ref.
 *
 * `MOCK_NAP_REGISTRY` is the single list the maintainer skill audits against
 * `napplet/naps`. Each entry records the exact document head that was read
 * when the mock was written; `scripts/audit-naps.mjs` compares those refs to
 * the live repository.
 */
import { createMockNapServices, type MockNapServices, type MockNapServicesOptions } from './core/aggregate.js';
import type { MockDomainEntry, MockServiceOptions } from './core/types.js';
import { DOMAIN_ENTRIES } from './domains/index.js';
import { createMockNostrStore, type MockNostrStore } from './domains/nostr-store.js';
import { mockShellEnvironmentDomains } from './domains/shell.js';
import { createMockStatePersistence } from './domains/storage.js';

/**
 * Every NAP domain known to `@kehto/mocks`, in wire-domain order.
 *
 * @example
 * ```ts
 * const draft = MOCK_NAP_REGISTRY.filter((entry) => entry.spec.status === 'draft');
 * ```
 */
export const MOCK_NAP_REGISTRY: readonly MockDomainEntry[] = Object.freeze(
  [...DOMAIN_ENTRIES].sort((left, right) => left.domain.localeCompare(right.domain)),
);

/**
 * Find a registry entry by wire domain.
 *
 * @param domain - Wire domain such as `relay`.
 * @returns The entry or `undefined`.
 * @example
 * ```ts
 * findMockDomain('relay')?.spec.pr === 2;
 * ```
 */
export function findMockDomain(domain: string): MockDomainEntry | undefined {
  return MOCK_NAP_REGISTRY.find((entry) => entry.domain === domain);
}

/** Domains whose factories accept a shared `store` and `user`. */
export const MOCK_SOCIAL_DOMAINS: readonly string[] = Object.freeze(['common', 'count', 'identity', 'lists', 'outbox', 'relay']);

/**
 * Options for `createMockNapEnvironment`.
 *
 * @example
 * ```ts
 * const options: MockNapEnvironmentOptions = { seed: 7, user: 'bob', except: ['llm'] };
 * ```
 */
export interface MockNapEnvironmentOptions extends MockNapServicesOptions {
  /** Shell user for the social mocks (fixture name or hex; `''` = signed out). Default `alice`. */
  user?: string;
  /** Shared event store; a fresh seeded store is created when omitted. */
  store?: MockNostrStore;
}

/**
 * A ready-to-wire mock environment for a shell.
 *
 * @example
 * ```ts
 * const env = createMockNapEnvironment();
 * createShellBridge({ ...hooks, services: env.services, statePersistence: env.statePersistence });
 * ```
 */
export interface MockNapEnvironment extends MockNapServices {
  /** Event store shared by relay, outbox, count, identity, common, and lists. */
  readonly store: MockNostrStore;
  /** In-memory `StatePersistence` backing the runtime-owned storage domain. */
  readonly statePersistence: ReturnType<typeof createMockStatePersistence>;
  /** Wire domains to list in the shell environment's `capabilities.domains`. */
  readonly domains: readonly string[];
  /** Service domains actually created (subset of `domains`). */
  readonly serviceDomains: readonly string[];
}

/**
 * Instantiate every mock in `MOCK_NAP_REGISTRY` with one shared Nostr store
 * (so a publish in one social domain is visible to the others), an in-memory
 * storage persistence, and the domain list to expose.
 *
 * @param options - Shared options, selection, user, and store.
 * @returns Services, persistence, store, and domain lists.
 * @example
 * ```ts
 * const env = createMockNapEnvironment({ seed: 3 });
 * env.get('relay').mock.state();
 * env.resetAll();
 * ```
 */
export function createMockNapEnvironment(options: MockNapEnvironmentOptions = {}): MockNapEnvironment {
  const { user, store: givenStore, overrides, ...rest } = options;
  const store = givenStore ?? createMockNostrStore(rest.clock ? { clock: rest.clock } : {});
  const social: Record<string, MockServiceOptions> = {};
  for (const domain of MOCK_SOCIAL_DOMAINS) {
    social[domain] = { ...overrides?.[domain], store, ...(user !== undefined ? { user } : {}) } as MockServiceOptions;
  }
  const services = createMockNapServices(MOCK_NAP_REGISTRY, { ...rest, overrides: { ...overrides, ...social } });
  const statePersistence = createMockStatePersistence();
  const selected = MOCK_NAP_REGISTRY.filter((entry) => !entry.create || services.domains.includes(entry.domain));
  return {
    ...services,
    store,
    statePersistence,
    domains: Object.freeze(mockShellEnvironmentDomains(selected)),
    serviceDomains: services.domains,
    resetAll() {
      services.resetAll();
      if (!givenStore) store.reset();
      statePersistence.mock.reset();
    },
  };
}
