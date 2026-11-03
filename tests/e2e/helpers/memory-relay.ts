/**
 * In-test Nostr relay for Paja e2e specs.
 *
 * Routes one `wss://` URL through Playwright's WebSocket interception so the
 * browser-side relay pool talks to a deterministic NIP-01 relay that lives in
 * the test process: it verifies EVENT signatures, stores regular events,
 * answers REQ with stored matches followed by EOSE, keeps subscriptions live
 * for later events, and honours CLOSE. Specs observe what actually crossed
 * the wire instead of trusting the napplet-side result alone.
 */
import type { Page, WebSocketRoute } from '@playwright/test';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { verifyEvent, type NostrEvent } from 'nostr-tools/pure';

/** A relay client socket plus its live subscriptions. */
interface RelayClient {
  readonly socket: WebSocketRoute;
  readonly subscriptions: Map<string, Filter[]>;
}

/** Deterministic NIP-01 relay observed by a spec. */
export interface MemoryRelay {
  /** Relay URL without a trailing slash, as configured in Paja. */
  readonly url: string;
  /** Valid EVENT messages received from browser clients, in arrival order. */
  readonly published: NostrEvent[];
  /** Every REQ filter list received, in arrival order. */
  readonly requests: Filter[][];
  /** Subscription ids closed by a client CLOSE message. */
  readonly closed: string[];
  /** Number of live subscriptions across all sockets. */
  liveSubscriptionCount(): number;
  /** Store a relay-side event and deliver it to matching live subscriptions. */
  store(event: NostrEvent): void;
  /** Observe each valid client-published event after it is acknowledged. */
  onPublish(handler: (event: NostrEvent) => void): void;
}

/** Ephemeral kinds (NIP-01) are delivered live but never stored. */
function isEphemeral(kind: number): boolean {
  return kind >= 20_000 && kind < 30_000;
}

/**
 * Install a memory relay for `url` on `page`.
 *
 * @param page - Playwright page whose WebSockets to intercept.
 * @param url - Relay URL configured in Paja (with or without a trailing slash).
 * @returns The relay handle used to seed and observe traffic.
 * @example
 * ```ts
 * const relay = await installMemoryRelay(page, 'wss://flows-relay.example');
 * relay.store(finalizeEvent({ kind: 1, created_at: 1, tags: [], content: 'hi' }, key));
 * ```
 */
export async function installMemoryRelay(page: Page, url: string): Promise<MemoryRelay> {
  const normalized = url.replace(/\/$/, '');
  const clients = new Set<RelayClient>();
  const stored: NostrEvent[] = [];
  const published: NostrEvent[] = [];
  const requests: Filter[][] = [];
  const closed: string[] = [];
  const publishHandlers: Array<(event: NostrEvent) => void> = [];

  const deliver = (event: NostrEvent): void => {
    for (const client of clients) {
      for (const [subId, filters] of client.subscriptions) {
        if (matchFilters(filters, event)) client.socket.send(JSON.stringify(['EVENT', subId, event]));
      }
    }
  };
  const store = (event: NostrEvent): void => {
    if (!isEphemeral(event.kind)) stored.push(event);
    deliver(event);
  };

  await page.routeWebSocket((candidate) => candidate.href.replace(/\/$/, '') === normalized, (socket) => {
    const client: RelayClient = { socket, subscriptions: new Map() };
    clients.add(client);
    socket.onClose(() => clients.delete(client));
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as unknown[];
      const [verb] = message;
      if (verb === 'EVENT') {
        const event = message[1] as NostrEvent;
        if (!verifyEvent(event)) {
          socket.send(JSON.stringify(['OK', event?.id ?? '', false, 'invalid: bad signature']));
          return;
        }
        published.push(event);
        socket.send(JSON.stringify(['OK', event.id, true, '']));
        store(event);
        for (const handler of publishHandlers) handler(event);
        return;
      }
      if (verb === 'REQ') {
        const subId = String(message[1]);
        const filters = message.slice(2) as Filter[];
        requests.push(filters);
        client.subscriptions.set(subId, filters);
        for (const event of stored) {
          if (matchFilters(filters, event)) socket.send(JSON.stringify(['EVENT', subId, event]));
        }
        socket.send(JSON.stringify(['EOSE', subId]));
        return;
      }
      if (verb === 'CLOSE') {
        const subId = String(message[1]);
        client.subscriptions.delete(subId);
        closed.push(subId);
      }
    });
  });

  return {
    url: normalized,
    published,
    requests,
    closed,
    liveSubscriptionCount: () => [...clients].reduce((count, client) => count + client.subscriptions.size, 0),
    store,
    onPublish: (handler) => {
      publishHandlers.push(handler);
    },
  };
}
