import type {
  DmConversation,
  DmConversationPage,
  DmConversationQuery,
  DmHexPubkey,
  DmMessage,
  DmMessagePage,
  DmMessageQuery,
  DmPeer,
} from './dm-types.js';

/** In-memory normalized DM store. */
export class DmMemoryStore {
  private readonly messagesByConversation = new Map<string, DmMessage[]>();
  private readonly participantsByConversation = new Map<string, DmPeer[]>();

  conversationIdFor(participants: readonly DmHexPubkey[]): string {
    return `direct:${[...new Set(participants)].sort().join(',')}`;
  }

  upsertMessage(message: DmMessage, participants: readonly DmHexPubkey[]): DmMessage {
    const peers = [...new Set(participants)].sort().map((pubkey) => ({ pubkey }));
    this.participantsByConversation.set(message.conversationId, peers);
    const list = this.messagesByConversation.get(message.conversationId) ?? [];
    const existing = list.findIndex((entry) => entry.id === message.id);
    if (existing >= 0) list[existing] = message;
    else list.push(message);
    list.sort((a, b) => a.createdAt - b.createdAt);
    this.messagesByConversation.set(message.conversationId, list);
    return message;
  }

  conversations(query: DmConversationQuery = {}): DmConversationPage {
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const limit = query.limit ?? 50;
    const conversations: DmConversation[] = [...this.messagesByConversation.entries()]
      .map(([id, messages]) => {
        const latest = messages[messages.length - 1];
        return {
          id,
          kind: id.startsWith('group:') ? 'group' : 'direct',
          participants: this.participantsByConversation.get(id) ?? [],
          unread: messages.filter((message) => message.status === 'received').length,
          ...(latest ? { updatedAt: latest.createdAt } : {}),
        } satisfies DmConversation;
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const page = conversations.slice(offset, offset + limit);
    const next = offset + page.length < conversations.length ? String(offset + page.length) : undefined;
    return { conversations: page, ...(next ? { cursor: next } : {}) };
  }

  messages(query: DmMessageQuery): DmMessagePage {
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const limit = query.limit ?? 100;
    const all = this.messagesByConversation.get(query.conversationId) ?? [];
    const page = all.slice(offset, offset + limit);
    const next = offset + page.length < all.length ? String(offset + page.length) : undefined;
    return { messages: page, ...(next ? { cursor: next } : {}) };
  }
}
