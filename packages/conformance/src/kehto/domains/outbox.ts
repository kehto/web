import { createOutboxService, createRelayPoolOutboxRouter, type OutboxRelayPool } from '@kehto/services';
import { verifyEvent } from 'nostr-tools/pure';
import type { NostrEvent } from 'nostr-tools';
import { OUTBOX_PUSH_TAG, OUTBOX_SEED_EVENT } from '../../fixtures/outbox.js';
import { createMemoryRelay } from './memory-relay.js';
import type { DomainBackendModule } from './types.js';

/** Two relay URLs served by one in-memory relay, so every read sees each event twice and must deduplicate. */
const OUTBOX_RELAYS = ['wss://outbox-a.conformance.invalid', 'wss://outbox-b.conformance.invalid'];

/**
 * NAP-OUTBOX backend: the reference outbox service over the reference
 * relay-pool outbox router (planned execution, signature validation, dedup),
 * driving an in-memory relay. Every author's NIP-65 list names both relays.
 */
export const OUTBOX_BACKEND: DomainBackendModule = {
  domain: 'outbox',
  create({ user }) {
    const relay = createMemoryRelay([structuredClone(OUTBOX_SEED_EVENT) as unknown as NostrEvent]);
    const relayPool: OutboxRelayPool = {
      subscribe: (filters, _relayUrls, callback) => relay.subscribe(filters, callback),
      publish(event, relayUrls) {
        relay.publish(event);
        return Object.fromEntries(relayUrls.map((url) => [url, true]));
      },
      isAvailable: () => true,
    };
    const router = createRelayPoolOutboxRouter({
      relayPool,
      loadRelayLists: (pubkeys) => new Map(pubkeys.map((pubkey) => [pubkey, { read: [...OUTBOX_RELAYS], write: [...OUTBOX_RELAYS] }])),
      fallbackRelays: [...OUTBOX_RELAYS],
      signEvent: async (template) => {
        const signer = user.current();
        if (!signer) throw new Error('no signer');
        return signer.signEvent(template) as Promise<NostrEvent>;
      },
      getSignerPubkey: () => user.pubkey() ?? '',
      verifyEvent: (event) => verifyEvent(event as NostrEvent),
      defaultTimeoutMs: 1000,
    });
    return {
      services: { outbox: createOutboxService({ router }) },
      controls: {
        // Another user publishes a note matching the push fixture's subscription.
        'outbox.inject': () => relay.inject({ kind: 1, content: 'conformance outbox push', tags: [[...OUTBOX_PUSH_TAG]] }).id,
        'outbox.liveSubscriptions': () => relay.liveSubscriptions(),
      },
    };
  },
};
