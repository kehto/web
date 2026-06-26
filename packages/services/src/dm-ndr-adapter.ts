/**
 * dm-ndr-adapter.ts -- Nostr Double Ratchet adapter for NAP-DM.
 *
 * Kehto accepts a structural NDR runtime instead of depending directly on the
 * moving nostr-double-ratchet package API. Hosts can pass NdrRuntime instances.
 */

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
import { finalizeEvent } from 'nostr-tools/pure';
import type { NostrEvent, NostrFilter } from '@napplet/core';

/** Minimal event shape returned by NDR runtimes for sent or received messages. */
export interface NdrRumorLike {
  id: string;
  pubkey?: string;
  created_at?: number;
  content?: string;
}

/** Minimal structural subset of nostr-double-ratchet NdrRuntime. */
export interface NdrRuntimeLike {
  getState?(): { ownerPubkey?: string | null; currentDevicePubkey?: string | null };
  initForOwner?(ownerPubkey: string): Promise<unknown>;
  setupUser?(pubkey: string, ownerPubkey?: string): Promise<void>;
  sendMessage(recipientPubkey: string, content: string, options?: unknown, ownerPubkey?: string): Promise<NdrRumorLike>;
  onSessionEvent(callback: (event: NdrRumorLike, from: string, meta?: unknown) => void): () => void;
  close?(): void;
}

export interface NdrRelayTransport {
  nostrSubscribe(filter: NostrFilter, onEvent: (event: NostrEvent) => void): () => void;
  nostrFetch(filter: NostrFilter): Promise<NostrEvent[]>;
  nostrPublish(event: Partial<NostrEvent>, innerEventId?: string): Promise<NostrEvent>;
}

export interface NdrRelayTransportOptions {
  relayPool: DmRelayPool;
  publishSecretKey?: Uint8Array;
  relays?: string[];
  fetchTimeoutMs?: number;
}

/** Options for {@link createNdrDmAdapter}. */
export interface NdrDmAdapterOptions {
  runtime: NdrRuntimeLike;
  ownerPubkey: string;
  store?: DmMemoryStore;
  available?: boolean;
}

let ndrSubCounter = 0;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function relaysFor(options: NdrRelayTransportOptions, filter: NostrFilter): string[] {
  return options.relays && options.relays.length > 0
    ? options.relays
    : options.relayPool.selectRelayTier([filter]);
}

function signedEvent(event: Partial<NostrEvent>, secretKey?: Uint8Array): NostrEvent {
  if (
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.sig === 'string' &&
    typeof event.kind === 'number' &&
    typeof event.created_at === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string'
  ) {
    return event as NostrEvent;
  }
  if (!secretKey) throw new Error('publishSecretKey required for unsigned NDR events');
  return finalizeEvent(
    {
      kind: event.kind ?? 1060,
      created_at: event.created_at ?? nowSeconds(),
      tags: event.tags ?? [],
      content: event.content ?? '',
    },
    secretKey,
  ) as NostrEvent;
}

/** Build the transport contract expected by nostr-double-ratchet over Kehto relay service hooks. */
export function createNdrRelayTransport(options: NdrRelayTransportOptions): NdrRelayTransport {
  return {
    nostrSubscribe(filter, onEvent) {
      const handle = options.relayPool.subscribe(
        [filter],
        (item) => {
          if (item !== 'EOSE') onEvent(item);
        },
        relaysFor(options, filter),
      );
      return () => handle.unsubscribe();
    },

    nostrFetch(filter) {
      const events: NostrEvent[] = [];
      return new Promise((resolve) => {
        let done = false;
        let handle: { unsubscribe(): void } | undefined;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          handle?.unsubscribe();
          resolve(events);
        };
        const timer = setTimeout(finish, options.fetchTimeoutMs ?? 500);
        handle = options.relayPool.subscribe(
          [filter],
          (item) => {
            if (item === 'EOSE') finish();
            else events.push(item);
          },
          relaysFor(options, filter),
        );
      });
    },

    async nostrPublish(event) {
      const signed = signedEvent(event, options.publishSecretKey);
      await Promise.resolve(options.relayPool.publish(signed));
      return signed;
    },
  };
}

/** Create an NDR-backed NAP-DM adapter. */
export function createNdrDmAdapter(options: NdrDmAdapterOptions): DmAdapter {
  const store = options.store ?? new DmMemoryStore();
  const live = new Map<string, { conversationId?: string; onMessage(message: DmMessage): void }>();
  const detach = options.runtime.onSessionEvent((event, from) => {
    const participants = [options.ownerPubkey, from];
    const conversationId = store.conversationIdFor(participants);
    const message = store.upsertMessage(
      {
        id: event.id,
        conversationId,
        senderPubkey: from,
        createdAt: event.created_at ?? Math.floor(Date.now() / 1000),
        content: event.content ?? '',
        status: 'received',
      },
      participants,
    );
    for (const sub of live.values()) {
      if (!sub.conversationId || sub.conversationId === message.conversationId) sub.onMessage(message);
    }
  });

  return {
    status(): DmStatus {
      return {
        available: options.available ?? true,
        ownerPubkey: options.ownerPubkey,
        implementations: ['ndr'],
        capabilities: ['send', 'receive', 'subscribe', 'history', 'double-ratchet'],
      };
    },

    conversations(query?: DmConversationQuery): DmConversationPage {
      return store.conversations(query);
    },

    messages(query: DmMessageQuery): DmMessagePage {
      return store.messages(query);
    },

    async send(request: DmSendRequest): Promise<DmSendResult> {
      const recipient = request.recipients[0];
      if (!recipient) throw new Error('recipient required');
      await options.runtime.setupUser?.(recipient, options.ownerPubkey);
      const rumor = await options.runtime.sendMessage(recipient, request.content, undefined, options.ownerPubkey);
      const message = store.upsertMessage(
        {
          id: request.clientMessageId ?? rumor.id,
          conversationId: request.conversationId ?? store.conversationIdFor([options.ownerPubkey, recipient]),
          senderPubkey: options.ownerPubkey,
          createdAt: rumor.created_at ?? Math.floor(Date.now() / 1000),
          content: request.content,
          status: 'sent',
        },
        [options.ownerPubkey, recipient],
      );
      return { ok: true, message };
    },

    subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void): DmSubscription {
      const subscriptionId = `dm-ndr-${++ndrSubCounter}`;
      live.set(subscriptionId, { conversationId: request.conversationId, onMessage });
      return { subscriptionId };
    },

    unsubscribe(subscriptionId: string) {
      return { ok: live.delete(subscriptionId) };
    },

    close(): void {
      live.clear();
      detach();
      options.runtime.close?.();
    },
  };
}
