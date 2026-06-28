import type { NappletMessage, NostrEvent, NostrFilter } from '@napplet/core';

/** Hex Nostr public key. */
export type DmHexPubkey = string;

/** Unix timestamp in seconds. */
export type DmTimestamp = number;

/** Current runtime direct-message availability. */
export interface DmStatus {
  available: boolean;
  ownerPubkey?: DmHexPubkey;
  implementations: string[];
  capabilities: string[];
}

/** Query parameters for normalized DM conversation summaries. */
export interface DmConversationQuery {
  cursor?: string;
  limit?: number;
}

/** Public peer metadata safe for napplet display. */
export interface DmPeer {
  pubkey: DmHexPubkey;
  label?: string;
  avatar?: string;
}

/** A normalized direct or group conversation summary. */
export interface DmConversation {
  id: string;
  kind: 'direct' | 'group';
  participants: DmPeer[];
  subject?: string;
  unread: number;
  updatedAt?: DmTimestamp;
}

/** Page of normalized conversation summaries. */
export interface DmConversationPage {
  conversations: DmConversation[];
  cursor?: string;
}

/** Query parameters for message history within one conversation. */
export interface DmMessageQuery {
  conversationId: string;
  cursor?: string;
  limit?: number;
}

/** Runtime-normalized delivery state for a DM message. */
export type DmMessageStatus = 'sent' | 'delivered' | 'received' | 'failed';

/** Normalized cleartext message visible to the napplet by runtime policy. */
export interface DmMessage {
  id: string;
  conversationId: string;
  senderPubkey: DmHexPubkey;
  createdAt: DmTimestamp;
  content: string;
  status: DmMessageStatus;
}

/** Page of normalized messages for one conversation. */
export interface DmMessagePage {
  messages: DmMessage[];
  cursor?: string;
}

/** Request to send a direct message. */
export interface DmSendRequest {
  conversationId?: string;
  recipients: DmHexPubkey[];
  content: string;
  clientMessageId?: string;
}

/** Result of a runtime-mediated send. */
export interface DmSendResult {
  ok: boolean;
  message: DmMessage;
}

/** Request to start live DM delivery. */
export interface DmSubscribeRequest {
  conversationId?: string;
}

/** Runtime-assigned live subscription identity. */
export interface DmSubscription {
  subscriptionId: string;
}

/** Generic boolean acknowledgement used by `dm.unsubscribe`. */
export interface DmOk {
  ok: boolean;
}

export interface DmStatusMessage extends NappletMessage {
  type: 'dm.status';
  id: string;
}

export interface DmStatusResultMessage extends NappletMessage, Partial<DmStatus> {
  type: 'dm.status.result';
  id: string;
  error?: string;
}

export interface DmConversationsMessage extends NappletMessage, DmConversationQuery {
  type: 'dm.conversations';
  id: string;
}

export interface DmConversationsResultMessage extends NappletMessage, Partial<DmConversationPage> {
  type: 'dm.conversations.result';
  id: string;
  error?: string;
}

export interface DmMessagesMessage extends NappletMessage, DmMessageQuery {
  type: 'dm.messages';
  id: string;
}

export interface DmMessagesResultMessage extends NappletMessage, Partial<DmMessagePage> {
  type: 'dm.messages.result';
  id: string;
  error?: string;
}

export interface DmSendMessage extends NappletMessage, DmSendRequest {
  type: 'dm.send';
  id: string;
}

export interface DmSendResultMessage extends NappletMessage, Partial<DmSendResult> {
  type: 'dm.send.result';
  id: string;
  error?: string;
}

export interface DmSubscribeMessage extends NappletMessage, DmSubscribeRequest {
  type: 'dm.subscribe';
  id: string;
}

export interface DmSubscribeResultMessage extends NappletMessage, Partial<DmSubscription> {
  type: 'dm.subscribe.result';
  id: string;
  error?: string;
}

export interface DmUnsubscribeMessage extends NappletMessage {
  type: 'dm.unsubscribe';
  id: string;
  subscriptionId: string;
}

export interface DmUnsubscribeResultMessage extends NappletMessage, Partial<DmOk> {
  type: 'dm.unsubscribe.result';
  id: string;
  error?: string;
}

export interface DmMessageEventMessage extends NappletMessage {
  type: 'dm.message';
  subscriptionId: string;
  message: DmMessage;
}

export type DmOutboundMessage =
  | DmStatusMessage
  | DmConversationsMessage
  | DmMessagesMessage
  | DmSendMessage
  | DmSubscribeMessage
  | DmUnsubscribeMessage;

export type DmInboundMessage =
  | DmStatusResultMessage
  | DmConversationsResultMessage
  | DmMessagesResultMessage
  | DmSendResultMessage
  | DmSubscribeResultMessage
  | DmUnsubscribeResultMessage
  | DmMessageEventMessage;

/** Relay pool contract for DM adapters. */
export interface DmRelayPool {
  subscribe(
    filters: NostrFilter[],
    callback: (item: NostrEvent | 'EOSE') => void,
    relayUrls?: string[],
  ): { unsubscribe(): void };
  publish(event: NostrEvent): void | Promise<void>;
  selectRelayTier(filters: NostrFilter[]): string[];
  isAvailable(): boolean;
}

/** DM adapter contract consumed by createDmService. */
export interface DmAdapter {
  status(): Promise<DmStatus> | DmStatus;
  conversations(query?: DmConversationQuery): Promise<DmConversationPage> | DmConversationPage;
  messages(query: DmMessageQuery): Promise<DmMessagePage> | DmMessagePage;
  send(request: DmSendRequest): Promise<DmSendResult>;
  subscribe(request: DmSubscribeRequest, onMessage: (message: DmMessage) => void): Promise<DmSubscription> | DmSubscription;
  unsubscribe(subscriptionId: string): Promise<DmOk> | DmOk;
  close?(): void;
}
