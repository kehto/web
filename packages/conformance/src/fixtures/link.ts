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
    ...['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi'].map((url) => ({
      id: `link/open-${url.slice(0, url.indexOf(':'))}`, type: 'link.open', payload: { url }, allowError: true,
      semantics: {
        rule: 'The shell MUST reject javascript:, data:, blob:, file: and other local or code-bearing schemes (status "denied")',
        verify: (reply: Readonly<Record<string, unknown>> | null) => (reply?.status === 'denied' ? null : `status ${JSON.stringify(reply?.status)}, error ${JSON.stringify(reply?.error)}`),
      },
    })),
    {
      id: 'link/open-relative', type: 'link.open', payload: { url: '/relative/path' }, allowError: true,
      semantics: { rule: 'The shell MUST reject relative URLs (status "denied")', verify: (reply) => (reply?.status === 'denied' ? null : `status ${JSON.stringify(reply?.status)}, error ${JSON.stringify(reply?.error)}`) },
    },
  ],
};
