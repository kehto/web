import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { MOCK_NAP_REGISTRY, createMockNapEnvironment } from './registry.js';

function sink() {
  const sent: Array<NappletMessage & Record<string, unknown>> = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg as NappletMessage & Record<string, unknown>); } };
}

describe('createMockNapEnvironment', () => {
  it('creates every service mock and lists every reachable domain', () => {
    const env = createMockNapEnvironment({ seed: 5 });
    const factories = MOCK_NAP_REGISTRY.filter((entry) => entry.create).map((entry) => entry.domain);
    expect(env.serviceDomains).toEqual(factories);
    for (const domain of [...factories, 'shell', 'storage', 'inc']) expect(env.domains, domain).toContain(domain);
    expect(env.domains).not.toContain('class-1');
    expect(env.statePersistence.set('k', 'v')).toBe(true);
    env.resetAll();
    expect(env.statePersistence.get('k')).toBeNull();
  });

  it('shares one Nostr store across the social mocks', () => {
    const env = createMockNapEnvironment({ only: ['relay', 'count'] });
    const before = env.store.query([{ kinds: [1] }]).length;
    const relay = sink();
    env.get('relay').handleMessage('w1', {
      type: 'relay.publish',
      id: 'p1',
      event: { kind: 1, content: 'Netinst image verified.', tags: [['t', 'linux']], created_at: 1_767_300_000 },
    } as NappletMessage, relay.send);
    expect(relay.sent.find((msg) => msg.type === 'relay.publish.result')?.error).toBeUndefined();
    expect(env.store.query([{ kinds: [1] }])).toHaveLength(before + 1);

    const count = sink();
    env.get('count').handleMessage('w1', { type: 'count.query', id: 'c1', filters: [{ kinds: [1] }] } as NappletMessage, count.send);
    expect(count.sent[0]).toMatchObject({ type: 'count.query.result', id: 'c1', count: before + 1 });

    env.resetAll();
    expect(env.store.query([{ kinds: [1] }])).toHaveLength(before);
  });
});
