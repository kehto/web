import type { DomainFixture } from './types.js';

const TOPIC = 'napplet:conformance/single';

/**
 * NAP-INC at napplet/naps master, one endpoint: every operation's wire shape.
 * Multi-endpoint semantics (identifiers, exclusion, routing, channels) live in
 * the `inc/*` checks of scenarios/inc.ts.
 */
export const INC_FIXTURE: DomainFixture = {
  domain: 'inc',
  cases: [
    { id: 'inc/subscribe', type: 'inc.subscribe', payload: { topic: TOPIC } },
    { id: 'inc/emit', type: 'inc.emit', noId: true, reply: null, payload: { topic: TOPIC, payload: { n: 1 } } },
    { id: 'inc/unsubscribe', type: 'inc.unsubscribe', noId: true, reply: null, payload: { topic: TOPIC } },
    { id: 'inc/channel-list', type: 'inc.channel.list' },
    {
      id: 'inc/channel-open-unknown', type: 'inc.channel.open', payload: { target: 'conformance-no-such-endpoint' }, allowError: true,
      semantics: {
        rule: 'channel.open to a target with no live endpoint fails: the result carries error and no channelId',
        verify: (reply) => (typeof reply?.error === 'string' && reply.channelId === undefined ? null : `reply was ${JSON.stringify(reply)}`),
      },
    },
    { id: 'inc/channel-emit-unknown', type: 'inc.channel.emit', noId: true, reply: null, payload: { channelId: 'conformance-no-such-channel', payload: { n: 1 } } },
    { id: 'inc/channel-broadcast', type: 'inc.channel.broadcast', noId: true, reply: null, payload: { payload: { n: 1 } } },
    { id: 'inc/channel-close-unknown', type: 'inc.channel.close', noId: true, reply: null, payload: { channelId: 'conformance-no-such-channel' } },
  ],
};
