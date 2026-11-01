import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { LINK_MOCK_ENTRY, LINK_SPEC_REF, createMockLinkService } from './link.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

describe('createMockLinkService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockLinkService();
    expect(service.descriptor).toMatchObject({ name: 'link', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['link.open']);
    expect(service.messageCapabilities).toBeUndefined();
    expect(LINK_SPEC_REF).toEqual({ nap: 'NAP-LINK', status: 'draft', source: 'pr', pr: 53, sha: '50c2d45c', path: 'naps/NAP-LINK.md' });
    expect(LINK_MOCK_ENTRY.kind).toBe('service');
    expect(LINK_MOCK_ENTRY.create?.({}).descriptor.name).toBe('link');
  });

  it('opens http(s) links and records the untrusted label', () => {
    const service = createMockLinkService({ clock: { now: () => 1_700_000_000_000 } });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'link.open', id: 'l1', url: 'https://example.com/post/123', options: { label: 'Read post' } } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'link.open.result', id: 'l1', status: 'opened' }]);
    expect(service.mock.state().records).toEqual([
      { windowId: 'w1', url: 'https://example.com/post/123', label: 'Read post', status: 'opened', at: 1_700_000_000_000 },
    ]);
  });

  it('denies non-http(s) and code-bearing schemes', () => {
    const service = createMockLinkService();
    const { sent, send } = sink();
    for (const [id, url] of [['l2', 'file:///etc/passwd'], ['l3', 'javascript:alert(1)'], ['l4', 'data:text/html,hi'], ['l5', 'blob:https://x/y']]) {
      service.handleMessage('w1', { type: 'link.open', id, url } as NappletMessage, send);
    }
    expect(sent).toEqual([
      { type: 'link.open.result', id: 'l2', status: 'denied', error: 'unsupported-scheme' },
      { type: 'link.open.result', id: 'l3', status: 'denied', error: 'unsupported-scheme' },
      { type: 'link.open.result', id: 'l4', status: 'denied', error: 'unsupported-scheme' },
      { type: 'link.open.result', id: 'l5', status: 'denied', error: 'unsupported-scheme' },
    ]);
  });

  it('denies relative, missing, blocked, and user-refused URLs', () => {
    const service = createMockLinkService({ blockedHosts: ['blocked.example'] });
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'link.open', id: 'l6', url: '/relative/path' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'link.open', id: 'l7' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'link.open', id: 'l8', url: 'https://blocked.example/x' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'link.open.result', id: 'l6', status: 'denied', error: 'invalid-url' },
      { type: 'link.open.result', id: 'l7', status: 'denied', error: 'invalid-url' },
      { type: 'link.open.result', id: 'l8', status: 'denied', error: 'blocked-by-policy' },
    ]);

    const refusing = createMockLinkService({ denyAll: true, allowedSchemes: ['https:', 'nostr:'] });
    const refusal = sink();
    refusing.handleMessage('w1', { type: 'link.open', id: 'l9', url: 'nostr:npub1abc' } as NappletMessage, refusal.send);
    expect(refusal.sent).toEqual([{ type: 'link.open.result', id: 'l9', status: 'denied', error: 'user-denied' }]);
  });

  it('resets records and tolerates window destruction', () => {
    const service = createMockLinkService();
    service.handleMessage('w1', { type: 'link.open', id: 'l1', url: 'https://example.org/' } as NappletMessage, () => {});
    expect(service.mock.state().records).toHaveLength(1);
    service.onWindowDestroyed?.('w1');
    service.mock.reset();
    expect(service.mock.state().records).toEqual([]);
    expect(service.mock.sent).toEqual([]);
  });
});
