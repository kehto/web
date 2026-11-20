import { createDmService, type DmAdapter, type DmConversation, type DmMessage } from '@kehto/services';
import { FIXTURE_PEER_PUBKEY, FIXTURE_USER_PUBKEY } from '../user.js';
import type { DomainBackendModule } from './types.js';

/** Relay the permission plan names. It is never contacted: the adapter is in memory. */
const PLANNED_RELAY = 'wss://relay.conformance.invalid';

function textOf(payload: unknown): string {
  const content = (payload as { content?: unknown } | undefined)?.content;
  return typeof content === 'string' ? content : 'hi';
}

/**
 * NAP-DM backend: the reference DM service over an in-memory adapter.
 *
 * Conversation `c1` with the fixture peer exists from boot; sending to a new
 * recipient set opens `c2`, `c3`, ... Subscriptions are `live1`, `live2`, ...
 * `dm.receive` makes the peer send a message to `c1`. Like relay events already
 * in flight, it reaches every listener the adapter ever registered; the
 * runtime must stop delivery for unsubscribed ones.
 */
export const DM_BACKEND: DomainBackendModule = {
  domain: 'dm',
  create() {
    let clock = 1790337600;
    let messageCount = 0;
    const conversations: DmConversation[] = [{ id: 'c1', kind: 'direct', participants: [{ pubkey: FIXTURE_PEER_PUBKEY, label: 'peer' }], unread: 0, updatedAt: clock }];
    const messages = new Map<string, DmMessage[]>([['c1', [{ id: 'msg0', conversationId: 'c1', senderPubkey: FIXTURE_PEER_PUBKEY, createdAt: clock, content: 'welcome', status: 'received' }]]]);
    const listeners: { subscriptionId: string; conversationId?: string; onMessage: (message: DmMessage) => void }[] = [];
    const record = (conversationId: string, senderPubkey: string, content: string, status: DmMessage['status']): DmMessage => {
      const message: DmMessage = { id: `msg${messageCount += 1}`, conversationId, senderPubkey, createdAt: clock += 1, content, status };
      messages.set(conversationId, [...(messages.get(conversationId) ?? []), message]);
      return message;
    };
    const conversationFor = (recipients: readonly string[]): string => {
      const key = [...recipients].sort().join(',');
      const found = conversations.find((item) => item.participants.map((peer) => peer.pubkey).sort().join(',') === key);
      if (found) return found.id;
      const id = `c${conversations.length + 1}`;
      conversations.push({ id, kind: recipients.length > 1 ? 'group' : 'direct', participants: recipients.map((pubkey) => ({ pubkey })), unread: 0, updatedAt: clock });
      return id;
    };
    const adapter: DmAdapter = {
      status: () => ({ available: true, ownerPubkey: FIXTURE_USER_PUBKEY, implementations: ['conformance-memory'], capabilities: ['direct'] }),
      conversations: () => ({ conversations: structuredClone(conversations) }),
      messages: (query) => ({ messages: structuredClone(messages.get(query.conversationId) ?? []) }),
      send: async (request) => ({ ok: true, message: record(request.conversationId ?? conversationFor(request.recipients), FIXTURE_USER_PUBKEY, request.content, 'sent') }),
      subscribe(request, onMessage) {
        const subscriptionId = `live${listeners.length + 1}`;
        listeners.push({ subscriptionId, ...(request.conversationId ? { conversationId: request.conversationId } : {}), onMessage });
        return { subscriptionId };
      },
      unsubscribe: () => ({ ok: true }),
      planRelays: () => [PLANNED_RELAY],
    };
    return {
      services: { dm: createDmService({ adapter }) },
      controls: {
        'dm.receive': (payload) => {
          const message = record('c1', FIXTURE_PEER_PUBKEY, textOf(payload), 'received');
          for (const listener of listeners) if (!listener.conversationId || listener.conversationId === 'c1') listener.onMessage(structuredClone(message));
        },
      },
    };
  },
};
