import type { NostrEvent, NostrFilter } from '@napplet/core';

import { matchesAnyFilter } from './browser-relay-runtime.js';

/** Create Paja's runtime-local worker relay over its retained event array. */
export function createPajaWorkerRelay(events: NostrEvent[]) {
  return {
    event(event: NostrEvent) {
      events.push(event);
      return Promise.resolve({ ok: true });
    },
    query(request: unknown): Promise<NostrEvent[]> {
      const filters = Array.isArray(request)
        ? request.slice(2).filter((item): item is NostrFilter => typeof item === 'object' && item !== null)
        : [];
      return Promise.resolve(events.filter((event) => matchesAnyFilter(event, filters)));
    },
    count(request: unknown): Promise<number> {
      return this.query(request).then((matched) => matched.length);
    },
  };
}
