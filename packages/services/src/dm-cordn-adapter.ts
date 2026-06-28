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
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import type { NostrEvent, NostrFilter } from '@napplet/core';

declare const btoa: (data: string) => string;
declare const atob: (data: string) => string;

/** Cordn DM client contract. */
export interface CordnDmClient {
  status?(): Promise<Partial<DmStatus>> | Partial<DmStatus>;
  conversations(query?: DmConversationQuery): Promise<DmConversationPage> | DmConversationPage;
  messages(query: DmMessageQuery): Promise<DmMessagePage> | DmMessagePage;
  send(request: DmSendRequest): Promise<DmSendResult>;
  subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void): Promise<DmSubscription> | DmSubscription;
  unsubscribe(subscriptionId: string): Promise<{ ok: boolean }> | { ok: boolean };
  close?(): void;
}

export interface CordnGroupMessage {
  cursor: number;
  gid: string;
  msg_64: string;
  at: number;
}

export interface CordnCoordinatorSubscription {
  stream: AsyncIterable<CordnGroupMessage>;
  result: Promise<{ subscribed: true }>;
  abort(reason?: string): Promise<void>;
}

export interface CordnCoordinatorClient {
  PostGroupMessage(input: { msg_64: string }): Promise<{ cursor: number; gid: string; at: number }>;
  FetchGroupMessages(input: { gid: string; after?: number }): Promise<{ messages: CordnGroupMessage[] }>;
  SubscribeGroupMessages(input: { gid: string; after?: number }): Promise<CordnCoordinatorSubscription>;
  close?(): void;
}

export interface CordnCodecResult {
  msg_64: string;
  gid: string;
}

export interface CordnRelayCoordinatorOptions {
  relayPool: DmRelayPool;
  ownerSecretKey: Uint8Array;
  relays?: string[];
  kind?: number;
  fetchTimeoutMs?: number;
}

/** Options for {@link createCordnDmAdapter}. */
export interface CordnDmAdapterOptions {
  client?: CordnDmClient;
  coordinator?: CordnCoordinatorClient;
  ownerPubkey?: string;
  defaultGroupId?: string;
  store?: DmMemoryStore;
  encodeMessage?(request: DmSendRequest, ownerPubkey?: string): CordnCodecResult;
  decodeMessage?(message: CordnGroupMessage, ownerPubkey?: string): DmMessage;
}

const CORDN_RELAY_GROUP_MESSAGE_KIND = 30383;
let cordnSubCounter = 0;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function encodeBase64(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function decodeBase64(value: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
}

function groupIdFor(request: DmSendRequest, defaultGroupId?: string): string {
  if (request.conversationId?.startsWith('group:')) return request.conversationId.slice('group:'.length);
  if (request.conversationId) return request.conversationId;
  if (defaultGroupId) return defaultGroupId;
  const firstRecipient = request.recipients[0];
  if (firstRecipient) return firstRecipient;
  throw new Error('group id required');
}

function defaultEncodeMessage(request: DmSendRequest, ownerPubkey?: string, defaultGroupId?: string): CordnCodecResult {
  const gid = groupIdFor(request, defaultGroupId);
  return {
    gid,
    msg_64: encodeBase64(JSON.stringify({
      gid,
      pubkey: ownerPubkey ?? '',
      created_at: nowSeconds(),
      kind: 9,
      tags: [],
      content: request.content,
    })),
  };
}

function defaultDecodeMessage(message: CordnGroupMessage, ownerPubkey?: string): DmMessage {
  let payload: { pubkey?: string; created_at?: number; content?: string } = {};
  try {
    payload = JSON.parse(decodeBase64(message.msg_64)) as typeof payload;
  } catch {
    payload = { content: decodeBase64(message.msg_64) };
  }
  return {
    id: `cordn:${message.gid}:${message.cursor}`,
    conversationId: `group:${message.gid}`,
    senderPubkey: payload.pubkey || ownerPubkey || '',
    createdAt: payload.created_at ?? message.at,
    content: payload.content ?? '',
    status: payload.pubkey && payload.pubkey === ownerPubkey ? 'sent' : 'received',
  };
}

function relayUrls(options: CordnRelayCoordinatorOptions, filter: NostrFilter): string[] {
  return options.relays && options.relays.length > 0
    ? options.relays
    : options.relayPool.selectRelayTier([filter]);
}

function parseRelayGroupMessage(event: NostrEvent): CordnGroupMessage | null {
  try {
    const parsed = JSON.parse(event.content) as CordnGroupMessage;
    if (typeof parsed.gid !== 'string' || typeof parsed.cursor !== 'number' || typeof parsed.msg_64 !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createCordnRelayCoordinatorClient(options: CordnRelayCoordinatorOptions): CordnCoordinatorClient {
  const ownerPubkey = getPublicKey(options.ownerSecretKey);
  const kind = options.kind ?? CORDN_RELAY_GROUP_MESSAGE_KIND;
  const cursors = new Map<string, number>();

  async function fetchGroup(gid: string, after = 0): Promise<CordnGroupMessage[]> {
    const filter = { kinds: [kind], '#g': [gid] } as NostrFilter;
    const records: CordnGroupMessage[] = [];
    await new Promise<void>((resolve) => {
      let done = false;
      let handle: { unsubscribe(): void } | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        handle?.unsubscribe();
        resolve();
      };
      const timer = setTimeout(finish, options.fetchTimeoutMs ?? 500);
      handle = options.relayPool.subscribe(
        [filter],
        (item) => {
          if (item === 'EOSE') finish();
          else {
            const parsed = parseRelayGroupMessage(item);
            if (parsed && parsed.cursor > after) records.push(parsed);
          }
        },
        relayUrls(options, filter),
      );
    });
    return records.sort((a, b) => a.cursor - b.cursor);
  }

  return {
    async PostGroupMessage(input) {
      const decoded = JSON.parse(decodeBase64(input.msg_64)) as { gid?: string };
      const gid = decoded.gid;
      if (!gid) throw new Error('group id required');
      const cursor = (cursors.get(gid) ?? 0) + 1;
      cursors.set(gid, cursor);
      const at = nowSeconds();
      const record: CordnGroupMessage = { cursor, gid, msg_64: input.msg_64, at };
      const event = finalizeEvent(
        {
          kind,
          created_at: at,
          tags: [['g', gid], ['p', ownerPubkey]],
          content: JSON.stringify(record),
        },
        options.ownerSecretKey,
      ) as NostrEvent;
      await Promise.resolve(options.relayPool.publish(event));
      return { cursor, gid, at };
    },

    async FetchGroupMessages(input) {
      return { messages: await fetchGroup(input.gid, input.after ?? 0) };
    },

    async SubscribeGroupMessages(input) {
      const filter = { kinds: [kind], '#g': [input.gid] } as NostrFilter;
      const queue: CordnGroupMessage[] = [];
      const waiters: Array<(next: IteratorResult<CordnGroupMessage>) => void> = [];
      let closed = false;
      const push = (message: CordnGroupMessage) => {
        if (message.cursor <= (input.after ?? 0)) return;
        const waiter = waiters.shift();
        if (waiter) waiter({ value: message, done: false });
        else queue.push(message);
      };
      const handle = options.relayPool.subscribe(
        [filter],
        (item) => {
          if (item === 'EOSE') return;
          const message = parseRelayGroupMessage(item);
          if (message) push(message);
        },
        relayUrls(options, filter),
      );
      return {
        result: Promise.resolve({ subscribed: true }),
        stream: {
          [Symbol.asyncIterator]() {
            return {
              next() {
                const existing = queue.shift();
                if (existing) return Promise.resolve({ value: existing, done: false });
                if (closed) return Promise.resolve({ value: undefined, done: true } as IteratorResult<CordnGroupMessage>);
                return new Promise<IteratorResult<CordnGroupMessage>>((resolve) => waiters.push(resolve));
              },
            };
          },
        },
        async abort() {
          closed = true;
          handle.unsubscribe();
          for (const waiter of waiters.splice(0)) waiter({ value: undefined, done: true } as IteratorResult<CordnGroupMessage>);
        },
      };
    },
  };
}

/** Create a Cordn/ContextVM-backed NAP-DM adapter. */
export function createCordnDmAdapter(options: CordnDmAdapterOptions): DmAdapter {
  const store = options.store ?? new DmMemoryStore();
  const live = new Map<string, { abort(): Promise<void>; conversationId?: string }>();
  const ownerPubkey = options.ownerPubkey;

  if (!options.client && !options.coordinator) {
    throw new Error('createCordnDmAdapter: client or coordinator is required');
  }

  return {
    async status(): Promise<DmStatus> {
      const status = await options.client?.status?.();
      return {
        available: status?.available ?? true,
        ownerPubkey: status?.ownerPubkey ?? ownerPubkey,
        implementations: ['cordn', ...(status?.implementations ?? [])],
        capabilities: ['send', 'receive', 'subscribe', 'history', 'contextvm', ...(status?.capabilities ?? [])],
      };
    },
    conversations(query?: DmConversationQuery) {
      if (options.client) return options.client.conversations(query);
      return store.conversations(query);
    },
    async messages(query: DmMessageQuery): Promise<DmMessagePage> {
      if (options.client) return options.client.messages(query);
      const gid = query.conversationId.startsWith('group:') ? query.conversationId.slice('group:'.length) : query.conversationId;
      const fetched = await options.coordinator!.FetchGroupMessages({ gid });
      for (const record of fetched.messages) store.upsertMessage(
        (options.decodeMessage ?? defaultDecodeMessage)(record, ownerPubkey),
        [ownerPubkey ?? '', gid],
      );
      return store.messages(query);
    },
    async send(request: DmSendRequest): Promise<DmSendResult> {
      if (options.client) return options.client.send(request);
      const encoded = (options.encodeMessage ?? ((req, pk) => defaultEncodeMessage(req, pk, options.defaultGroupId)))(request, ownerPubkey);
      const posted = await options.coordinator!.PostGroupMessage({ msg_64: encoded.msg_64 });
      const record: CordnGroupMessage = { ...posted, msg_64: encoded.msg_64 };
      const message = store.upsertMessage((options.decodeMessage ?? defaultDecodeMessage)(record, ownerPubkey), [ownerPubkey ?? '', encoded.gid]);
      return { ok: true, message: { ...message, status: 'sent' } };
    },
    async subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void): Promise<DmSubscription> {
      if (options.client) return options.client.subscribe(request, onMessage);
      const conversationId = request.conversationId ?? (options.defaultGroupId ? `group:${options.defaultGroupId}` : undefined);
      if (!conversationId) throw new Error('group id required');
      const gid = conversationId.startsWith('group:') ? conversationId.slice('group:'.length) : conversationId;
      const fetched = await options.coordinator!.FetchGroupMessages({ gid });
      let after = 0;
      for (const record of fetched.messages) {
        after = Math.max(after, record.cursor);
        const message = store.upsertMessage((options.decodeMessage ?? defaultDecodeMessage)(record, ownerPubkey), [ownerPubkey ?? '', gid]);
        onMessage(message);
      }
      const subscription = await options.coordinator!.SubscribeGroupMessages({ gid, after });
      const subscriptionId = `dm-cordn-${++cordnSubCounter}`;
      live.set(subscriptionId, { abort: () => subscription.abort('dm.unsubscribe'), conversationId });
      void (async () => {
        for await (const record of subscription.stream) {
          const message = store.upsertMessage((options.decodeMessage ?? defaultDecodeMessage)(record, ownerPubkey), [ownerPubkey ?? '', gid]);
          onMessage(message);
        }
      })();
      return { subscriptionId };
    },
    unsubscribe(subscriptionId: string) {
      if (options.client) return options.client.unsubscribe(subscriptionId);
      const sub = live.get(subscriptionId);
      if (!sub) return { ok: false };
      live.delete(subscriptionId);
      void sub.abort();
      return { ok: true };
    },
    close(): void {
      for (const [id, sub] of live) {
        live.delete(id);
        void sub.abort();
      }
      options.client?.close?.();
      options.coordinator?.close?.();
    },
  };
}
