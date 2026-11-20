import type { DomainFixture, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/**
 * Ids the fixture addresses are the NAP's example ids: conversation `c1` and
 * subscription `live1`. They are runtime-assigned and the probe cannot feed a
 * reply value into a later request, so a target must expose a conversation
 * `c1` and issue `live1` to the first subscription.
 */
const CONVERSATION = 'c1';
const SUBSCRIPTION = 'live1';
const RECIPIENT = 'b'.repeat(64);
const HEX = /^[0-9a-f]{64}$/u;
const STATUSES = ['sent', 'delivered', 'received', 'failed'];

function messageProblem(message: unknown): SemanticVerdict {
  const value = message as Record<string, unknown> | undefined;
  if (!value || typeof value !== 'object') return `message was ${JSON.stringify(message)}`;
  if (typeof value.id !== 'string' || typeof value.conversationId !== 'string' || typeof value.content !== 'string') return `message lacks id, conversationId or content: ${JSON.stringify(value)}`;
  if (typeof value.senderPubkey !== 'string' || !HEX.test(value.senderPubkey)) return `senderPubkey ${JSON.stringify(value.senderPubkey)} is not lowercase hex`;
  if (!Number.isInteger(value.createdAt)) return `createdAt was ${JSON.stringify(value.createdAt)}`;
  return STATUSES.includes(String(value.status)) ? null : `status was ${JSON.stringify(value.status)}`;
}

function conversationProblem(conversation: unknown): SemanticVerdict {
  const value = conversation as { id?: unknown; kind?: unknown; participants?: { pubkey?: unknown }[]; unread?: unknown } | undefined;
  if (typeof value?.id !== 'string') return `conversation id was ${JSON.stringify(value?.id)}`;
  if (value.kind !== 'direct' && value.kind !== 'group') return `kind was ${JSON.stringify(value.kind)}`;
  if (!Array.isArray(value.participants) || value.participants.some((peer) => typeof peer.pubkey !== 'string' || !HEX.test(peer.pubkey))) return `participants were ${JSON.stringify(value.participants)}`;
  return Number.isInteger(value.unread) && (value.unread as number) >= 0 ? null : `unread was ${JSON.stringify(value.unread)}`;
}

const errorOnly = (...fields: string[]) => (reply: Envelope): SemanticVerdict => {
  if (typeof reply?.error !== 'string' || !reply.error) return `error was ${JSON.stringify(reply?.error)}`;
  const present = fields.filter((field) => reply[field] !== undefined);
  return present.length ? `"When error is present, other result fields are undefined", but ${present.join(', ')} present` : null;
};

/** NAP-DM at napplet/naps#74 head: status, history, send, recipient validation, and live dm.message delivery. */
export const DM_FIXTURE: DomainFixture = {
  domain: 'dm',
  cases: [
    {
      id: 'dm/status', type: 'dm.status',
      semantics: {
        rule: 'DmStatus has a boolean available, implementations and capabilities lists, and an optional lowercase-hex ownerPubkey',
        verify(reply) {
          if (typeof reply?.available !== 'boolean') return `available was ${JSON.stringify(reply?.available)}`;
          if (!Array.isArray(reply.implementations) || !Array.isArray(reply.capabilities)) return 'implementations and capabilities must be lists';
          return reply.ownerPubkey === undefined || (typeof reply.ownerPubkey === 'string' && HEX.test(reply.ownerPubkey)) ? null : `ownerPubkey was ${JSON.stringify(reply.ownerPubkey)}`;
        },
      },
    },
    {
      id: 'dm/conversations', type: 'dm.conversations', payload: { limit: 10 },
      semantics: {
        rule: 'conversations "returns normalized conversation summaries" (DmConversation: id, kind, participants as hex pubkeys, unread)',
        verify: (reply) => (Array.isArray(reply?.conversations) ? reply.conversations.map(conversationProblem).find(Boolean) ?? null : `conversations was ${JSON.stringify(reply?.conversations)}`),
      },
    },
    {
      id: 'dm/messages', type: 'dm.messages', payload: { conversationId: CONVERSATION, limit: 10 },
      semantics: {
        rule: 'messages "returns normalized cleartext messages for one conversation"',
        verify(reply) {
          if (!Array.isArray(reply?.messages)) return `messages was ${JSON.stringify(reply?.messages)}`;
          return reply.messages.map(messageProblem).find(Boolean) ?? (reply.messages.every((item) => (item as { conversationId?: unknown }).conversationId === CONVERSATION) ? null : 'a message belonged to another conversation');
        },
      },
    },
    {
      id: 'dm/send', type: 'dm.send', payload: { recipients: [RECIPIENT], content: 'hello', clientMessageId: 'conformance-1' },
      semantics: {
        rule: 'DmSendResult has ok and the sent DmMessage carrying the content',
        verify: (reply) => (reply?.ok === true ? messageProblem(reply.message) ?? ((reply.message as { content?: unknown }).content === 'hello' ? null : 'message.content differs from the sent content') : `ok was ${JSON.stringify(reply?.ok)}`),
      },
    },
    {
      id: 'dm/send-invalid-recipient', type: 'dm.send', payload: { recipients: ['not-a-pubkey'], content: 'hello' }, allowError: true,
      semantics: { rule: '"The runtime MUST validate recipient public keys before sending": a non-hex recipient is an error result with no ok or message', verify: errorOnly('ok', 'message') },
    },
    {
      id: 'dm/unsubscribe-unknown', type: 'dm.unsubscribe', payload: { subscriptionId: 'live-conformance-unknown' }, allowError: true,
      semantics: { rule: 'Unsubscribing an unknown subscription is answered with an error result and no ok', verify: errorOnly('ok') },
    },
  ],
  pushes: [
    {
      id: 'dm/message', type: 'dm.message',
      subscribe: { id: 'dm/subscribe', type: 'dm.subscribe', payload: { conversationId: CONVERSATION } },
      trigger: { control: 'dm.receive', payload: { content: 'hi' } },
      unsubscribe: { id: 'dm/unsubscribe', type: 'dm.unsubscribe', payload: { subscriptionId: SUBSCRIPTION } },
      semantics: {
        rule: '"subscribe starts live delivery": dm.message carries the subscriptionId and a DmMessage of the subscribed conversation; "unsubscribe stops a live subscription"',
        verify(push) {
          if (push?.subscriptionId !== SUBSCRIPTION) return `subscriptionId was ${JSON.stringify(push?.subscriptionId)}`;
          if ('id' in (push ?? {})) return 'dm.message "has no request id", but it carried one';
          const message = push.message as { conversationId?: unknown; content?: unknown } | undefined;
          return messageProblem(message) ?? (message?.conversationId === CONVERSATION && message.content === 'hi' ? null : `message was ${JSON.stringify(message)}`);
        },
      },
    },
  ],
};
