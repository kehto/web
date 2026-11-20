import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/**
 * Session ids the fixture addresses: the NAP's own example ids. They are
 * shell-assigned and the probe cannot feed a reply value into a later request,
 * so a target must assign `sess-1` and `sess-2` to the first two sessions.
 */
const DIRECT = 'sess-1';
const ROOM = 'sess-2';
const PEER = 'b'.repeat(64);
const DIRECT_SCOPE = { type: 'direct', pubkey: PEER };
const PEER_BODY = { body: 'hi' };

function session(reply: Envelope, expect: { scope: unknown; channel: string }): SemanticVerdict {
  const value = reply?.session as { id?: unknown; scope?: unknown; channel?: unknown; state?: unknown } | undefined;
  if (typeof value?.id !== 'string' || !value.id) return `session.id was ${JSON.stringify(value?.id)}`;
  if (JSON.stringify(value.scope) !== JSON.stringify(expect.scope)) return `session.scope was ${JSON.stringify(value.scope)}`;
  if (value.channel !== expect.channel) return `session.channel was ${JSON.stringify(value.channel)}`;
  return value.state === 'connecting' || value.state === 'open' ? null : `session.state was ${JSON.stringify(value.state)}`;
}

const errorOnly = (field: string) => (reply: Envelope): SemanticVerdict => {
  if (typeof reply?.error !== 'string' || !reply.error) return `error was ${JSON.stringify(reply?.error)}`;
  return reply[field] === undefined ? null : `"When error is present, other result fields are undefined", but ${field} was present`;
};

const close = (id: string, sessionId: string): OperationCase => ({ id, type: 'webrtc.close', payload: { sessionId, reason: 'done' } });

/** NAP-WEBRTC at napplet/naps#59 head: open (direct and lossy room), send, sendBytes, close, and peer messages as webrtc.event. */
export const WEBRTC_FIXTURE: DomainFixture = {
  domain: 'webrtc',
  cases: [
    {
      id: 'webrtc/open-direct', type: 'webrtc.open', payload: { request: { scope: DIRECT_SCOPE, channel: 'chat', protocol: 'chat:live' } },
      semantics: { rule: 'webrtc.open returns a WebrtcSession with an id, the requested scope and channel, and state connecting or open', verify: (reply) => session(reply, { scope: DIRECT_SCOPE, channel: 'chat' }) },
    },
    {
      id: 'webrtc/open-lossy-room', type: 'webrtc.open', payload: { request: { scope: { type: 'room', room: 'conformance-room' }, channel: 'state', ordered: false, maxRetransmits: 0 } },
      semantics: {
        rule: 'A shell that cannot honor requested delivery semantics "MUST still open the session ... and MUST report them": ordered and maxRetransmits, when reported, are a boolean and an unsigned integer',
        verify(reply) {
          const problem = session(reply, { scope: { type: 'room', room: 'conformance-room' }, channel: 'state' });
          if (problem) return problem;
          const value = reply?.session as { ordered?: unknown; maxRetransmits?: unknown };
          if (value.ordered !== undefined && typeof value.ordered !== 'boolean') return `ordered was ${JSON.stringify(value.ordered)}`;
          return value.maxRetransmits === undefined || (Number.isInteger(value.maxRetransmits) && (value.maxRetransmits as number) >= 0) ? null : `maxRetransmits was ${JSON.stringify(value.maxRetransmits)}`;
        },
      },
    },
    {
      id: 'webrtc/open-unknown-scope', type: 'webrtc.open', payload: { request: { scope: { type: 'broadcast' } } }, allowError: true,
      semantics: { rule: 'An unsupported scope is answered with an error and "When error is present, other result fields are undefined"', verify: errorOnly('session') },
    },
    { id: 'webrtc/send', type: 'webrtc.send', payload: { sessionId: DIRECT, payload: { body: 'hello' } } },
    {
      id: 'webrtc/sendBytes', type: 'webrtc.sendBytes', payload: { sessionId: ROOM, bytes: 'AAEC/w==' }, allowError: true,
      semantics: {
        rule: 'sendBytes succeeds, or "A shell that does not support byte payloads returns the error \\"unsupported\\""',
        verify: (reply) => (reply?.error === undefined || reply.error === 'unsupported' ? null : `error was ${JSON.stringify(reply.error)}, expected none or "unsupported"`),
      },
    },
    {
      id: 'webrtc/send-unknown-session', type: 'webrtc.send', payload: { sessionId: 'sess-conformance-unknown', payload: { body: 'x' } }, allowError: true,
      semantics: { rule: '"The shell MUST respond to every request with a result message carrying the same id"; an unknown session is an error result', verify: errorOnly('session') },
    },
    close('webrtc/close-room', ROOM),
  ],
  pushes: [
    {
      id: 'webrtc/event-message', type: 'webrtc.event',
      trigger: { control: 'webrtc.peerMessage', payload: { payload: PEER_BODY } },
      unsubscribe: close('webrtc/close-direct', DIRECT),
      semantics: {
        rule: 'A peer payload arrives as a message event for the open session whose from is the peer key authenticated during signaling; after close the shell "MUST NOT deliver messages for an unknown sessionId"',
        verify(push) {
          const event = push?.event as { type?: unknown; sessionId?: unknown; from?: unknown; payload?: unknown } | undefined;
          if (event?.type !== 'message') return `event.type was ${JSON.stringify(event?.type)}`;
          if (event.sessionId !== DIRECT) return `event.sessionId was ${JSON.stringify(event.sessionId)}`;
          if (event.from !== PEER) return `event.from was ${JSON.stringify(event.from)}, expected the direct scope's pubkey`;
          return JSON.stringify(event.payload) === JSON.stringify(PEER_BODY) ? null : `event.payload was ${JSON.stringify(event.payload)}`;
        },
      },
    },
    {
      id: 'webrtc/event-closed-on-revoke', type: 'webrtc.event', isolation: false,
      subscribe: { id: 'webrtc/open-revoked', type: 'webrtc.open', payload: { request: { scope: DIRECT_SCOPE, channel: 'revoked' } } },
      trigger: { control: 'webrtc.revoke' },
      // No follow-up request: once the grant is gone a runtime may stop routing webrtc requests at all.
      semantics: {
        rule: 'The shell SHOULD send a webrtc.event with type "closed" when an established session ends because "policy revokes the capability"',
        verify(push) {
          const event = push?.event as { type?: unknown; sessionId?: unknown; reason?: unknown } | undefined;
          if (event?.type !== 'closed') return `event.type was ${JSON.stringify(event?.type)}, expected "closed"`;
          if (typeof event.sessionId !== 'string' || !event.sessionId) return `event.sessionId was ${JSON.stringify(event.sessionId)}`;
          return event.reason === undefined || typeof event.reason === 'string' ? null : `event.reason was ${JSON.stringify(event.reason)}`;
        },
      },
    },
  ],
};
