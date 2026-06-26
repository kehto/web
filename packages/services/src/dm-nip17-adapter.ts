/**
 * dm-nip17-adapter.ts -- concrete NIP-17 adapter for NAP-DM.
 *
 * Uses nostr-tools NIP-17 gift wrapping and an injected relay pool. The owner
 * key is shell/runtime-owned; napplets only see normalized cleartext messages.
 */

import type { NostrEvent, NostrFilter } from '@napplet/core';
import { getPublicKey } from 'nostr-tools/pure';
import * as nip17 from 'nostr-tools/nip17';
import type {
  DmAdapter,
  DmConversationPage,
  DmConversationQuery,
  DmMessage,
  DmMessagePage,
  DmMessageQuery,
  DmRelayPool,
  DmSendRequest,
  DmSendResult,
  DmStatus,
  DmSubscribeRequest,
  DmSubscription,
} from './dm-types.js';
import { DmMemoryStore } from './dm-memory-store.js';

const NIP17_GIFT_WRAP_KIND = 1059;
let subscriptionCounter = 0;

/** Options for {@link createNip17DmAdapter}. */
export interface Nip17DmAdapterOptions {
  /** Shell-owned secret key used for NIP-17 seal creation/unwrapping. */
  ownerSecretKey: Uint8Array;
  /** Relay pool used for publish/subscribe. */
  relayPool: DmRelayPool;
  /** Default relays for NIP-17 DM traffic. */
  relays?: string[];
  /** Optional normalized message store. Defaults to an in-memory store. */
  store?: DmMemoryStore;
}

interface LiveSub {
  handle: { unsubscribe(): void };
  conversationId?: string;
  onMessage(message: DmMessage): void;
}

function tagsFor(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name && typeof tag[1] === 'string').map((tag) => tag[1]);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Create a concrete NIP-17 NAP-DM adapter.
 *
 * @param options - Owner key, relay pool, relay hints, optional store.
 * @returns DM adapter for {@link createDmService}.
 */
export function createNip17DmAdapter(options: Nip17DmAdapterOptions): DmAdapter {
  const ownerPubkey = getPublicKey(options.ownerSecretKey);
  const store = options.store ?? new DmMemoryStore();
  const live = new Map<string, LiveSub>();

  function relaysFor(filters: NostrFilter[]): string[] {
    return options.relays && options.relays.length > 0
      ? options.relays
      : options.relayPool.selectRelayTier(filters);
  }

  function normalizeRumor(rumor: NostrEvent, status: DmMessage['status']): DmMessage | null {
    if (rumor.kind !== 14) return null;
    const participants = [...new Set([ownerPubkey, rumor.pubkey, ...tagsFor(rumor.tags, 'p')])];
    const conversationId = store.conversationIdFor(participants);
    return store.upsertMessage(
      {
        id: rumor.id,
        conversationId,
        senderPubkey: rumor.pubkey,
        createdAt: rumor.created_at,
        content: rumor.content,
        status,
      },
      participants,
    );
  }

  return {
    status(): DmStatus {
      return {
        available: options.relayPool.isAvailable(),
        ownerPubkey,
        implementations: ['nip17'],
        capabilities: ['send', 'receive', 'subscribe', 'history'],
      };
    },

    conversations(query?: DmConversationQuery): DmConversationPage {
      return store.conversations(query);
    },

    messages(query: DmMessageQuery): DmMessagePage {
      return store.messages(query);
    },

    async send(request: DmSendRequest): Promise<DmSendResult> {
      if (!options.relayPool.isAvailable()) throw new Error('relay unavailable');
      if (!Array.isArray(request.recipients) || request.recipients.length === 0) {
        throw new Error('recipient required');
      }
      if (typeof request.content !== 'string' || request.content.length === 0) {
        throw new Error('content required');
      }
      const recipients = [...new Set(request.recipients)];
      const wraps = nip17.wrapManyEvents(
        options.ownerSecretKey,
        recipients.map((publicKey) => ({ publicKey })),
        request.content,
      ) as NostrEvent[];
      for (const wrap of wraps) options.relayPool.publish(wrap);
      const conversationId = request.conversationId ?? store.conversationIdFor([ownerPubkey, ...recipients]);
      const message = store.upsertMessage(
        {
          id: request.clientMessageId ?? wraps[0]?.id ?? `dm-${nowSeconds()}`,
          conversationId,
          senderPubkey: ownerPubkey,
          createdAt: nowSeconds(),
          content: request.content,
          status: 'sent',
        },
        [ownerPubkey, ...recipients],
      );
      return { ok: true, message };
    },

    subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void): DmSubscription {
      if (!options.relayPool.isAvailable()) throw new Error('relay unavailable');
      const subscriptionId = `dm-nip17-${++subscriptionCounter}`;
      const filters = [{ kinds: [NIP17_GIFT_WRAP_KIND], '#p': [ownerPubkey] }] as NostrFilter[];
      const handle = options.relayPool.subscribe(
        filters,
        (item) => {
          if (item === 'EOSE') return;
          let rumor: NostrEvent;
          try {
            rumor = nip17.unwrapEvent(item, options.ownerSecretKey) as NostrEvent;
          } catch {
            return;
          }
          const message = normalizeRumor(rumor, 'received');
          if (!message) return;
          for (const sub of live.values()) {
            if (!sub.conversationId || sub.conversationId === message.conversationId) sub.onMessage(message);
          }
        },
        relaysFor(filters),
      );
      live.set(subscriptionId, { handle, conversationId: request.conversationId, onMessage });
      return { subscriptionId };
    },

    unsubscribe(subscriptionId: string) {
      const sub = live.get(subscriptionId);
      if (!sub) return { ok: false };
      sub.handle.unsubscribe();
      live.delete(subscriptionId);
      return { ok: true };
    },

    close(): void {
      for (const sub of live.values()) sub.handle.unsubscribe();
      live.clear();
    },
  };
}
