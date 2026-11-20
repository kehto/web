import { createRelayPoolService } from '@kehto/services';
import { RELAY_PUSH_TAG } from '../../fixtures/relay.js';
import { createMemoryRelay } from './memory-relay.js';
import type { DomainBackendModule } from './types.js';

/** The one relay URL the in-memory pool claims to be. */
export const MEMORY_RELAY_URL = 'wss://relay.conformance.invalid';

/**
 * NAP-RELAY backend: the reference relay pool service over an in-memory relay.
 * Subscriptions replay stored events then EOSE; publishes are stored and fanned
 * out to matching subscriptions, the publisher's own included.
 */
export const RELAY_BACKEND: DomainBackendModule = {
  domain: 'relay',
  create() {
    const relay = createMemoryRelay();
    const service = createRelayPoolService({
      subscribe: (filters, callback) => relay.subscribe(filters, (item) => callback(item, [MEMORY_RELAY_URL])),
      publish: (event) => relay.publish(event),
      publishToRelays: (_relayUrls, event) => relay.publish(event),
      selectRelayTier: () => [MEMORY_RELAY_URL],
      selectPublishRelayTier: () => [MEMORY_RELAY_URL],
      isAvailable: () => true,
    });
    return {
      services: { relay: service },
      controls: {
        // Another user publishes a note matching the push fixture's subscription.
        'relay.inject': () => relay.inject({ kind: 1, content: 'conformance relay push', tags: [[...RELAY_PUSH_TAG]] }).id,
        'relay.liveSubscriptions': () => relay.liveSubscriptions(),
      },
    };
  },
};
