/**
 * dm-nip17-adapter.ts -- concrete NIP-17 adapter for NAP-DM.
 *
 * Uses nostr-tools NIP-17 gift wrapping and an injected relay pool. The owner
 * key is shell/runtime-owned; napplets only see normalized cleartext messages.
 */

import type { NostrEvent, NostrFilter } from '@napplet/core';
import * as nip44 from 'nostr-tools/nip44';
import {
  getEventHash,
  getPublicKey,
  validateEvent,
  verifyEvent,
} from 'nostr-tools/pure';
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
const NIP59_SEAL_KIND = 13;
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
  /** Runtime policy invoked once before encrypted relay publication. */
  authorizeSend?(request: DmSendRequest): boolean | Promise<boolean>;
}

interface LiveSub {
  handle?: { unsubscribe(): void };
  conversationId?: string;
  onMessage(message: DmMessage): void;
}

function tagsFor(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name && typeof tag[1] === 'string').map((tag) => tag[1]);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

class Nip17DmRuntime {
  private readonly ownerPubkey: string;
  private readonly store: DmMemoryStore;
  private readonly live = new Map<string, LiveSub>();
  private historyLoaded = false;
  private historyLoading: Promise<void> | null = null;

  constructor(private readonly options: Nip17DmAdapterOptions) {
    this.ownerPubkey = getPublicKey(options.ownerSecretKey);
    this.store = options.store ?? new DmMemoryStore();
  }

  adapter(): DmAdapter {
    return {
      status: () => this.status(),
      conversations: (query) => this.conversations(query),
      messages: (query) => this.messages(query),
      send: (request) => this.send(request),
      subscribe: (request, onMessage) => this.subscribe(request, onMessage),
      unsubscribe: (subscriptionId) => this.unsubscribe(subscriptionId),
      close: () => this.close(),
    };
  }

  private relaysFor(filters: NostrFilter[]): string[] {
    return this.options.relays && this.options.relays.length > 0
      ? this.options.relays
      : this.options.relayPool.selectRelayTier(filters);
  }

  private normalizeRumor(rumor: NostrEvent, status: DmMessage['status']): DmMessage | null {
    if (rumor.kind !== 14) return null;
    const participants = [...new Set([this.ownerPubkey, rumor.pubkey, ...tagsFor(rumor.tags, 'p')])];
    const conversationId = this.store.conversationIdFor(participants);
    return this.store.upsertMessage({
      id: rumor.id,
      conversationId,
      senderPubkey: rumor.pubkey,
      createdAt: rumor.created_at,
      content: rumor.content,
      status,
    }, participants);
  }

  private decryptEvent(event: NostrEvent): unknown {
    return JSON.parse(nip44.decrypt(
      event.content,
      nip44.getConversationKey(this.options.ownerSecretKey, event.pubkey),
    ));
  }

  private unwrapVerified(wrap: NostrEvent): NostrEvent | null {
    if (
      wrap.kind !== NIP17_GIFT_WRAP_KIND
      || !verifyEvent(wrap)
      || !wrap.tags.some((tag) => tag[0] === 'p' && tag[1] === this.ownerPubkey)
    ) return null;
    try {
      const seal = this.decryptEvent(wrap);
      if (
        !validateEvent(seal)
        || typeof (seal as { id?: unknown }).id !== 'string'
        || typeof (seal as { sig?: unknown }).sig !== 'string'
        || seal.kind !== NIP59_SEAL_KIND
      ) return null;
      const signedSeal = seal as NostrEvent;
      if (!verifyEvent(signedSeal)) return null;
      const rumor = this.decryptEvent(signedSeal);
      if (!validateEvent(rumor)) return null;
      const candidate = rumor as NostrEvent;
      if (
        candidate.kind !== 14
        || candidate.pubkey !== signedSeal.pubkey
        || typeof candidate.id !== 'string'
        || candidate.id !== getEventHash(candidate)
      ) return null;
      return candidate;
    } catch {
      return null;
    }
  }

  private ingestWrap(wrap: NostrEvent, status: DmMessage['status']): DmMessage | null {
    const rumor = this.unwrapVerified(wrap);
    return rumor ? this.normalizeRumor(rumor, status) : null;
  }

  private async loadHistory(): Promise<void> {
    if (this.historyLoaded || !this.options.relayPool.query) return;
    this.historyLoading ??= (async () => {
      const filters = [{ kinds: [NIP17_GIFT_WRAP_KIND], '#p': [this.ownerPubkey], limit: 1_000 }] as NostrFilter[];
      const wraps = await this.options.relayPool.query!(filters, this.relaysFor(filters));
      for (const wrap of wraps) this.ingestWrap(wrap, 'received');
      this.historyLoaded = true;
    })().finally(() => { this.historyLoading = null; });
    await this.historyLoading;
  }

  private status(): DmStatus {
    return {
      available: this.options.relayPool.isAvailable(),
      ownerPubkey: this.ownerPubkey,
      implementations: ['nip17'],
      capabilities: ['send', 'receive', 'subscribe', 'history'],
    };
  }

  private async conversations(query?: DmConversationQuery): Promise<DmConversationPage> {
    await this.loadHistory();
    return this.store.conversations(query);
  }

  private async messages(query: DmMessageQuery): Promise<DmMessagePage> {
    await this.loadHistory();
    return this.store.messages(query);
  }

  private async send(request: DmSendRequest): Promise<DmSendResult> {
    if (!this.options.relayPool.isAvailable()) throw new Error('relay unavailable');
    if (!Array.isArray(request.recipients) || request.recipients.length === 0) throw new Error('invalid recipient');
    if (request.recipients.some((recipient) => !/^[0-9a-f]{64}$/.test(recipient))) throw new Error('invalid recipient');
    if (typeof request.content !== 'string' || request.content.length === 0) throw new Error('content required');
    if (this.options.authorizeSend && !await this.options.authorizeSend(request)) throw new Error('forbidden');
    const recipients = [...new Set(request.recipients)];
    const wraps = nip17.wrapManyEvents(
      this.options.ownerSecretKey,
      recipients.map((publicKey) => ({ publicKey })),
      request.content,
    ) as NostrEvent[];
    for (const wrap of wraps) await Promise.resolve(this.options.relayPool.publish(wrap));
    const conversationId = request.conversationId ?? this.store.conversationIdFor([this.ownerPubkey, ...recipients]);
    const message = this.store.upsertMessage({
      id: request.clientMessageId ?? wraps[0]?.id ?? `dm-${nowSeconds()}`,
      conversationId,
      senderPubkey: this.ownerPubkey,
      createdAt: nowSeconds(),
      content: request.content,
      status: 'sent',
    }, [this.ownerPubkey, ...recipients]);
    return { ok: true, message };
  }

  private async subscribe(
    request: DmSubscribeRequest,
    onMessage: (message: DmMessage) => void,
  ): Promise<DmSubscription> {
    if (!this.options.relayPool.isAvailable()) throw new Error('relay unavailable');
    await this.loadHistory();
    const subscriptionId = `dm-nip17-${++subscriptionCounter}`;
    const filters = [{ kinds: [NIP17_GIFT_WRAP_KIND], '#p': [this.ownerPubkey] }] as NostrFilter[];
    const sub: LiveSub = { conversationId: request.conversationId, onMessage };
    this.live.set(subscriptionId, sub);
    try {
      const handle = this.options.relayPool.subscribe(filters, (item) => {
        if (item === 'EOSE') return;
        const message = this.ingestWrap(item, 'received');
        if (!message) return;
        const active = this.live.get(subscriptionId);
        if (active && (!active.conversationId || active.conversationId === message.conversationId)) active.onMessage(message);
      }, this.relaysFor(filters));
      if (this.live.get(subscriptionId) !== sub) {
        handle.unsubscribe();
        throw new Error('subscription cancelled');
      }
      sub.handle = handle;
      return { subscriptionId };
    } catch (error) {
      this.live.delete(subscriptionId);
      throw error;
    }
  }

  private unsubscribe(subscriptionId: string): { ok: boolean } {
    const sub = this.live.get(subscriptionId);
    if (!sub) return { ok: false };
    sub.handle?.unsubscribe();
    this.live.delete(subscriptionId);
    return { ok: true };
  }

  private close(): void {
    for (const sub of this.live.values()) sub.handle?.unsubscribe();
    this.live.clear();
  }
}

/**
 * Create a concrete NIP-17 NAP-DM adapter.
 *
 * @param options - Owner key, relay pool, relay hints, optional store.
 * @returns DM adapter for {@link createDmService}.
 */
export function createNip17DmAdapter(options: Nip17DmAdapterOptions): DmAdapter {
  return new Nip17DmRuntime(options).adapter();
}
