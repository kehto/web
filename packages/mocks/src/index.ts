/**
 * @kehto/mocks — Deterministic mock services for every napplet NAP domain.
 *
 * Each mock is a plain `ServiceHandler` (built-in domains) or an extension
 * handler (draft domains outside the built-in dispatcher) with an attached
 * `mock` control surface for seeding, inspection, and reset. Use them to give a
 * shell data while implementing a NAP, or as fixtures in tests.
 *
 * @example
 * ```ts
 * import { createMockNapServices, MOCK_NAP_REGISTRY } from '@kehto/mocks';
 * import { createShellBridge } from '@kehto/shell';
 *
 * const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 7 });
 * const bridge = createShellBridge({ ...hooks, services: mocks.services });
 * ```
 *
 * @module
 * @packageDocumentation
 */

export type {
  MockCapabilityMap,
  MockClock,
  MockControls,
  MockDomainEntry,
  MockDomainKind,
  MockScheduler,
  MockSentEnvelope,
  MockService,
  MockServiceOptions,
  NapSpecRef,
} from './core/types.js';

export {
  DEFAULT_CLOCK,
  DEFAULT_SCHEDULER,
  defineMockService,
  pushThrough,
  pushToWindow,
  resultType,
} from './core/handler.js';
export type { MockRoute, MockRouteContext, MockServiceDefinition } from './core/handler.js';

export {
  createSeededRng,
  hashLabel,
  mockEventId,
  mockHex,
  mockPubkey,
  mockSignature,
} from './core/rng.js';
export type { SeededRng } from './core/rng.js';

export { createMockNapServices } from './core/aggregate.js';
export type { MockNapServices, MockNapServicesOptions } from './core/aggregate.js';

export {
  LINUX_DISTROS,
  findLinuxDistro,
  searchLinuxDistros,
} from './fixtures/linux-distros.js';
export type { LinuxDistroImage } from './fixtures/linux-distros.js';

export {
  MOCK_ACCOUNTS,
  MOCK_EPOCH_SECONDS,
  MOCK_EVENTS,
  MOCK_RELAYS,
  MOCK_RELAY_URLS,
  buildMockEvent,
  findMockAccount,
  matchesNostrFilter,
  queryNostrEvents,
} from './fixtures/nostr.js';
export type { MockAccount } from './fixtures/nostr.js';

export {
  MOCK_NAP_REGISTRY,
  MOCK_SOCIAL_DOMAINS,
  createMockNapEnvironment,
  findMockDomain,
} from './registry.js';
export type { MockNapEnvironment, MockNapEnvironmentOptions } from './registry.js';
export * from './domains/index.js';
