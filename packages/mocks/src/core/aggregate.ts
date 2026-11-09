/**
 * core/aggregate.ts — Build a full `services` map from registry entries.
 */
import type { MockDomainEntry, MockService, MockServiceOptions } from './types.js';

/**
 * Options for `createMockNapServices`.
 *
 * @example
 * ```ts
 * const options: MockNapServicesOptions = { seed: 3, only: ['relay', 'identity'] };
 * ```
 */
export interface MockNapServicesOptions extends MockServiceOptions {
  /** Restrict to these domains (default: every domain with a factory). */
  only?: readonly string[];
  /** Exclude these domains. */
  except?: readonly string[];
  /** Per-domain option overrides merged over the shared options. */
  overrides?: Readonly<Record<string, MockServiceOptions>>;
}

/**
 * Result of `createMockNapServices`.
 *
 * @example
 * ```ts
 * const mocks = createMockNapServices(MOCK_NAP_REGISTRY);
 * createShellBridge({ ...hooks, services: mocks.services });
 * mocks.get('relay').mock.reset();
 * ```
 */
export interface MockNapServices {
  /** Domain → handler, ready for `ShellAdapter.services` or `registerService`. */
  readonly services: Readonly<Record<string, MockService>>;
  /** Domains present in `services`, in registry order. */
  readonly domains: readonly string[];
  /**
   * Fetch one mock by domain.
   *
   * @param domain - Registered domain.
   * @returns The mock service.
   * @throws When the domain was not created.
   */
  get<TState = unknown>(domain: string): MockService<TState>;
  /** Reset every created mock. */
  resetAll(): void;
}

/**
 * Instantiate every `service`/`extension` entry of a registry.
 *
 * @param registry - Entries to instantiate (normally `MOCK_NAP_REGISTRY`).
 * @param options - Shared options plus `only`/`except`/`overrides`.
 * @returns Services map and helpers.
 * @example
 * ```ts
 * const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 42, except: ['llm'] });
 * ```
 */
export function createMockNapServices(
  registry: readonly MockDomainEntry[],
  options: MockNapServicesOptions = {},
): MockNapServices {
  const { only, except, overrides, ...shared } = options;
  const services: Record<string, MockService> = {};
  const domains: string[] = [];
  for (const entry of registry) {
    if (!entry.create) continue;
    if (only && !only.includes(entry.domain)) continue;
    if (except?.includes(entry.domain)) continue;
    services[entry.domain] = entry.create({ ...shared, ...overrides?.[entry.domain] });
    domains.push(entry.domain);
  }
  return {
    services: Object.freeze(services),
    domains: Object.freeze(domains),
    get<TState>(domain: string): MockService<TState> {
      const service = services[domain];
      if (!service) throw new Error(`@kehto/mocks: no mock created for domain "${domain}"`);
      return service as MockService<TState>;
    },
    resetAll() {
      for (const domain of domains) services[domain]?.mock.reset();
    },
  };
}
