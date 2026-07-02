import type { NappletMessage, NostrFilter } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';

export interface CountRequest {
  /** NIP-01 filters with NIP-45 COUNT OR semantics. */
  readonly filters: NostrFilter[];
  /** Optional runtime-owned count policy hints. */
  readonly options?: Record<string, unknown>;
  /** Window requesting the count. */
  readonly windowId: string;
}

export interface CountResult {
  readonly ok: boolean;
  readonly count?: number;
  readonly approximate?: boolean;
  readonly hll?: string;
  readonly relays?: readonly string[];
  readonly error?: string;
  readonly reason?: string;
}

export interface CountServiceOptions {
  /**
   * Count matching events without returning event payloads.
   *
   * @param request - Validated count request.
   * @returns Exact/approximate count metadata, or a number for an exact count.
   */
  count(request: CountRequest): CountResult | number | Promise<CountResult | number>;

  /**
   * Optional refusal policy for unsupported or too-expensive filters.
   *
   * Return `true` to allow the filter, `false` for a generic refusal, or a
   * string with the refusal reason.
   *
   * @param filter - Filter being evaluated.
   * @param index - Filter index in the OR filter set.
   */
  isFilterSupported?(filter: NostrFilter, index: number): boolean | string;

  /** Maximum number of OR filters accepted before refusing the request. */
  maxFilters?: number;
}

type CountServiceMessage = NappletMessage & {
  id?: unknown;
  filters?: unknown;
  options?: unknown;
};

const DEFAULT_MAX_FILTERS = 16;

export function createCountService(options: CountServiceOptions): ServiceHandler {
  return {
    descriptor: {
      name: 'count',
      version: '1.0.0',
      description: 'Runtime-mediated NIP-01 filter counts',
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      if (message.type !== 'count.query') return;

      const countMessage = message as CountServiceMessage;
      const id = typeof countMessage.id === 'string' ? countMessage.id : '';
      const filters = countMessage.filters;
      if (!isValidFilterArray(filters)) {
        send(result(id, { ok: false, error: 'invalid-filter', reason: 'count.query requires a non-empty filters array' }));
        return;
      }

      const maxFilters = options.maxFilters ?? DEFAULT_MAX_FILTERS;
      if (filters.length > maxFilters) {
        send(result(id, { ok: false, error: 'too-expensive', reason: `count.query accepts at most ${maxFilters} filters` }));
        return;
      }

      for (let i = 0; i < filters.length; i++) {
        const supported = options.isFilterSupported?.(filters[i]!, i) ?? true;
        if (supported !== true) {
          send(result(id, {
            ok: false,
            error: 'unsupported-filter',
            reason: typeof supported === 'string' ? supported : `filter ${i} is not supported by this count backend`,
          }));
          return;
        }
      }

      const request: CountRequest = {
        filters,
        windowId,
        ...(isPlainObject(countMessage.options) ? { options: countMessage.options } : {}),
      };

      Promise.resolve(options.count(request))
        .then((countResult) => {
          send(result(id, normalizeCountResult(countResult)));
        })
        .catch((error: unknown) => {
          send(result(id, {
            ok: false,
            error: 'count-unavailable',
            reason: error instanceof Error ? error.message : 'count backend failed',
          }));
        });
    },
  };
}

function result(id: string, value: CountResult): NappletMessage {
  return {
    type: 'count.query.result',
    id,
    ok: value.ok,
    ...(typeof value.count === 'number' ? { count: value.count } : {}),
    ...(typeof value.approximate === 'boolean' ? { approximate: value.approximate } : {}),
    ...(typeof value.hll === 'string' ? { hll: value.hll } : {}),
    ...(Array.isArray(value.relays) ? { relays: value.relays.filter((relay): relay is string => typeof relay === 'string') } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
  } as NappletMessage;
}

function normalizeCountResult(value: CountResult | number): CountResult {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0
      ? { ok: true, count: Math.floor(value), approximate: false }
      : { ok: false, error: 'count-unavailable', reason: 'count backend returned an invalid count' };
  }

  const count = typeof value.count === 'number' && Number.isFinite(value.count) && value.count >= 0
    ? Math.floor(value.count)
    : undefined;
  return {
    ok: value.ok === true,
    ...(count !== undefined ? { count } : {}),
    ...(typeof value.approximate === 'boolean' ? { approximate: value.approximate } : {}),
    ...(typeof value.hll === 'string' ? { hll: value.hll } : {}),
    ...(Array.isArray(value.relays) ? { relays: value.relays } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
  };
}

function isValidFilterArray(value: unknown): value is NostrFilter[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((filter) => isPlainObject(filter));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
