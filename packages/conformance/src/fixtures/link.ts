import type { DomainFixture } from './types.js';

/** NAP-LINK at napplet/naps#53 (100e5c93): open an absolute https URL. */
export const LINK_FIXTURE: DomainFixture = {
  domain: 'link',
  cases: [
    {
      id: 'link/open', type: 'link.open', payload: { url: 'https://example.com/post/123', options: { label: 'Read post' } },
      semantics: {
        rule: 'LinkOpenResult.status is "opened" or "denied"; error is absent when status is "opened"',
        verify: (reply) => {
          if (reply?.status !== 'opened' && reply?.status !== 'denied') return `status was ${JSON.stringify(reply?.status)}`;
          return reply.status === 'opened' && reply.error !== undefined ? `an opened result carried error ${JSON.stringify(reply.error)}` : null;
        },
      },
    },
  ],
};
