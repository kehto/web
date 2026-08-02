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
  publish(event: NostrEvent): void | Promise<void>;
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
  close?(): void;
}
