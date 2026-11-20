import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

/**
 * A signed NIP-01 event a target's outbox backend is expected to hold before the
 * probe runs, so `outbox.getEvent` has a known id to fetch. Signed with a
 * throwaway key that has no value.
 */
export const OUTBOX_SEED_EVENT = Object.freeze({
  kind: 1,
  created_at: 1700000000,
  tags: [['t', 'conformance-outbox-seed']],
  content: 'conformance outbox seed',
  pubkey: '2683123218f34cc2c1f1a2a5a2b9863005a3cdda3b1d8df02a85b20963ffb3a3',
  id: '9f44a4c5555f8b9acb5222ea37fd3c5f184adf9976c0c5f0bdb960ccdcee1d8b',
  sig: '67597350508c98a80f1d5c5ff3ab981dc4321769279abff6622e50e4dfd928817a227fab2fcc3a83bb85f2630b1f170e7a2f699baac7321c222a441f0fdd0d47',
});

/** Tag a target's push control puts on the event it injects for the outbox push case. */
export const OUTBOX_PUSH_TAG = ['t', 'conformance-outbox-push'] as const;

const PUBLISH_TAG = ['t', 'conformance-outbox-publish'];
const PUBLISH_CONTENT = 'conformance outbox publish';
const SUB_ID = 'conformance-outbox-sub';
const HEX64 = /^[0-9a-f]{64}$/;
const PLAN_SOURCES = ['nip65', 'cache', 'policy', 'fallback'];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

function publishVerdict(reply: Envelope): SemanticVerdict {
  if (reply?.ok !== true) return `ok was ${JSON.stringify(reply?.ok)} (error ${JSON.stringify(reply?.error)})`;
  const event = reply.event as Record<string, unknown> | undefined;
  if (!event || typeof event !== 'object') return `event was ${JSON.stringify(reply.event)}`;
  if (!HEX64.test(String(event.id)) || !HEX64.test(String(event.pubkey)) || typeof event.sig !== 'string') return 'event is not a signed NIP-01 event';
  if (event.content !== PUBLISH_CONTENT || event.kind !== 1) return `signed event does not carry the template (kind ${JSON.stringify(event.kind)}, content ${JSON.stringify(event.content)})`;
  return reply.eventId === event.id ? null : `eventId ${JSON.stringify(reply.eventId)} differs from the signed event id`;
}

function queryVerdict(reply: Envelope): SemanticVerdict {
  const events = reply?.events;
  if (!Array.isArray(events)) return `events was ${JSON.stringify(events)}`;
  const ids = events.map((item) => (item as { event?: { id?: unknown } } | null)?.event?.id);
  if (ids.some((id) => typeof id !== 'string')) return 'events carries an entry that is not a RelayEventResult';
  if (new Set(ids).size !== ids.length) return `events carries duplicate ids: ${JSON.stringify(ids)}`;
  return events.some((item) => (item as { event: { content?: unknown } }).event.content === PUBLISH_CONTENT)
    ? null : `the published event was not among ${events.length} query results`;
}

const publishCase: OperationCase = {
  id: 'outbox/publish', type: 'outbox.publish',
  get payload() { return { event: { kind: 1, content: PUBLISH_CONTENT, tags: [PUBLISH_TAG], created_at: nowSeconds() } }; },
  semantics: { rule: 'The shell MUST sign event templates submitted through outbox.publish; the result carries ok, the signed event and its eventId', verify: publishVerdict },
};

/** NAP-OUTBOX at the pinned draft head: every request, and a live subscription that stops on outbox.close. */
export const OUTBOX_FIXTURE: DomainFixture = {
  domain: 'outbox',
  cases: [
    {
      id: 'outbox/resolveRelays', type: 'outbox.resolveRelays', payload: { target: { pubkey: OUTBOX_SEED_EVENT.pubkey, direction: 'read' } },
      semantics: {
        rule: 'outbox.resolveRelays.result carries an OutboxRelayPlan: relays (list, required) and source (nip65 | cache | policy | fallback, required)',
        verify(reply) {
          const plan = reply?.plan as { relays?: unknown; source?: unknown } | undefined;
          if (!plan || !Array.isArray(plan.relays) || plan.relays.some((url) => typeof url !== 'string')) return `plan was ${JSON.stringify(reply?.plan)}`;
          return PLAN_SOURCES.includes(String(plan.source)) ? null : `plan.source was ${JSON.stringify(plan.source)}`;
        },
      },
    },
    {
      id: 'outbox/getEvent', type: 'outbox.getEvent', payload: { eventId: OUTBOX_SEED_EVENT.id, options: { author: OUTBOX_SEED_EVENT.pubkey } },
      semantics: {
        rule: 'The shell MUST verify that an event returned by outbox.getEvent matches the requested eventId',
        verify(reply) {
          const event = (reply?.result as { event?: { id?: unknown } } | undefined)?.event;
          return event?.id === OUTBOX_SEED_EVENT.id ? null : `result was ${JSON.stringify(reply?.result)} (error ${JSON.stringify(reply?.error)})`;
        },
      },
    },
    publishCase,
    {
      id: 'outbox/query', type: 'outbox.query', payload: { filters: [{ kinds: [1], '#t': [PUBLISH_TAG[1]] }] },
      semantics: { rule: 'The shell MUST deduplicate events by event ID before returning outbox.query.result; the event outbox.publish just fanned out is found', verify: queryVerdict },
    },
  ],
  pushes: [
    {
      id: 'outbox/event', type: 'outbox.event',
      subscribe: { id: 'outbox/subscribe', type: 'outbox.subscribe', reply: null, payload: { subId: SUB_ID, filters: [{ kinds: [1], '#t': [OUTBOX_PUSH_TAG[1]] }] } },
      trigger: { control: 'outbox.inject' },
      match: { subId: SUB_ID },
      unsubscribe: { id: 'outbox/close', type: 'outbox.close', reply: null, payload: { subId: SUB_ID } },
      semantics: {
        rule: 'The shell MUST deliver matching subscription events as outbox.event (a RelayEventResult) until the napplet sends outbox.close',
        verify(push) {
          const event = (push?.result as { event?: Record<string, unknown> } | undefined)?.event;
          const tags = Array.isArray(event?.tags) ? event.tags as unknown[] : [];
          const matches = event?.kind === 1 && tags.some((tag) => Array.isArray(tag) && tag[0] === OUTBOX_PUSH_TAG[0] && tag[1] === OUTBOX_PUSH_TAG[1]);
          return matches ? null : `outbox.event result does not match the subscription filter: ${JSON.stringify(push?.result)}`;
        },
      },
    },
  ],
};
