/**
 * domains/count.ts — Mock NAP-COUNT service.
 *
 * Spec: naps/NAP-COUNT.md @ napplet/naps PR #69 head 9353a0c6c02c (draft)
 * Routes: count.query
 * Spec gaps / decisions:
 * - Counts are exact and computed over the shared in-memory store with
 *   NIP-45 OR semantics (an event matching several filters counts once).
 * - `options.approximate: true` permits an estimate but does not require one;
 *   the mock still answers exactly and omits `approximate`.
 * - `options.hll: true` is honored as "when available": the mock has no
 *   HyperLogLog sketch, so `hll` is omitted rather than fabricated.
 * - `relays` reports the mock pool (`MOCK_RELAYS.primary` and `.secondary`)
 *   because the store stands in for a relay-side COUNT.
 * - Validation follows the NAP: `filters` must be a non-empty array of
 *   objects, every list-valued field must be non-empty, `since`/`until`/
 *   `limit` must be non-negative integers, tag keys are `#` plus one ASCII
 *   letter. Violations answer `invalid-filter`; more than `maxFilters`
 *   (default 16) answers `too-expensive`.
 * - `failNext(error, reason)` lets a shell exercise `CountFailure` shapes.
 */
import type { CountFilter, CountQueryMessage } from '@napplet/nap/count/types';
import { defineMockService, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_RELAYS } from '../fixtures/nostr.js';
import { asRequest, createMockNostrStore, type MockNostrStore } from './nostr-store.js';

/** Spec document the mock was written against. */
export const COUNT_SPEC_REF: NapSpecRef = {
  nap: 'NAP-COUNT',
  status: 'draft',
  source: 'pr',
  pr: 69,
  sha: '9353a0c6c02c',
  path: 'naps/NAP-COUNT.md',
};

/**
 * A queued `CountFailure` returned by the next `count.query`.
 *
 * @example
 * ```ts
 * const failure: MockCountFailure = { error: 'relay-refused', reason: 'COUNT disabled by policy' };
 * ```
 */
export interface MockCountFailure {
  /** Machine-readable NAP-COUNT error code. */
  error: string;
  /** Optional human-readable explanation. */
  reason?: string;
}

/**
 * In-memory state of the count mock.
 *
 * @example
 * ```ts
 * const state = createMockCountService().mock.state();
 * state.queries === 0;
 * ```
 */
export interface MockCountState {
  /** Shared event store the counts run over. */
  store: MockNostrStore;
  /** Relay URLs disclosed in successful results. */
  relays: string[];
  /** Failure to return on the next query, if any. */
  pendingFailure?: MockCountFailure;
  /** Number of `count.query` requests handled since construction/reset. */
  queries: number;
}

/**
 * Options for `createMockCountService`.
 *
 * @example
 * ```ts
 * const count = createMockCountService({ store, relays: ['wss://relay-a.example.org'] });
 * ```
 */
export interface MockCountOptions extends MockServiceOptions {
  /** Shared store; a fresh seeded one is created when omitted. */
  store?: MockNostrStore;
  /** Relay URLs to disclose in `relays`. Default primary + secondary; `[]` omits the field. */
  relays?: readonly string[];
  /** Maximum OR filters accepted before `too-expensive`. Default 16. */
  maxFilters?: number;
}

/**
 * Count mock with control helpers.
 *
 * @example
 * ```ts
 * const count = createMockCountService();
 * count.failNext('timeout', 'relay did not answer');
 * ```
 */
export type MockCountService = MockService<MockCountState> & {
  /** Make the next `count.query` answer the given `CountFailure`. */
  failNext(error: string, reason?: string): void;
};

const DEFAULT_MAX_FILTERS = 16;

function nonEmptyStrings(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
}

function nonNegativeInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Validate one `CountFilter` per the NAP schema.
 *
 * @param filter - Candidate filter object.
 * @returns A reason string when invalid, else `undefined`.
 * @example
 * ```ts
 * validateCountFilter({ kinds: [] }) === 'kinds must be a non-empty list';
 * ```
 */
export function validateCountFilter(filter: unknown): string | undefined {
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) return 'filter must be an object';
  for (const [key, value] of Object.entries(filter)) {
    if (key === 'ids' || key === 'authors') {
      if (!nonEmptyStrings(value)) return `${key} must be a non-empty list`;
    } else if (key === 'kinds') {
      if (!Array.isArray(value) || value.length === 0 || !value.every((kind) => nonNegativeInt(kind))) return 'kinds must be a non-empty list';
    } else if (key === 'since' || key === 'until' || key === 'limit') {
      if (!nonNegativeInt(value)) return `${key} must be a non-negative integer`;
    } else if (/^#[A-Za-z]$/.test(key)) {
      if (!nonEmptyStrings(value)) return `${key} must be a non-empty list`;
    } else {
      return `unknown filter field ${key}`;
    }
  }
  return undefined;
}

function handleQuery({ message, state, reply }: MockRouteContext<MockCountState>, maxFilters: number): void {
  state.queries += 1;
  const { filters } = asRequest<CountQueryMessage>(message);
  const failure = state.pendingFailure;
  if (failure) {
    delete state.pendingFailure;
    reply({ ok: false, error: failure.error, ...(failure.reason ? { reason: failure.reason } : {}) });
    return;
  }
  if (!Array.isArray(filters) || filters.length === 0) {
    reply({ ok: false, error: 'invalid-filter', reason: 'count.query requires a non-empty filters array' });
    return;
  }
  for (const [index, filter] of filters.entries()) {
    const problem = validateCountFilter(filter);
    if (problem) {
      reply({ ok: false, error: 'invalid-filter', reason: `filter ${index}: ${problem}` });
      return;
    }
  }
  if (filters.length > maxFilters) {
    reply({ ok: false, error: 'too-expensive', reason: `count.query accepts at most ${maxFilters} filters` });
    return;
  }
  // `options.approximate` and `options.hll` (CountOptions) are accepted but
  // need no branch: the count is always exact and no HLL sketch is available.
  const count = state.store.query((filters as CountFilter[]).map((filter) => ({ ...filter, limit: undefined }))).length;
  reply({ ok: true, count, ...(state.relays.length > 0 ? { relays: [...state.relays] } : {}) });
}

/**
 * Create the NAP-COUNT mock.
 *
 * @param options - Store, relays, limits, and shared mock options.
 * @returns A count `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const count = createMockCountService();
 * count.handleMessage('w1', { type: 'count.query', id: 'c1', filters: [{ kinds: [1] }] }, console.log);
 * ```
 */
export function createMockCountService(options: MockCountOptions = {}): MockCountService {
  const store = options.store ?? createMockNostrStore(options.clock ? { clock: options.clock } : {});
  const ownsStore = options.store === undefined;
  const maxFilters = options.maxFilters ?? DEFAULT_MAX_FILTERS;

  const base = defineMockService<MockCountState>({
    domain: 'count',
    version: '1.0.0',
    description: 'Mock NAP-COUNT: exact NIP-45 style counts over nostr fixtures',
    kind: 'service',
    initialState: () => {
      if (ownsStore) store.reset();
      return { store, relays: [...(options.relays ?? [MOCK_RELAYS.primary, MOCK_RELAYS.secondary])], queries: 0 };
    },
    routes: {
      'count.query': (context) => handleQuery(context, maxFilters),
    },
  }, options);

  const service: MockCountService = Object.assign(base, {
    failNext(error: string, reason?: string): void {
      service.mock.state().pendingFailure = { error, ...(reason ? { reason } : {}) };
    },
  });
  return service;
}

/** Registry row for the count domain. */
export const COUNT_MOCK_ENTRY: MockDomainEntry = {
  domain: 'count',
  kind: 'service',
  spec: COUNT_SPEC_REF,
  create: (options) => createMockCountService(options),
};
