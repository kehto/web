import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import {
  createDmService,
  createNip17DmAdapter,
  type DmRelayPool,
  type DmService,
} from '@kehto/services';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import type { PajaRelayBackend } from './browser-relay-runtime.js';
import { getPajaRelayUrls } from './browser-relay-runtime.js';
import type { PajaSimulation } from './simulation.js';

type DevRuntimeConfirmation = (
  request:
    | { readonly action: 'sign'; readonly event: NostrEvent | Partial<NostrEvent> }
    | { readonly action: 'dm'; readonly recipients: readonly string[]; readonly content: string; readonly warning: string },
) => boolean | Promise<boolean>;

const DEV_SIGNER_SECRET_KEY = generateSecretKey();

/** Public key of Paja's ephemeral development signer. */
export const PAJA_DEV_SIGNER_PUBKEY = getPublicKey(DEV_SIGNER_SECRET_KEY);

/** Create Paja's real local development signer. */
export function createPajaDevSigner(
  getSimulation: () => PajaSimulation,
  confirm: DevRuntimeConfirmation,
): Signer {
  return {
    getPublicKey: () => PAJA_DEV_SIGNER_PUBKEY,
    getRelays: () => Object.fromEntries(getPajaRelayUrls(getSimulation()).map((relay) => [relay, { read: true, write: true }])),
    async signEvent(event: Parameters<typeof finalizeEvent>[0]): Promise<NostrEvent> {
      if (!await confirm({ action: 'sign', event: event as Partial<NostrEvent> })) {
        throw new Error('Paja signing request denied');
      }
      const template = { ...event };
      template.created_at ??= Math.floor(Date.now() / 1000);
      template.tags ??= [];
      template.content ??= '';
      return finalizeEvent(template, DEV_SIGNER_SECRET_KEY) as NostrEvent;
    },
    nip44: {
      encrypt(pubkey, plaintext) {
        return Promise.resolve(nip44.encrypt(plaintext, nip44.getConversationKey(DEV_SIGNER_SECRET_KEY, pubkey)));
      },
      decrypt(pubkey, ciphertext) {
        return Promise.resolve(nip44.decrypt(ciphertext, nip44.getConversationKey(DEV_SIGNER_SECRET_KEY, pubkey)));
      },
    },
  };
}

function createDmRelayPool(backend: PajaRelayBackend, getRelays: () => string[]): DmRelayPool {
  return {
    subscribe(filters, callback, relayUrls) {
      const subscription = backend.subscription(relayUrls ?? getRelays(), filters).subscribe((item) => {
        if (item === 'EOSE' || (typeof item === 'object' && item !== null)) callback(item as NostrEvent | 'EOSE');
      });
      return { unsubscribe: () => subscription.unsubscribe() };
    },
    publish: (event) => backend.publishDmGiftWrap(getRelays(), event),
    query: (filters, relayUrls) => backend.query(relayUrls ?? getRelays(), filters),
    selectRelayTier: (_filters: NostrFilter[]) => getRelays(),
    isAvailable: () => backend.isAvailable(),
  };
}

/** Create Paja's live-relay NIP-17 service using its runtime-owned dev key. */
export function createPajaDevDmService(
  backend: PajaRelayBackend,
  getRelays: () => string[],
  confirm: DevRuntimeConfirmation,
): DmService {
  return createDmService({
    adapter: createNip17DmAdapter({
      ownerSecretKey: DEV_SIGNER_SECRET_KEY,
      relayPool: createDmRelayPool(backend, getRelays),
      authorizeSend: async (request) => confirm({
        action: 'dm',
        recipients: request.recipients,
        content: request.content,
        warning: 'This publishes encrypted NIP-17 gift wraps to the configured relays.',
      }),
    }),
  });
}
