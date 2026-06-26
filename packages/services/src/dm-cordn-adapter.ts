import type {
  DmAdapter,
  DmConversationPage,
  DmConversationQuery,
  DmMessage,
  DmMessagePage,
  DmMessageQuery,
  DmSendRequest,
  DmSendResult,
  DmStatus,
  DmSubscribeRequest,
  DmSubscription,
} from './dm-types.js';

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

/** Options for {@link createCordnDmAdapter}. */
export interface CordnDmAdapterOptions {
  client: CordnDmClient;
  ownerPubkey?: string;
}

/** Create a Cordn/ContextVM-backed NAP-DM adapter. */
export function createCordnDmAdapter(options: CordnDmAdapterOptions): DmAdapter {
  return {
    async status(): Promise<DmStatus> {
      const status = await options.client.status?.();
      return {
        available: status?.available ?? true,
        ownerPubkey: status?.ownerPubkey ?? options.ownerPubkey,
        implementations: ['cordn', ...(status?.implementations ?? [])],
        capabilities: ['send', 'receive', 'subscribe', 'history', 'contextvm', ...(status?.capabilities ?? [])],
      };
    },
    conversations(query?: DmConversationQuery) {
      return options.client.conversations(query);
    },
    messages(query: DmMessageQuery) {
      return options.client.messages(query);
    },
    send(request: DmSendRequest) {
      return options.client.send(request);
    },
    subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void) {
      return options.client.subscribe(request, onMessage);
    },
    unsubscribe(subscriptionId: string) {
      return options.client.unsubscribe(subscriptionId);
    },
    close(): void {
      options.client.close?.();
    },
  };
}
