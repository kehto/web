/**
 * domains/system.ts — Mock NAP-SYSTEM service.
 *
 * Spec: naps/NAP-SYSTEM.md @ napplet/naps PR #64 head 43a112db9d1c (draft)
 * Routes: system.naps, system.services, system.relays, system.eventCache,
 *         system.media, system.nappletStorage, system.scopes, system.scope
 * Spec gaps / decisions:
 * - NAP-SYSTEM defines no version, uptime, memory, or battery fields. Those
 *   live in the runtime-defined `details` map of the `runtime` scope
 *   (`system.scope` with `name: "runtime"`), which the NAP leaves open.
 * - `nappletStorage` and `scope` are per-napplet. The mock derives a stable
 *   per-window snapshot from the window id so two windows never see each
 *   other's numbers.
 * - On a forced error the mock keeps the NAP's "conservative fallback":
 *   `available: false`, `health: "unknown"` next to `error`.
 */
import { DEFAULT_CLOCK, defineMockService } from '../core/handler.js';
import { hashLabel } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_RELAY_URLS } from '../fixtures/nostr.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * SYSTEM_SPEC_REF.pr === 64;
 * ```
 */
export const SYSTEM_SPEC_REF: NapSpecRef = {
  nap: 'NAP-SYSTEM',
  status: 'draft',
  source: 'pr',
  pr: 64,
  sha: '43a112db9d1c',
  path: 'naps/NAP-SYSTEM.md',
};

/**
 * `SystemHealth` enumeration.
 *
 * @example
 * ```ts
 * const health: SystemHealth = 'degraded';
 * ```
 */
export type SystemHealth = 'ok' | 'degraded' | 'unavailable' | 'unknown';

/**
 * `SystemNapStatus` row.
 *
 * @example
 * ```ts
 * const row: SystemNapStatus = { domain: 'relay', supported: true, health: 'ok' };
 * ```
 */
export interface SystemNapStatus {
  domain: string;
  supported: boolean;
  required?: boolean;
  protocols?: string[];
  health?: SystemHealth;
}

/**
 * `SystemServiceStatus` row.
 *
 * @example
 * ```ts
 * const row: SystemServiceStatus = { name: 'audio', available: true, health: 'ok' };
 * ```
 */
export interface SystemServiceStatus {
  name: string;
  available: boolean;
  health: SystemHealth;
  message?: string;
}

/**
 * `SystemRelayStatus` row.
 *
 * @example
 * ```ts
 * const row: SystemRelayStatus = { url: 'wss://relay-a.example.org', read: true, write: true, connected: true, health: 'ok', latencyMs: 82 };
 * ```
 */
export interface SystemRelayStatus {
  url: string;
  read: boolean;
  write: boolean;
  connected: boolean;
  health: SystemHealth;
  latencyMs?: number;
}

/**
 * `SystemStorageStatus` snapshot.
 *
 * @example
 * ```ts
 * const status: SystemStorageStatus = { available: true, health: 'ok', bytesUsed: 4096, itemCount: 12 };
 * ```
 */
export interface SystemStorageStatus {
  available: boolean;
  health: SystemHealth;
  bytesUsed?: number;
  bytesQuota?: number;
  itemCount?: number;
  persistent?: boolean;
  message?: string;
}

/**
 * `SystemMediaStatus` snapshot.
 *
 * @example
 * ```ts
 * const status: SystemMediaStatus = { available: true, health: 'ok', activeSessions: 0 };
 * ```
 */
export interface SystemMediaStatus {
  available: boolean;
  health: SystemHealth;
  audioOutput?: SystemHealth;
  audioInput?: SystemHealth;
  videoInput?: SystemHealth;
  playback?: SystemHealth;
  activeSessions?: number;
  message?: string;
}

/**
 * `SystemScopeSummary` row.
 *
 * @example
 * ```ts
 * const row: SystemScopeSummary = { name: 'storage', available: true, health: 'ok' };
 * ```
 */
export interface SystemScopeSummary {
  name: string;
  available: boolean;
  health: SystemHealth;
}

/**
 * `SystemScopeStatus` snapshot.
 *
 * @example
 * ```ts
 * const scope: SystemScopeStatus = { name: 'media', available: true, health: 'ok', details: { activeSessions: 1 } };
 * ```
 */
export interface SystemScopeStatus extends SystemScopeSummary {
  details: Record<string, unknown>;
}

/**
 * Accessor names a forced error can target.
 *
 * @example
 * ```ts
 * const accessor: SystemAccessor = 'relays';
 * ```
 */
export type SystemAccessor = 'naps' | 'services' | 'relays' | 'eventCache' | 'media' | 'nappletStorage' | 'scopes' | 'scope';

/**
 * Scope names the mock answers through `system.scope`.
 *
 * @example
 * ```ts
 * SYSTEM_SCOPE_NAMES.includes('runtime');
 * ```
 */
export const SYSTEM_SCOPE_NAMES: readonly string[] = Object.freeze(['storage', 'media', 'relay', 'cache', 'runtime']);

/**
 * In-memory state of the system mock.
 *
 * @example
 * ```ts
 * const state = createMockSystemService().mock.state();
 * state.relays.length === 4;
 * ```
 */
export interface MockSystemState {
  /** Clock reading when the mock was created or reset; uptime counts from here. */
  startedAt: number;
  /** Runtime version string reported in the `runtime` scope. */
  version: string;
  naps: SystemNapStatus[];
  services: SystemServiceStatus[];
  relays: SystemRelayStatus[];
  eventCache: SystemStorageStatus;
  media: SystemMediaStatus;
  /** Per-window storage snapshots, created on first access. */
  storageByWindow: Map<string, SystemStorageStatus>;
  /** Accessors forced to fail, with their error string. */
  errors: Partial<Record<SystemAccessor, string>>;
}

/**
 * Factory options for the system mock.
 *
 * @example
 * ```ts
 * const service = createMockSystemService({ version: '1.2.3', errors: { media: 'unavailable' } });
 * ```
 */
export interface MockSystemOptions extends MockServiceOptions {
  /** Runtime version reported in the `runtime` scope. Default `0.1.0-mock`. */
  version?: string;
  /** Override the NAP support table. */
  naps?: SystemNapStatus[];
  /** Override the service table. */
  services?: SystemServiceStatus[];
  /** Override the relay table. */
  relays?: SystemRelayStatus[];
  /** Override the event-cache snapshot. */
  eventCache?: SystemStorageStatus;
  /** Override the media snapshot. */
  media?: SystemMediaStatus;
  /** Force these accessors to answer with `error` and a conservative fallback. */
  errors?: Partial<Record<SystemAccessor, string>>;
}

/**
 * The system mock service type.
 *
 * @example
 * ```ts
 * createMockSystemService().setError('media', 'unavailable');
 * ```
 */
export type MockSystemService = MockService<MockSystemState> & {
  /**
   * Force or clear an accessor error at runtime.
   *
   * @param accessor - Accessor to affect.
   * @param error - Error string, or `undefined` to clear.
   */
  setError(accessor: SystemAccessor, error: string | undefined): void;
};

const DEFAULT_NAPS: readonly SystemNapStatus[] = Object.freeze([
  { domain: 'shell', supported: true, required: true, health: 'ok' },
  { domain: 'relay', supported: true, health: 'ok' },
  { domain: 'storage', supported: true, health: 'ok' },
  { domain: 'identity', supported: true, health: 'ok' },
  { domain: 'inc', supported: true, protocols: ['NAP-4'], health: 'ok' },
  { domain: 'media', supported: true, health: 'degraded' },
  { domain: 'llm', supported: false },
]);

const DEFAULT_SERVICES: readonly SystemServiceStatus[] = Object.freeze([
  { name: 'relay-pool', available: true, health: 'ok' },
  { name: 'event-cache', available: true, health: 'ok' },
  { name: 'audio', available: true, health: 'degraded', message: 'No output device selected' },
  { name: 'notifications', available: false, health: 'unavailable', message: 'Permission not granted' },
]);

function defaultRelays(): SystemRelayStatus[] {
  return MOCK_RELAY_URLS.map((url, index) => ({
    url,
    read: true,
    write: index < 2,
    connected: index !== 3,
    health: index === 3 ? 'degraded' : 'ok',
    ...(index !== 3 ? { latencyMs: 40 + (hashLabel(url) % 120) } : {}),
  }));
}

function storageFor(windowId: string): SystemStorageStatus {
  const hash = hashLabel(`system-storage:${windowId}`);
  return {
    available: true,
    health: 'ok',
    bytesUsed: 4096 * (1 + (hash % 8)),
    bytesQuota: 5 * 1024 * 1024,
    itemCount: 1 + (hash % 40),
    persistent: true,
  };
}

const FALLBACK_STORAGE: SystemStorageStatus = { available: false, health: 'unknown' };
const FALLBACK_MEDIA: SystemMediaStatus = { available: false, health: 'unknown' };

/**
 * Create the NAP-SYSTEM mock.
 *
 * @param options - Seeds and overrides.
 * @returns The mock service with its control surface.
 * @example
 * ```ts
 * const system = createMockSystemService({ clock: { now: () => 1_000 } });
 * system.handleMessage('win', { type: 'system.scope', id: 'r1', name: 'runtime' }, console.log);
 * ```
 */
export function createMockSystemService(options: MockSystemOptions = {}): MockSystemService {
  const service = defineMockService<MockSystemState>({
    domain: 'system',
    version: '0.1.0',
    description: 'Mock NAP-SYSTEM read-only runtime diagnostics',
    kind: 'extension',
    initialState: () => ({
      startedAt: (options.clock ?? DEFAULT_CLOCK).now(),
      version: options.version ?? '0.1.0-mock',
      naps: (options.naps ?? DEFAULT_NAPS).map((row) => ({ ...row })),
      services: (options.services ?? DEFAULT_SERVICES).map((row) => ({ ...row })),
      relays: (options.relays ?? defaultRelays()).map((row) => ({ ...row })),
      eventCache: { ...(options.eventCache ?? { available: true, health: 'ok', bytesUsed: 7_340_032, bytesQuota: 64 * 1024 * 1024, itemCount: 18_204, persistent: true }) },
      media: { ...(options.media ?? { available: true, health: 'degraded', audioOutput: 'degraded', audioInput: 'unavailable', videoInput: 'unavailable', playback: 'ok', activeSessions: 0 }) },
      storageByWindow: new Map(),
      errors: { ...(options.errors ?? {}) },
    }),
    routes: {
      'system.naps': ({ state, reply }) => {
        const error = state.errors.naps;
        reply(error ? { naps: [], error } : { naps: state.naps });
      },
      'system.services': ({ state, reply }) => {
        const error = state.errors.services;
        reply(error ? { services: [], error } : { services: state.services });
      },
      'system.relays': ({ state, reply }) => {
        const error = state.errors.relays;
        reply(error ? { relays: [], error } : { relays: state.relays });
      },
      'system.eventCache': ({ state, reply }) => {
        const error = state.errors.eventCache;
        reply(error ? { status: FALLBACK_STORAGE, error } : { status: state.eventCache });
      },
      'system.media': ({ state, reply }) => {
        const error = state.errors.media;
        reply(error ? { status: FALLBACK_MEDIA, error } : { status: state.media });
      },
      'system.nappletStorage': ({ state, reply, windowId }) => {
        const error = state.errors.nappletStorage;
        if (error) {
          reply({ status: FALLBACK_STORAGE, error });
          return;
        }
        reply({ status: windowStorage(state, windowId) });
      },
      'system.scopes': ({ state, reply }) => {
        const error = state.errors.scopes;
        reply(error ? { scopes: [], error } : { scopes: scopeSummaries(state) });
      },
      'system.scope': ({ state, reply, message, windowId, clock }) => {
        const name = typeof message.name === 'string' ? message.name : '';
        const error = state.errors.scope ?? (SYSTEM_SCOPE_NAMES.includes(name) ? undefined : 'unknown scope');
        if (error) {
          reply({ scope: { name, available: false, health: 'unknown', details: {} }, error });
          return;
        }
        reply({ scope: scopeStatus(state, name, windowId, clock.now()) });
      },
    },
    onWindowDestroyed: (windowId, state) => { state.storageByWindow.delete(windowId); },
  }, options);

  return Object.assign(service, {
    setError(accessor: SystemAccessor, error: string | undefined) {
      const errors = service.mock.state().errors;
      if (error === undefined) delete errors[accessor];
      else errors[accessor] = error;
    },
  });
}

function windowStorage(state: MockSystemState, windowId: string): SystemStorageStatus {
  let status = state.storageByWindow.get(windowId);
  if (!status) {
    status = storageFor(windowId);
    state.storageByWindow.set(windowId, status);
  }
  return status;
}

function scopeSummaries(state: MockSystemState): SystemScopeSummary[] {
  return SYSTEM_SCOPE_NAMES.map((name) => {
    const health = name === 'media' ? state.media.health : name === 'cache' ? state.eventCache.health : 'ok';
    return { name, available: health !== 'unavailable', health };
  });
}

function scopeStatus(state: MockSystemState, name: string, windowId: string, now: number): SystemScopeStatus {
  const summary = scopeSummaries(state).find((row) => row.name === name) ?? { name, available: true, health: 'ok' as const };
  const details = scopeDetails(state, name, windowId, now);
  return { ...summary, details };
}

function scopeDetails(state: MockSystemState, name: string, windowId: string, now: number): Record<string, unknown> {
  switch (name) {
    case 'storage': {
      const storage = windowStorage(state, windowId);
      return { bytesUsed: storage.bytesUsed, bytesQuota: storage.bytesQuota, itemCount: storage.itemCount };
    }
    case 'media':
      return { activeSessions: state.media.activeSessions ?? 0 };
    case 'relay':
      return { connected: state.relays.filter((relay) => relay.connected).length, budgetPerMinute: 120 };
    case 'cache':
      return { bytesUsed: state.eventCache.bytesUsed, itemCount: state.eventCache.itemCount };
    case 'runtime':
      return { version: state.version, startedAt: state.startedAt, uptimeMs: Math.max(0, now - state.startedAt) };
    default:
      return {};
  }
}

/**
 * Registry row for NAP-SYSTEM.
 *
 * @example
 * ```ts
 * SYSTEM_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const SYSTEM_MOCK_ENTRY: MockDomainEntry = {
  domain: 'system',
  kind: 'extension',
  spec: SYSTEM_SPEC_REF,
  create: (options) => createMockSystemService(options),
};
