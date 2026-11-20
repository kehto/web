import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/** Tag a target's push control puts on the event it injects for the relay push case. */
export const RELAY_PUSH_TAG = ['t', 'conformance-relay-push'] as const;

const PUBLISH_TAG = ['t', 'conformance-relay-publish'];
const PUBLISH_CONTENT = 'conformance relay publish';
const ENCRYPTED_PLAINTEXT = 'conformance relay secret';
/** A valid secp256k1 x-only pubkey (the generator point), used as the encryption recipient. */
const RECIPIENT = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SUB_ID = 'conformance-relay-sub';
const HEX64 = /^[0-9a-f]{64}$/;

/** Unix seconds now: hosts may reject templates far from their clock, so the template is built when the probe is planned. */
const nowSeconds = (): number => Math.floor(Date.now() / 1000);

function signedProblem(event: unknown, template: { kind: number; content?: string }): string | null {
  const signed = event as Record<string, unknown> | undefined;
  if (!signed || typeof signed !== 'object') return `event was ${JSON.stringify(event)}`;
  for (const field of ['id', 'pubkey', 'sig'] as const) {
    if (typeof signed[field] !== 'string' || !(signed[field] as string).length) return `signed event lacks ${field}`;
  }
  if (!HEX64.test(String(signed.id)) || !HEX64.test(String(signed.pubkey))) return 'signed event id/pubkey is not 64-char hex';
  if (signed.kind !== template.kind) return `signed event kind was ${JSON.stringify(signed.kind)}, expected ${template.kind}`;
  if (template.content !== undefined && signed.content !== template.content) return `signed event content was ${JSON.stringify(signed.content)}`;
  return null;
}

function publishVerdict(reply: Envelope, template: { kind: number; content?: string }): SemanticVerdict {
  if (reply?.ok !== true) return `ok was ${JSON.stringify(reply?.ok)} (error ${JSON.stringify(reply?.error)})`;
  const problem = signedProblem(reply.event, template);
  if (problem) return problem;
  return reply.eventId === (reply.event as { id?: unknown }).id ? null : `eventId ${JSON.stringify(reply.eventId)} differs from the signed event id`;
}

const publishCase: OperationCase = {
  id: 'relay/publish', type: 'relay.publish',
  get payload() { return { event: { kind: 1, content: PUBLISH_CONTENT, tags: [PUBLISH_TAG], created_at: nowSeconds() } }; },
  semantics: {
    rule: 'The shell MUST sign event templates from relay.publish ... and respond with relay.publish.result containing the signed event (ok, event, eventId)',
    verify: (reply) => publishVerdict(reply, { kind: 1, content: PUBLISH_CONTENT }),
  },
};

const publishEncryptedCase: OperationCase = {
  id: 'relay/publishEncrypted', type: 'relay.publishEncrypted',
  get payload() {
    return { event: { kind: 4, content: ENCRYPTED_PLAINTEXT, tags: [['p', RECIPIENT]], created_at: nowSeconds() }, recipient: RECIPIENT, encryption: 'nip44' };
  },
  semantics: {
    rule: 'The shell MUST encrypt content and sign event templates from relay.publishEncrypted ... and respond with relay.publishEncrypted.result containing the signed event: the published content is ciphertext, not the plaintext and not empty',
    verify(reply) {
      const problem = publishVerdict(reply, { kind: 4 });
      if (problem) return problem;
      const content = (reply?.event as { content?: unknown }).content;
      if (typeof content !== 'string' || content.length === 0) return `signed event content was ${JSON.stringify(content)}, expected ciphertext`;
      return content === ENCRYPTED_PLAINTEXT ? 'signed event content is the plaintext' : null;
    },
  },
};

const queryCase: OperationCase = {
  id: 'relay/query', type: 'relay.query', payload: { filters: [{ kinds: [1], '#t': [PUBLISH_TAG[1]] }] },
  semantics: {
    rule: 'The shell MUST respond to relay.query by collecting event results until EOSE: the event relay.publish just forwarded to the pool comes back as a RelayEventResult',
    verify(reply) {
      const events = reply?.events;
      if (!Array.isArray(events)) return `events was ${JSON.stringify(events)}`;
      const malformed = events.find((item) => !item || typeof item !== 'object' || typeof (item as { event?: unknown }).event !== 'object');
      if (malformed !== undefined) return `events carries a non-RelayEventResult entry ${JSON.stringify(malformed)}`;
      const found = events.some((item) => (item as { event: { content?: unknown } }).event.content === PUBLISH_CONTENT);
      return found ? null : `the published event was not among ${events.length} query results`;
    },
  },
};

/**
 * NAP-RELAY at the pinned draft head. `relay.subscribe` and `relay.close` have no
 * `.result` in the wire table (the shell answers with `subId`-scoped lifecycle
 * messages), so their cases expect no correlated `.result`; the push case proves
 * delivery under the subscription and silence after `relay.close`.
 */
export const RELAY_FIXTURE: DomainFixture = {
  domain: 'relay',
  cases: [publishCase, publishEncryptedCase, queryCase],
  pushes: [
    {
      id: 'relay/event', type: 'relay.event',
      subscribe: { id: 'relay/subscribe', type: 'relay.subscribe', reply: null, payload: { subId: SUB_ID, filters: [{ kinds: [1], '#t': [RELAY_PUSH_TAG[1]] }] } },
      trigger: { control: 'relay.inject' },
      match: { subId: SUB_ID },
      unsubscribe: { id: 'relay/close', type: 'relay.close', reply: null, payload: { subId: SUB_ID } },
      semantics: {
        rule: 'The shell MUST forward subscriptions to its relay pool and deliver matching events as relay.event messages carrying RelayEventResult records',
        verify(push) {
          const event = (push?.result as { event?: Record<string, unknown> } | undefined)?.event;
          if (!event || typeof event !== 'object') return `relay.event result was ${JSON.stringify(push?.result)}`;
          const tags = Array.isArray(event.tags) ? event.tags as unknown[] : [];
          const matches = event.kind === 1 && tags.some((tag) => Array.isArray(tag) && tag[0] === RELAY_PUSH_TAG[0] && tag[1] === RELAY_PUSH_TAG[1]);
          return matches ? null : `delivered event does not match the subscription filter: ${JSON.stringify(event)}`;
        },
      },
    },
  ],
};
