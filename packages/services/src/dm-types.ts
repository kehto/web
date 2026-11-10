import type {
  DmConversationPage,
  DmConversationQuery,
  DmMessage,
  DmMessagePage,
  DmMessageQuery,
  DmOk,
  DmSendRequest,
  DmSendResult,
  DmStatus,
  DmSubscribeRequest,
  DmSubscription,
  NostrEvent,
  NostrFilter,
} from '@napplet/core';

export type {
  DmConversation,
  DmConversationPage,
  DmConversationQuery,
  DmError,
  DmHexPubkey,
  DmMessage,
  DmMessagePage,
  DmMessageQuery,
  DmMessageStatus,
  DmOk,
  DmPeer,
  DmSendRequest,
  DmSendResult,
  DmStatus,
  DmSubscribeRequest,
  DmSubscription,
  DmTimestamp,
} from '@napplet/core';
export type {
  DmConversationsMessage,
  DmConversationsResultMessage,
  DmInboundMessage,
  DmMessageEventMessage,
  DmMessagesMessage,
  DmMessagesResultMessage,
  DmNapMessage,
  DmOutboundMessage,
  DmSendMessage,
  DmSendResultMessage,
  DmStatusMessage,
  DmStatusResultMessage,
  DmSubscribeMessage,
  DmSubscribeResultMessage,
  DmUnsubscribeMessage,
  DmUnsubscribeResultMessage,
} from '@napplet/nap/dm/types';

/** Relay pool contract for DM adapters. */
export interface DmRelayPool {
  subscribe(
    filters: NostrFilter[],
    callback: (item: NostrEvent | 'EOSE') => void,
    relayUrls?: string[],
  ): { unsubscribe(): void };
  publish(event: NostrEvent, relayUrls?: readonly string[]): void | Promise<void>;
  /** Query persisted encrypted messages before serving normalized history. */
  query?(filters: NostrFilter[], relayUrls?: string[]): Promise<NostrEvent[]>;
  selectRelayTier(filters: NostrFilter[]): string[];
  isAvailable(): boolean;
}

/** DM adapter contract consumed by createDmService. */
export interface DmAdapter {
  status(): Promise<DmStatus> | DmStatus;
  conversations(query?: DmConversationQuery): Promise<DmConversationPage> | DmConversationPage;
  messages(query: DmMessageQuery): Promise<DmMessagePage> | DmMessagePage;
  send(request: DmSendRequest): Promise<DmSendResult>;
  subscribe(
    request: DmSubscribeRequest,
    onMessage: (message: DmMessage) => void,
  ): Promise<DmSubscription> | DmSubscription;
  unsubscribe(subscriptionId: string): Promise<DmOk> | DmOk;
  /** Return the immutable relay set selected for an operation without contacting it. */
  planRelays?(operation: 'history' | 'send' | 'subscribe'): readonly string[];
  /** Execute NIP-17 history retrieval against a previously approved relay plan. */
  conversationsWithRelays?(query: DmConversationQuery | undefined, relayUrls: readonly string[], signal: { readonly aborted: boolean }): Promise<DmConversationPage> | DmConversationPage;
  /** Execute NIP-17 message retrieval against a previously approved relay plan. */
  messagesWithRelays?(query: DmMessageQuery, relayUrls: readonly string[], signal: { readonly aborted: boolean }): Promise<DmMessagePage> | DmMessagePage;
  /** Encrypt, sign, and publish only after the service approves the relay plan. */
  sendWithRelays?(request: DmSendRequest, relayUrls: readonly string[], signal: { readonly aborted: boolean }): Promise<DmSendResult>;
  /** Subscribe only after the service approves the relay plan. */
  subscribeWithRelays?(
    request: DmSubscribeRequest,
    onMessage: (message: DmMessage) => void,
    relayUrls: readonly string[],
    signal: { readonly aborted: boolean },
  ): Promise<DmSubscription> | DmSubscription;
  close?(): void;
}
