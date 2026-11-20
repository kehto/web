import { createCountService, type CountRequest, type CountResult } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

/** Exact count the in-memory index holds for every filter set. */
export const FIXTURE_COUNT = 3;

/** Relay origin the count plan names. Planning only: nothing connects to it. */
const COUNT_RELAY = 'wss://relay.conformance.invalid/';

/**
 * An in-memory COUNT index: exact by default, an estimate only when the
 * request permits one, and an HLL value only when one was requested.
 */
function countIndex(request: CountRequest): CountResult {
  const options = request.options ?? {};
  return {
    ok: true,
    count: FIXTURE_COUNT,
    ...(options.approximate === true ? { approximate: true } : {}),
    ...(options.hll === true ? { hll: '00'.repeat(256) } : {}),
  };
}

/** NAP-COUNT backend: the reference count service over an in-memory index. */
export const COUNT_BACKEND: DomainBackendModule = {
  domain: 'count',
  create() {
    return {
      services: {
        count: createCountService({ planCount: () => ({ relays: [COUNT_RELAY] }), count: countIndex }),
      },
    };
  },
};
