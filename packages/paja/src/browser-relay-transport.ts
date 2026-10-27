import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { SimplePool } from 'nostr-tools/pool';
import type { Subscription } from 'nostr-tools/abstract-relay';
import type { Filter } from 'nostr-tools/filter';
import { normalizeURL } from 'nostr-tools/utils';

export type RelayReceiptObserver = (event: NostrEvent, relayUrl: string) => void;

/** Preserve the first configured spelling while coalescing equivalent URLs. */
function relaySources(urls: string[]): Array<{ url: string; source: string }> {
  const sources = new Map<string, string>();
  for (const source of urls) {
    const url = normalizeURL(source);
    if (!sources.has(url)) sources.set(url, source);
  }
  return [...sources].map(([url, source]) => ({ url, source }));
}

/** Observe verified matching receipts before applying read-local delivery deduplication. */
export function subscribePajaLive(
  pool: SimplePool,
  relayUrls: string[],
  filters: NostrFilter[],
  next: (item: NostrEvent | 'EOSE') => void,
  observe: RelayReceiptObserver,
  maxWait: number,
  label = 'kehto-paja-runtime',
): { unsubscribe(reason?: string): void } {
  const sources = relaySources(relayUrls);
  const activeFilters = (filters.length ? filters : [{}]) as Filter[];
  const seen = new Set<string>();
  const ended = new Set<string>();
  const subscriptions = new Set<Subscription>();
  const controller = new AbortController();
  let closed = false;
  let eosed = false;
  const finishRelay = (url: string) => {
    if (closed || eosed) return;
    ended.add(url);
    if (ended.size === sources.length) {
      eosed = true;
      next('EOSE');
    }
  };
  if (!sources.length) queueMicrotask(() => { if (!closed) next('EOSE'); });
  for (const { url, source } of sources) {
    if (pool.allowConnectingToRelay?.(url, ['read', activeFilters]) === false) {
      queueMicrotask(() => finishRelay(url));
      continue;
    }
    void pool.ensureRelay(url, {
      connectionTimeout: Math.min(pool.maxWaitForConnection ?? maxWait, maxWait),
      abort: controller.signal,
    }).then((relay) => {
      if (closed) return;
      pool.onRelayConnectionSuccess?.(url);
      const subscribe = (retry: boolean): void => {
        if (closed) return;
        const subscription = relay.subscribe(activeFilters, {
          label,
          eoseTimeout: maxWait,
          onevent(event) {
            if (closed) return;
            if (pool.trackRelays) {
              const history = pool.seenOn.get(event.id) ?? new Set();
              history.add(relay);
              pool.seenOn.set(event.id, history);
            }
            // Diagnostics must never prevent delivery to the read consumer.
            try { observe(event as NostrEvent, source); } catch { /* host observation is best effort */ }
            if (seen.has(event.id)) return;
            seen.add(event.id);
            next(event as NostrEvent);
          },
          oneose: () => finishRelay(url),
          onclose(reason) {
            const signer = pool.automaticallyAuth?.(url);
            if (!closed && !retry && signer && reason.startsWith('auth-required: ')) {
              void relay.auth(signer).then(() => subscribe(true)).catch(() => finishRelay(url));
            } else finishRelay(url);
          },
        });
        if (closed && !subscription.closed) subscription.close('paja query closed');
        else if (!subscription.closed) subscriptions.add(subscription);
      };
      subscribe(false);
    }).catch(() => {
      if (!closed) pool.onRelayConnectionFailure?.(url);
      finishRelay(url);
    });
  }
  return {
    unsubscribe(reason = 'paja unsubscribe') {
      if (closed) return;
      closed = true;
      controller.abort();
      for (const subscription of subscriptions) {
        if (subscription.closed) continue;
        // Some adapters return rejecting promises despite nostr-tools' void type.
        try { void Promise.resolve(subscription.close(reason)).catch(() => {}); } catch { /* best effort */ }
      }
      subscriptions.clear();
    },
  };
}

/** Collect until all EOSEs, timeout, abort, or the bounded candidate limit. */
export async function queryPajaLive(
  pool: SimplePool,
  relayUrls: string[],
  filters: NostrFilter[],
  maxWait: number,
  observe: RelayReceiptObserver,
  collectUntilLimit = false,
  signal?: AbortSignal,
): Promise<NostrEvent[]> {
  const batches = await Promise.all((filters.length ? filters : [{}]).map((filter) => {
    const limit = collectUntilLimit && typeof filter.limit === 'number' && filter.limit >= 0
      ? filter.limit : Infinity;
    if (limit === 0 || signal?.aborted) return Promise.resolve([] as NostrEvent[]);
    return new Promise<NostrEvent[]>((resolve) => {
      const events: NostrEvent[] = [];
      let subscription: ReturnType<typeof subscribePajaLive> | undefined;
      let finished = false;
      const finish = (reason: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        subscription?.unsubscribe(reason);
        resolve(events);
      };
      const abort = () => finish('paja query aborted');
      const timer = setTimeout(() => finish('paja query timeout'), maxWait);
      signal?.addEventListener('abort', abort, { once: true });
      subscription = subscribePajaLive(pool, relayUrls, [filter], (item) => {
        if (finished) return;
        if (item === 'EOSE') return finish('closed automatically on eose');
        events.push(item);
        if (events.length >= limit) finish('paja query limit reached');
      }, observe, maxWait, collectUntilLimit ? 'kehto-paja-candidates' : 'kehto-paja-query');
      if (finished) subscription.unsubscribe();
      if (signal?.aborted) abort();
    });
  }));
  const events = new Map<string, NostrEvent>();
  for (const event of batches.flat()) events.set(event.id, event);
  return [...events.values()].sort((a, b) => b.created_at - a.created_at);
}
